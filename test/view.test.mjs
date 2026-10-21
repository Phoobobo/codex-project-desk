import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {projectDesk} from '../src/projection.ts';
import {resolveTheme} from '../src/theme.ts';
import {catalog,document,emptyDocument,thread} from './fixture.mjs';
const bundle=await build({entryPoints:['src/view.ts'],bundle:true,write:false,format:'iife',globalName:'ProjectDesk',platform:'browser',loader:{'.png':'dataurl'}});
const flush=()=>new Promise(r=>setTimeout(r,0));
async function setup(t,options={}){
 const dom=new JSDOM('<div id="app"></div>',{pretendToBeVisual:true,runScripts:'outside-only'});let now=1000000;dom.window.Date.now=()=>now;dom.window.eval(bundle.outputFiles[0].text+'\nwindow.ProjectDesk = ProjectDesk;');const root=dom.window.document.querySelector('#app');let sequence=0;const links=[],requests=[];let failure=false;
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new dom.window.Event('close'));};
 const refresh=async projectId=>{if(failure)throw Error('read failed');const input={catalogRevision:1,catalog,selectedProjectId:projectId??null,record:projectId?{revision:1,sha256:'a'.repeat(64),syncedAt:document.observedAt,document:projectId===catalog[0].id?structuredClone(document):structuredClone(emptyDocument)}:null};options.mutate?.(input);return {...projectDesk(input),reader:{instance:'test',sequence:++sequence}};};
 const ui=dom.window.ProjectDesk.mount(root,{refresh:options.refresh??refresh,openLink:async url=>{links.push(url);if(options.linkFails)throw Error();},requestSync:options.noSync?undefined:async prompt=>requests.push(prompt)});ui.start();await ui.refresh();
 const change=async(selector,value)=>{now+=2001;const field=root.querySelector(selector);field.value=value;field.dispatchEvent(new dom.window.Event('change'));await ui.refresh();};
 t.after(()=>{ui.dispose();dom.window.close();});return {dom,root,ui,links,requests,change,tick:()=>{now+=2001;},fail:(value=true)=>failure=value};
}
test('human focus, navigation, issue status filters, owner deep links and selection',async t=>{
 const s=await setup(t);await s.change('.project-picker','aurora-notes');assert.match(s.root.textContent,/2 个关键点/);assert.doesNotMatch(s.root.textContent,/整理内部模块/);assert.equal(s.root.querySelectorAll('.attention-card').length,2);
 s.root.querySelectorAll('.nav-item')[1].click();assert.equal(s.root.querySelectorAll('.station').length,6);s.root.querySelector('.map-blocker').click();assert.match(s.root.querySelector('dialog').textContent,/卡在哪里/);assert.match(s.root.querySelector('dialog').textContent,/如何推进/);s.root.querySelector('.detail-action .primary').click();await flush();assert.match(s.links[0],/^codex:\/\/threads\/[a-f0-9-]+$/);
 s.root.querySelector('dialog').close();s.root.querySelectorAll('.nav-item')[2].click();assert.equal(s.root.querySelectorAll('.issue-row').length,5);const resolvedFilter=[...s.root.querySelectorAll('.filter')].find(n=>n.textContent.startsWith('已解决'));resolvedFilter.focus();resolvedFilter.click();assert.equal(s.dom.window.document.activeElement,s.root.querySelector('.filter.selected'));assert.equal(s.root.querySelectorAll('.issue-row').length,1);assert.match(s.root.querySelector('.issues-list').textContent,/快捷键/);
 await s.change('.project-picker','field-atlas');assert.equal(s.ui.getSnapshot().project.id,'field-atlas');assert.doesNotMatch(s.root.querySelector('main').textContent,/离线体验|冲突处理/);
});
test('unchanged refresh preserves details and focus; errors keep the selected project',async t=>{
 const s=await setup(t,{mutate:input=>{if(input.record)input.record.document.attention[0].ask='<img src=x onerror=alert(1)>';}});await s.change('.project-picker','aurora-notes');assert.match(s.root.textContent,/<img src=x/);assert.equal(s.root.querySelectorAll('img').length,1);
 s.root.querySelector('.attention-card').click();const detail=s.root.querySelector('.evidence');detail.open=true;detail.querySelector('summary').focus();s.tick();await s.ui.refresh();assert.equal(s.root.querySelector('.evidence'),detail);assert.equal(detail.open,true);assert.equal(s.dom.window.document.activeElement,detail.querySelector('summary'));
 s.fail();s.tick();await s.ui.refresh();assert.match(s.root.textContent,/读取失败/);assert.equal(s.ui.getSnapshot().project.id,'aurora-notes');assert.equal(s.root.querySelector('dialog').open,true);
 s.fail(false);s.tick();await s.ui.refresh();assert.equal(s.root.querySelector('.notice').hidden,true);assert.equal(s.root.querySelector('.evidence'),detail);
});
test('sync is explicit and scoped; unsupported host and deep-link errors have copyable fallbacks',async t=>{
 const s=await setup(t);assert.equal(s.requests.length,0);await s.change('.project-picker','aurora-notes');assert.equal(s.requests.length,0);s.root.querySelector('.header-tools button').click();await flush();assert.equal(s.requests.length,1);assert.match(s.requests[0],/projectId="aurora-notes"/);assert.match(s.requests[0],/不给其他聊天发消息/);
 const f=await setup(t,{noSync:true,linkFails:true});await f.change('.project-picker','aurora-notes');f.root.querySelector('.header-tools button').click();assert.match(f.root.querySelector('.sync-prompt').value,/aurora-notes/);f.root.querySelector('.attention-card').click();f.root.querySelector('.detail-action .primary').click();await flush();assert.equal(f.root.querySelector('.copy-field').value,'codex://threads/'+thread.id);
});
test('host theme overrides system only in auto mode; manual choice stays stable',async t=>{
 assert.equal(resolveTheme('auto',undefined,true),'dark');assert.equal(resolveTheme('auto','light',true),'light');assert.equal(resolveTheme('dark','light',false),'dark');
 const s=await setup(t);s.ui.hostTheme('dark');assert.equal(s.root.dataset.theme,'dark');await s.change('.theme-picker','light');s.ui.hostTheme('dark');assert.equal(s.root.dataset.theme,'light');await s.change('.theme-picker','auto');assert.equal(s.root.dataset.theme,'dark');
});
test('switching projects during an in-flight read cannot render the previous project',async t=>{
 let sequence=0,release;const refresh=async id=>{if(id==='aurora-notes')await new Promise(r=>release=r);return {...projectDesk({catalogRevision:1,catalog,selectedProjectId:id??null,record:id?{revision:1,sha256:'a'.repeat(64),syncedAt:document.observedAt,document:id==='aurora-notes'?document:emptyDocument}:null}),reader:{instance:'switch',sequence:++sequence}};};
 const s=await setup(t,{refresh});s.tick();const field=s.root.querySelector('.project-picker');field.value='aurora-notes';field.dispatchEvent(new s.dom.window.Event('change'));await flush();field.value='field-atlas';field.dispatchEvent(new s.dom.window.Event('change'));release();await s.ui.refresh();assert.equal(s.ui.getSnapshot().project.id,'field-atlas');assert.doesNotMatch(s.root.querySelector('main').textContent,/离线体验/);
});
