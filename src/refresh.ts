// One visible-page read loop. No persistence, source writes, or chat subscription.
export const POLL_MS = 30_000;
export const MIN_READ_MS = 2_000;
export const STALE_MS = 60_000;
export const MAX_BACKOFF_MS = 300_000;
export type RefreshState = {ready:boolean; visible:boolean; busy:boolean; lastSuccessAt:number|null; nextReadAt:number|null; failures:number; error:string; stale:boolean};
type Clock = {now:()=>number; set:(fn:()=>void,ms:number)=>unknown; clear:(id:unknown)=>void};
const clock:Clock = {now:()=>Date.now(),set:(fn,ms)=>setTimeout(fn,ms),clear:id=>clearTimeout(id as ReturnType<typeof setTimeout>)};

export function createRefreshLoop(read:()=>Promise<number>, report:(state:RefreshState)=>void, time:Clock=clock) {
  const state:RefreshState={ready:false,visible:false,busy:false,lastSuccessAt:null,nextReadAt:null,failures:0,error:'',stale:false};
  let timer:unknown=null, flight:Promise<void>|null=null, lastAttempt=-Infinity, stopped=false;
  const emit=()=>{state.stale=state.lastSuccessAt!==null && time.now()-state.lastSuccessAt>=STALE_MS;report({...state});};
  const cancel=()=>{if(timer!==null)time.clear(timer);timer=null;};
  function schedule(){
    cancel(); if(stopped||!state.ready||!state.visible||state.busy||state.nextReadAt===null)return;
    const staleAt=state.lastSuccessAt===null||state.stale?Infinity:state.lastSuccessAt+STALE_MS;
    const at=Math.min(state.nextReadAt,staleAt);
    timer=time.set(()=>{timer=null;emit();if(state.nextReadAt!==null&&time.now()>=state.nextReadAt)void refresh();else schedule();},Math.max(0,at-time.now()));
  }
  function refresh(manual=false):Promise<void>{
    if(stopped||!state.ready||!state.visible)return Promise.resolve();
    if(flight)return flight;
    const earliest=Math.max(lastAttempt+MIN_READ_MS,manual||!state.failures?-Infinity:state.nextReadAt??-Infinity);
    if(time.now()<earliest){if(manual)state.nextReadAt=earliest;emit();schedule();return Promise.resolve();}
    cancel();lastAttempt=time.now();state.busy=true;emit();
    // Defer the read one microtask so reentrant events always see the same flight.
    flight=Promise.resolve().then(read).then(at=>{
      if(stopped)return;state.lastSuccessAt=at;state.failures=0;state.error='';state.nextReadAt=time.now()+POLL_MS;
    },error=>{
      if(stopped)return;state.failures++;state.error=error instanceof Error?error.message:'读取失败';state.nextReadAt=time.now()+Math.min(MAX_BACKOFF_MS,POLL_MS*2**Math.min(state.failures-1,4));
    }).finally(()=>{flight=null;if(stopped)return;state.busy=false;emit();schedule();});
    return flight;
  }
  function visible(value:boolean){
    if(stopped)return;const changed=state.visible!==value;state.visible=value;emit();
    if(!value){cancel();return;}
    if(changed&&state.ready)void refresh();else schedule();
  }
  return {
    start(value:boolean){if(stopped||state.ready)return;state.ready=true;visible(value);},
    visible,
    activate(){if(state.visible)void refresh();},
    refresh:()=>refresh(true),
    stop(){stopped=true;cancel();},
  };
}

type Obj=Record<string,any>;
export function createSnapshotGuard(){
 let latest:Obj|null=null;const projects=new Map<string,{revision:number;sha256:string}>();let catalogRevision=-1;let catalogHash='';
 return(value:Obj)=>{
  if(value?.schema!=='project-desk.snapshot.v1'||!Array.isArray(value.catalog)||!Number.isFinite(Date.parse(value.observedAt))||!Number.isSafeInteger(value.catalogRevision))throw Error('快照格式不支持');
  if(latest?.reader?.instance===value.reader?.instance&&value.reader&&latest?.reader){
   if(value.reader.sequence<latest.reader.sequence)throw Error('已忽略较旧读取结果');
   if(value.reader.sequence===latest.reader.sequence){if(JSON.stringify(value)===JSON.stringify(latest))return false;throw Error('读取序号冲突');}
  }
  const nextCatalogHash=JSON.stringify(value.catalog);
  if(value.catalogRevision<catalogRevision||(value.catalogRevision===catalogRevision&&catalogHash!==nextCatalogHash))throw Error('项目目录版本冲突');
  if(value.project){const p=value.project;if(p.id!==value.selectedProjectId||!Number.isSafeInteger(p.revision)||typeof p.sha256!=='string')throw Error('项目内容无效');const old=projects.get(p.id);if(old&&(p.revision<old.revision||(p.revision===old.revision&&p.sha256!==old.sha256)))throw Error('项目版本倒退或冲突');projects.set(p.id,{revision:p.revision,sha256:p.sha256});}
  latest=value;catalogRevision=value.catalogRevision;catalogHash=nextCatalogHash;return true;
 };
}

export function bindVisibility(doc:Document,win:Window,loop:ReturnType<typeof createRefreshLoop>){
  let intersecting=true;
  const change=()=>loop.visible(doc.visibilityState==='visible'&&intersecting);
  const focus=()=>{change();loop.activate();};
  const hide=()=>loop.visible(false);
  doc.addEventListener('visibilitychange',change);win.addEventListener('focus',focus);win.addEventListener('pageshow',focus);win.addEventListener('pagehide',hide);
  const Observer=(win as Window & {IntersectionObserver?:typeof IntersectionObserver}).IntersectionObserver;
  const observer=Observer?new Observer(entries=>{intersecting=entries.some(entry=>entry.isIntersecting);change();}):null;
  observer?.observe(doc.documentElement);
  loop.start(doc.visibilityState==='visible');
  return ()=>{observer?.disconnect();doc.removeEventListener('visibilitychange',change);win.removeEventListener('focus',focus);win.removeEventListener('pageshow',focus);win.removeEventListener('pagehide',hide);loop.stop();};
}
