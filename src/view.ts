import {createRefreshLoop,createSnapshotGuard,bindVisibility} from './refresh.ts';
import {bindTheme} from './theme.ts';
import type {Theme,ThemeChoice} from './theme.ts';
import type {DeskSnapshot,DeskProject,Attention,Milestone,Issue,ThreadRef,Evidence,Blocker} from './model.ts';
import mark from '../assets/decision-desk-mark-v1.png';
type Host={refresh:(projectId?:string)=>Promise<any>;openLink:(url:string)=>Promise<void>;requestSync?:(prompt:string)=>Promise<void>};
const labels:Record<string,string>={planned:'尚未开始',active:'推进中',blocked:'有卡点',ready_for_review:'待验收',accepted:'已验收',unknown:'待核实',triage:'待分诊',in_progress:'解决中',resolved:'已解决',waiting:'等你处理',done:'已完成'};
const icon:Record<string,string>={accepted:'✓',blocked:'!',ready_for_review:'◎',active:'↗',planned:'·',unknown:'?'};
const date=(value:string)=>new Intl.DateTimeFormat('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
export function mount(root:HTMLElement,host:Host){
 const doc=root.ownerDocument,win=doc.defaultView!;
 function el<K extends keyof HTMLElementTagNameMap>(tag:K,cls='',text?:string):HTMLElementTagNameMap[K]{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
 function button(text:string,cls:string,click:()=>void){const n=el('button',cls,text);n.type='button';n.addEventListener('click',click);return n;}
 function pill(state:string){return el('span','status status-'+state,labels[state]??state);}
 let snapshot:DeskSnapshot|null=null,selected:string|undefined,tab:'focus'|'project'|'issues'='focus',scope='user',filter='all',disposed=false,syncing=false;
 const guard=createSnapshotGuard();
 root.className='desk';const theme=bindTheme(root,win);
 const header=el('header','header');const brand=el('div','brand');const logo=el('img','logo');logo.src=mark;logo.alt='';brand.append(logo,el('span','','项目工作台'));
 const picker=el('select','project-picker');picker.setAttribute('aria-label','选择 Codex 项目');picker.append(new Option('选择项目',''));
 const tools=el('div','header-tools');const sync=button('连接项目','button subtle',()=>void requestSync());
 const themePicker=el('select','theme-picker');themePicker.setAttribute('aria-label','显示主题');for(const [v,t] of [['auto','◐ 自动'],['light','☀ 浅色'],['dark','☾ 深色']]){const o=el('option','',t);o.value=v;themePicker.append(o);}themePicker.addEventListener('change',()=>theme.choose(themePicker.value as ThemeChoice));
 tools.append(sync,themePicker);header.append(brand,picker,tools);
 const nav=el('nav','nav');nav.setAttribute('aria-label','工作台视图');const navButtons=new Map<string,HTMLButtonElement>();for(const [key,text] of [['focus','我的关注'],['project','项目全景'],['issues','问题']]){const b=button(text,'nav-item',()=>{tab=key as typeof tab;render();});navButtons.set(key,b);nav.append(b);}
 const notice=el('div','notice');notice.setAttribute('role','status');notice.hidden=true;
 const main=el('main','main');const footer=el('footer','footer');const freshness=el('span');const refresh=button('刷新视图','text-button',()=>void loop.refresh());footer.append(freshness,refresh);
 const dialog=el('dialog','detail');dialog.setAttribute('aria-labelledby','detail-title');
 root.replaceChildren(header,nav,notice,main,footer,dialog);
 function say(text:string,error=false){notice.textContent=text;notice.className='notice'+(error?' error':'');notice.hidden=!text;}
 function empty(title:string,body:string){const n=el('section','empty');n.append(el('div','empty-mark','◎'),el('h2','',title),el('p','muted',body));return n;}
 function linkButton(owner:ThreadRef|null,container:HTMLElement){
  if(!owner){container.append(el('p','muted','负责聊天尚未确认'));return;}
  const go=button('打开负责聊天 ↗','button primary',()=>void host.openLink('codex://threads/'+owner.id).catch(()=>{const fallback=el('input','copy-field');fallback.readOnly=true;fallback.value='codex://threads/'+owner.id;fallback.setAttribute('aria-label','聊天链接');container.append(el('p','muted','宿主未能打开聊天，可复制链接：'),fallback);fallback.select();}));
  container.append(go,el('p','owner-title',owner.title));
 }
 function section(container:HTMLElement,title:string,text:string){const block=el('section','detail-section');block.append(el('h3','',title),el('p','',text));container.append(block);return block;}
 function criteria(container:HTMLElement,items:string[]){if(!items.length)return;const block=el('section','detail-section');block.append(el('h3','','验收标准'));const ul=el('ul','criteria');for(const item of items)ul.append(el('li','',item));block.append(ul);container.append(block);}
 function evidence(container:HTMLElement,items:Evidence[]){const details=el('details','evidence');details.append(el('summary','',`证据与来源 · ${items.length}`));if(!items.length)details.append(el('p','muted','暂未提供证据，请先核实。'));for(const e of items){const p=el('div','evidence-item');p.append(el('p','',e.summary),el('small','muted',date(e.observedAt)));if(e.thread)p.append(button('查看来源聊天 ↗','text-button',()=>void host.openLink('codex://threads/'+e.thread!.id).catch(()=>say('宿主未能打开来源聊天。',true))));if(e.url){const a=el('a','text-button','查看证据 ↗');a.href=e.url;a.target='_blank';a.rel='noreferrer noopener';p.append(a);}details.append(p);}container.append(details);}
 let detailKey:{kind:'attention'|'milestone'|'issue'|'blocker';id:string}|null=null;
 function openDetail(kind:'attention'|'milestone'|'issue'|'blocker',id:string){detailKey={kind,id};paintDetail();if(!dialog.open){if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');}}
 function paintDetail(){
  const p=snapshot?.project;if(!p||!detailKey)return;
  const item=detailKey.kind==='attention'?p.attention.find(a=>a.id===detailKey!.id):detailKey.kind==='milestone'?p.milestones.find(a=>a.id===detailKey!.id):detailKey.kind==='issue'?p.issues.find(a=>a.id===detailKey!.id):p.milestones.flatMap(m=>m.blockers).find(a=>a.id===detailKey!.id);
  if(!item){dialog.close?.();detailKey=null;return;}
  const close=button('关闭 ×','button subtle',()=>{dialog.close?.();dialog.removeAttribute('open');detailKey=null;});const top=el('div','detail-top');top.append(el('span','eyebrow',detailKey.kind==='blocker'?'需要解开的卡点':detailKey.kind==='issue'?'问题详情':'关键一步'),close);
  const h=el('h2','',item.title);h.id='detail-title';const body=el('div','detail-body');dialog.replaceChildren(top,h,body);
  if(detailKey.kind==='attention'){const a=item as Attention;body.append(pill(a.state));section(body,'发生了什么',a.summary);section(body,a.kind==='acceptance'?'需要你验收':'需要你决定',a.ask);section(body,'影响',a.impact);criteria(body,a.criteria);}
  if(detailKey.kind==='milestone'){const m=item as Milestone;body.append(pill(m.state));section(body,'交付结果',m.outcome);criteria(body,m.criteria);for(const b of m.blockers){const card=button('! '+b.title+' →','blocker-callout',()=>openDetail('blocker',b.id));card.append(el('span','',b.summary));body.append(card);}if(m.acceptedAt)section(body,'已验收',date(m.acceptedAt));}
  if(detailKey.kind==='issue'){const i=item as Issue;body.append(pill(i.status));section(body,'问题',i.summary);section(body,'最新进展',i.latestUpdate);section(body,'下一步',i.nextStep);}
  if(detailKey.kind==='blocker'){const b=item as Blocker;body.append(pill('blocked'));section(body,'卡在哪里',b.summary);section(body,'影响',b.impact);section(body,'如何推进',b.nextStep);}
  const action=el('section','detail-action');linkButton(item.owner,action);body.append(action);evidence(body,item.evidence);
 }
 dialog.addEventListener('close',()=>{detailKey=null;});
 dialog.addEventListener('click',event=>{if(event.target===dialog){const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)dialog.close();}});
 function attentionCard(a:Attention,index:number){const card=button('','attention-card'+(index===0?' featured':''),()=>openDetail('attention',a.id));const top=el('div','card-top');top.append(el('span','eyebrow',a.kind==='acceptance'?'等你验收':'等你决定'),el('span','card-arrow','↗'));card.append(top,el('h3','',a.title),el('p','',a.ask),el('span','card-bottom',a.kind==='acceptance'?'查看验收标准 →':'查看问题与影响 →'));return card;}
 function issueRow(i:Issue){const b=button('','issue-row',()=>openDetail('issue',i.id));const text=el('span','issue-copy');text.append(el('strong','',i.title),el('span','muted',i.latestUpdate));b.append(el('span','issue-dot dot-'+i.status),text,pill(i.status),el('span','row-arrow','→'));return b;}
 function pageHeading(kicker:string,title:string,description:string){const h=el('div','page-heading');h.append(el('p','eyebrow',kicker),el('h1','',title),el('p','muted',description));main.append(h);}
 function focusPage(p:DeskProject){
  const waiting=p.attention.filter(a=>a.state==='waiting');
  pageHeading('YOUR NEXT MOVE',waiting.length?`${waiting.length} 个关键点，等你推进。`:'这一刻，可以安心向前。',p.nextCheckpoint);
  const grid=el('div','focus-grid');const left=el('section','attention-section');const head=el('div','section-heading');head.append(el('h2','','需要你'),el('span','muted',`${p.metrics.awaitingAcceptance} 项验收 · ${p.metrics.awaitingDecision} 项决策`));left.append(head);
  if(waiting.length){const cards=el('div','attention-list');for(const [i,a] of waiting.slice(0,4).entries())cards.append(attentionCard(a,i));left.append(cards);if(waiting.length>4){const more=el('details','more-attention');more.append(el('summary','',`还有 ${waiting.length-4} 项待处理`));waiting.slice(4).forEach(a=>more.append(attentionCard(a,1)));left.append(more);}}else left.append(empty('没有待处理的验收或决策','有新的交付需要你确认时，会出现在这里。'));
  const right=el('section','my-issues');const rh=el('div','section-heading');rh.append(el('h2','','我提出的问题'),el('span','count',String(p.metrics.reportedOpen)));right.append(rh);
  const mine=p.issues.filter(i=>i.reportedBy==='user'&&i.status!=='resolved');mine.slice(0,4).forEach(i=>right.append(issueRow(i)));if(!mine.length)right.append(el('p','quiet','没有未关闭的问题。'));right.append(button('查看问题状态 →','text-button',()=>{tab='issues';scope='user';filter='all';render();}));
  grid.append(left,right);main.append(grid);
  const wins=p.milestones.filter(m=>m.state==='accepted').sort((a,b)=>Date.parse(a.acceptedAt!)-Date.parse(b.acceptedAt!));const strip=el('section','achievement');strip.append(el('span','win-mark','✓'),el('div','',`${wins.length} / ${p.milestones.length} 个里程碑已验收`));if(wins.length)strip.append(el('span','muted','最近完成 · '+wins.at(-1)!.title));else strip.append(el('span','muted','下一次确认，就是新的进展'));strip.append(button('看项目全景 →','text-button',()=>{tab='project';render();}));main.append(strip);
 }
 function projectPage(p:DeskProject){
  pageHeading('THE BIG PICTURE',p.name,p.goal);
  const metrics=el('div','project-metrics');for(const [value,label] of [[`${p.metrics.accepted} / ${p.metrics.total}`,'里程碑已验收'],[String(p.metrics.blocked),'处卡点'],[String(p.metrics.awaitingAcceptance),'项等你验收']]){const m=el('div','metric');m.append(el('strong','',value),el('span','muted',label));metrics.append(m);}main.append(metrics);
  const track=el('ol','milestone-track');track.setAttribute('aria-label','项目里程碑航线');p.milestones.forEach((m,index)=>{const li=el('li','station station-'+m.state);const b=button('','milestone-card',()=>openDetail('milestone',m.id));const node=el('span','station-node',icon[m.state]);node.setAttribute('aria-hidden','true');const top=el('div','card-top');top.append(el('span','eyebrow','M'+String(index+1).padStart(2,'0')),pill(m.state));b.append(node,top,el('h2','',m.title),el('p','muted',m.outcome));if(m.state==='accepted')b.append(el('span','milestone-note','已确认的成果 ✓'));else if(m.blockers.length)b.append(el('span','milestone-note alert',`${m.blockers.length} 个卡点 · 点击查看原因 →`));else b.append(el('span','milestone-note','查看目标与验收标准 →'));li.append(b);if(m.blockers.length){const issue=button('! '+m.blockers[0].title,'map-blocker',()=>openDetail('blocker',m.blockers[0].id));li.append(issue);}track.append(li);});main.append(track);
  if(!p.milestones.length)main.append(empty('先明确要交付什么','同步项目后，从用户确认的目标提取里程碑。'));
  const legend=el('p','map-legend','✓ 已验收   ↗ 推进中   ! 卡点   ◎ 待验收   · 尚未开始');main.append(legend);
 }
 function issuesPage(p:DeskProject){
  pageHeading('CLOSE THE LOOP','每个问题，都有下文。','从等待分诊，到修复验证；这里保留每一步的状态。');
  const bar=el('div','issue-controls');const scopeSelect=el('select','scope-picker');scopeSelect.setAttribute('aria-label','问题来源');scopeSelect.dataset.focusKey='issue-scope';for(const [v,t] of [['user','我提出的'],['all','全部问题']]){const o=el('option','',t);o.value=v;scopeSelect.append(o);}scopeSelect.value=scope;scopeSelect.addEventListener('change',()=>{scope=scopeSelect.value;render();});bar.append(scopeSelect);
  const items=p.issues.filter(i=>scope==='all'||i.reportedBy==='user');const filters=el('div','filters');filters.setAttribute('aria-label','筛选问题状态');for(const [v,t] of [['all','全部'],['triage','待分诊'],['in_progress','解决中'],['blocked','有卡点'],['ready_for_review','待验收'],['resolved','已解决']]){const count=items.filter(i=>v==='all'||i.status===v).length;const b=button(`${t} ${count}`,'filter'+(filter===v?' selected':''),()=>{filter=v;render();});b.setAttribute('aria-pressed',String(filter===v));b.dataset.focusKey='filter:'+v;filters.append(b);}bar.append(filters);main.append(bar);
  const visible=items.filter(i=>filter==='all'||i.status===filter);const rows=el('div','issues-list');visible.forEach(i=>rows.append(issueRow(i)));main.append(rows);if(!visible.length)main.append(empty('这里没有问题','试试其他状态，或切换到全部问题。'));
 }
 function render(){
  if(disposed)return;
  const active=doc.activeElement as HTMLElement;const focusKey=main.contains(active)?active.dataset.focusKey:undefined;
  const p=snapshot?.project;sync.textContent=selected?'同步项目':'连接项目';sync.disabled=syncing;
  const previous=picker.value;picker.replaceChildren();const blank=el('option','','选择 Codex 项目');blank.value='';picker.append(blank);for(const project of snapshot?.catalog??[]){const o=el('option','',project.name);o.value=project.id;picker.append(o);}picker.value=selected??previous;picker.disabled=!snapshot?.catalog.length;
  for(const [key,b] of navButtons){b.className='nav-item'+(tab===key?' active':'');b.setAttribute('aria-current',tab===key?'page':'false');}
  main.replaceChildren();
  if(!snapshot){main.append(empty('正在连接工作台','读取项目目录与已同步的进展。'));return;}
  if(!selected){main.append(empty(snapshot.catalog.length?'选择一个项目，聚焦重要进展。':'把你的项目，带到这里。',snapshot.catalog.length?'使用顶部项目选择器查看待验收、里程碑和问题。':'连接 Codex 项目目录后，选择你想关注的项目。'));main.append(button(snapshot.catalog.length?'更新项目目录':'连接 Codex 项目','button primary empty-action',()=>void requestSync(true)));return;}
  if(!p){main.append(empty('这个项目还没有进展快照','点击同步项目，从所选项目的聊天中整理目标、卡点、待验收和用户问题。'));main.append(button('同步这个项目','button primary empty-action',()=>void requestSync()));return;}
  if(tab==='focus')focusPage(p);else if(tab==='project')projectPage(p);else issuesPage(p);
  if(focusKey)Array.from(main.querySelectorAll<HTMLElement>('[data-focus-key]')).find(n=>n.dataset.focusKey===focusKey)?.focus({preventScroll:true});
 }
 async function requestSync(catalogOnly=false){
  if(syncing)return;const projectId=catalogOnly?undefined:selected;
  const prompt=projectId?`使用 project-desk 技能同步我选择的 Codex 项目，projectId=${JSON.stringify(projectId)}。先读取当前工作台与宿主项目目录，只读取该项目所属聊天。整理我需要验收的事项、我提出的问题和目标里程碑；保留卡点、负责聊天及证据，不把 Agent 子任务当作项目里程碑。只更新工作台投影，不给其他聊天发消息，不执行项目工作。`:'使用 project-desk 技能连接或更新 Codex 项目目录：调用宿主 list_projects，并同步到工作台目录。仅列出项目元数据，不读取项目聊天内容。';
  if(!host.requestSync){showSyncFallback(prompt);return;}
  syncing=true;sync.disabled=true;say('正在把同步请求发送到当前聊天…');
  try{await host.requestSync(prompt);say('同步请求已发送到当前聊天。完成后，视图会自动读取更新。');}catch{showSyncFallback(prompt,true);}finally{syncing=false;sync.disabled=false;}
 }
 function showSyncFallback(prompt:string,uncertain=false){say(uncertain?'未能确认同步请求是否送达。请先查看当前聊天；若未收到，再复制下面的内容：':'此宿主不支持直接请求同步。复制下面的内容到当前 Codex 聊天：');const field=el('textarea','sync-prompt');field.value=prompt;field.readOnly=true;field.setAttribute('aria-label','项目同步提示词');notice.append(field);}
 async function read(){
  // A selection made during a read is handled serially; old-project data never renders.
  for(let attempt=0;attempt<5;attempt++){
   const target=selected;const data=await host.refresh(target);if(disposed)return Date.now();if(target!==selected)continue;
   if(data.selectedProjectId!==(target??null))throw Error('项目响应与所选项目不匹配');
   if(guard(data)){
    const changed=!snapshot||snapshot.catalogRevision!==data.catalogRevision||snapshot.selectedProjectId!==data.selectedProjectId||snapshot.project?.sha256!==data.project?.sha256||snapshot.project?.revision!==data.project?.revision;
    snapshot=data;if(changed){render();if(dialog.open)paintDetail();}
   }return Date.now();
  }throw Error('项目切换过快，请稍后刷新');
 }
 const loop=createRefreshLoop(read,state=>{
  refresh.disabled=state.busy;refresh.textContent=state.busy?'读取中…':'刷新视图';
  const p=snapshot?.project;freshness.textContent=p?`进展同步于 ${date(p.syncedAt)} · ${state.error?'读取失败，保留上次内容':state.stale?'视图等待刷新':'视图每 30 秒刷新'}`:state.error?'读取失败，请重试':'只展示所选项目';
  if(state.error)say(state.error,true);else if(!state.busy&&state.lastSuccessAt&&notice.classList.contains('error'))say('');
 });
 picker.addEventListener('change',()=>{selected=picker.value||undefined;detailKey=null;dialog.close?.();snapshot=snapshot?{...snapshot,project:null,selectedProjectId:selected??null}:null;render();void loop.refresh();});
 let unbind:(()=>void)|undefined;
 render();
 return {start(){if(!unbind)unbind=bindVisibility(doc,win,loop);},hostTheme(value:Theme|undefined){theme.host(value);},fail(message:string){say(message,true);},dispose(){disposed=true;unbind?.();loop.stop();theme.dispose();},refresh:()=>loop.refresh(),getSnapshot:()=>snapshot};
}
