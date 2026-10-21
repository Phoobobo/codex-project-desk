import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createRefreshLoop,createSnapshotGuard,bindVisibility,POLL_MS,MAX_BACKOFF_MS} from '../src/refresh.ts';

const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function fakeClock(){
 let now=1_000_000,id=0;const jobs=new Map();
 return {now:()=>now,set:(fn,ms)=>{const key=++id;jobs.set(key,{fn,at:now+ms});return key;},clear:id=>jobs.delete(id),count:()=>jobs.size,
  async advance(ms){const end=now+ms;let count=0;while(true){const next=[...jobs].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;assert.ok(++count<1000,'timer busy loop');now=next[1].at;jobs.delete(next[0]);next[1].fn();await flush();}now=end;await flush();}};
}
test('initial/return reads, visible polling, duplicate events and hidden pause share one flight',async()=>{
 const time=fakeClock();let calls=0,release;let deferred=false;const states=[];
 const loop=createRefreshLoop(async()=>{calls++;if(deferred)await new Promise(r=>release=r);return time.now();},s=>states.push(s),time);
 loop.start(true);loop.start(true);loop.activate();await flush();assert.equal(calls,1);
 for(let n=0;n<10;n++)loop.activate();await time.advance(POLL_MS-1);assert.equal(calls,1);
 deferred=true;await time.advance(1);assert.equal(calls,2);assert.equal(states.at(-1).busy,true);
 const one=loop.refresh(),two=loop.refresh();assert.equal(one,two);loop.visible(false);loop.visible(true);loop.activate();assert.equal(calls,2);
 release();await one;assert.equal(calls,2);deferred=false;
 loop.visible(false);assert.equal(time.count(),0);await time.advance(5*POLL_MS);assert.equal(calls,2);
 loop.visible(true);await flush();assert.equal(calls,3);assert.equal(states.at(-1).visible,true);
 loop.stop();assert.equal(time.count(),0);await time.advance(POLL_MS*2);assert.equal(calls,3);
});
test('failures back off to five minutes; focus cannot bypass backoff; manual can recover',async()=>{
 const time=fakeClock();let calls=0,fail=true;let state;
 const loop=createRefreshLoop(async()=>{calls++;if(fail)throw Error('offline');return time.now();},s=>state=s,time);
 loop.start(true);await flush();assert.equal(calls,1);assert.equal(state.lastSuccessAt,null);
 for(const delay of [30_000,60_000,120_000,240_000,MAX_BACKOFF_MS,MAX_BACKOFF_MS]){
  const count=calls;assert.equal(state.nextReadAt-time.now(),delay);
  loop.visible(false);await time.advance(1);loop.visible(true);loop.activate();await flush();assert.equal(calls,count);
  await time.advance(delay-2);assert.equal(calls,count);await time.advance(1);assert.equal(calls,count+1);
 }
 fail=false;await time.advance(2_000);await loop.refresh();assert.equal(state.failures,0);assert.equal(state.error,'');assert.equal(state.lastSuccessAt,time.now());assert.equal(state.nextReadAt-time.now(),POLL_MS);loop.stop();
});
test('staleness updates during backoff and stopping ignores pending completion',async()=>{
 const time=fakeClock();let fail=false;let state;
 const loop=createRefreshLoop(async()=>{if(fail)throw Error('read failed');return time.now();},s=>state=s,time);
 loop.start(true);await flush();const success=state.lastSuccessAt;fail=true;
 await time.advance(60_000);assert.equal(state.stale,true);assert.equal(state.lastSuccessAt,success);assert.equal(state.failures,2);
 loop.stop();assert.equal(time.count(),0);
 let done;let reports=0;const pending=createRefreshLoop(()=>new Promise(r=>done=r),()=>reports++,time);
 pending.start(true);await flush();pending.stop();const prior=reports;done(time.now());await flush();assert.equal(reports,prior);assert.equal(time.count(),0);
});
test('document visibility, page lifecycle, focus and iframe intersection events are bound and cleaned up',async()=>{
 const dom=new JSDOM('',{pretendToBeVisual:true});let visible='visible',intersection,disconnected=false;
 Object.defineProperty(dom.window.document,'visibilityState',{get:()=>visible});
 dom.window.IntersectionObserver=class{constructor(cb){intersection=cb;}observe(){}disconnect(){disconnected=true;}};
 const time=fakeClock();let calls=0;const loop=createRefreshLoop(async()=>{calls++;return time.now();},()=>{},time);
 const dispose=bindVisibility(dom.window.document,dom.window,loop);await flush();assert.equal(calls,1);
 intersection([{isIntersecting:false}]);await time.advance(60_000);assert.equal(calls,1);
 intersection([{isIntersecting:true}]);await flush();assert.equal(calls,2);
 visible='hidden';dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'));await time.advance(60_000);assert.equal(calls,2);
 visible='visible';dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'));dom.window.dispatchEvent(new dom.window.Event('focus'));await flush();assert.equal(calls,3);
 dom.window.dispatchEvent(new dom.window.Event('pagehide'));await time.advance(60_000);assert.equal(calls,3);
 dom.window.dispatchEvent(new dom.window.Event('pageshow'));await flush();assert.equal(calls,4);
 dispose();assert.equal(disconnected,true);assert.equal(time.count(),0);dom.window.dispatchEvent(new dom.window.Event('focus'));await flush();assert.equal(calls,4);dom.window.close();
});
const snap=(revision,hash,sequence,id='aurora-notes')=>({schema:'project-desk.snapshot.v1',observedAt:new Date().toISOString(),catalogRevision:1,catalog:[{id:'aurora-notes'},{id:'field-atlas'}],selectedProjectId:id,reader:{instance:'one',sequence},project:{id,revision,sha256:hash}});
test('late replies, per-project rollback and catalog conflicts retain newer data',()=>{
 const accept=createSnapshotGuard();const latest=snap(13,'r13',2);assert.equal(accept(latest),true);assert.equal(accept(structuredClone(latest)),false);
 assert.throws(()=>accept(snap(12,'r12',1)),/较旧读取/);assert.throws(()=>accept(snap(12,'r12',3)),/版本倒退/);assert.throws(()=>accept(snap(13,'different',3)),/冲突/);
 assert.equal(accept(snap(1,'b1',4,'field-atlas')),true);assert.throws(()=>accept(snap(12,'r12',5)),/版本倒退/);
 assert.equal(accept(snap(14,'r14',6)),true);assert.throws(()=>accept({...snap(14,'r14',7),catalog:[]}),/目录版本冲突/);
 const missing={...snap(14,'r14',8),project:null};assert.equal(accept(missing),true);assert.throws(()=>accept(snap(13,'r13',9)),/版本倒退/);
});
