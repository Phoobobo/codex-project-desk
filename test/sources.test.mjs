import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,lstat,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DeskStore} from '../src/store.ts';
import {projectDocumentSchema} from '../src/model.ts';
import {projectDesk} from '../src/projection.ts';
import {catalog,document,emptyDocument} from './fixture.mjs';
async function setup(t){const directory=await mkdtemp(path.join(tmpdir(),'project-desk-store-'));t.after(()=>rm(directory,{recursive:true,force:true}));return new DeskStore(directory);}
test('selection isolation, private files, CAS and evidence-based metrics',async t=>{
 const store=await setup(t);assert.deepEqual((await store.read()).catalog,[]);
 await store.syncCatalog({expectedRevision:0,projects:catalog});await store.syncProject({projectId:catalog[0].id,expectedRevision:0,document});await store.syncProject({projectId:catalog[1].id,expectedRevision:0,document:emptyDocument});
 const catalogOnly=await store.read();assert.equal(catalogOnly.record,null);assert.equal(catalogOnly.selectedProjectId,null);
 const first=projectDesk(await store.read(catalog[0].id));assert.equal(first.project.metrics.accepted,2);assert.equal(first.project.metrics.total,6);assert.equal(first.project.metrics.reportedOpen,4);assert.equal(first.project.metrics.blocked,1);
 const second=projectDesk(await store.read(catalog[1].id));assert.equal(second.project.goal,emptyDocument.goal);assert.doesNotMatch(JSON.stringify(second),/冲突处理/);
 assert.equal((await lstat(path.join(store.directory,'state.json'))).mode&0o777,0o600);
 await assert.rejects(store.syncCatalog({expectedRevision:0,projects:catalog}),/CONFLICT/);
 await assert.rejects(store.syncProject({projectId:catalog[0].id,expectedRevision:0,document}),/CONFLICT/);
 await assert.rejects(store.read('not-in-catalog'),/PROJECT_NOT_IN_CATALOG/);
});
test('code completion cannot become acceptance; verification needs a source reference',()=>{
 const bad=structuredClone(document);bad.milestones[0].evidence=[{kind:'progress',summary:'Tests passed',observedAt:document.observedAt}];assert.equal(projectDocumentSchema.safeParse(bad).success,false);
 const noRef=structuredClone(document);noRef.milestones[0].evidence[0].thread=undefined;assert.equal(projectDocumentSchema.safeParse(noRef).success,false);
 const resolved=structuredClone(document);resolved.issues[2].evidence=[{kind:'verification',summary:'It works',observedAt:document.observedAt}];assert.equal(projectDocumentSchema.safeParse(resolved).success,false);
 const blocked=structuredClone(document);blocked.milestones[3].blockers=[];assert.equal(projectDocumentSchema.safeParse(blocked).success,false);
 const unsafe=structuredClone(document);unsafe.issues[0].evidence[0].url='javascript:alert(1)';assert.equal(projectDocumentSchema.safeParse(unsafe).success,false);
 const unknown=structuredClone(document);unknown.milestones[2].state='unknown';assert.equal(projectDocumentSchema.safeParse(unknown).success,true);
});
test('older observations and unreasoned reopening preserve the stored state',async t=>{
 const store=await setup(t);await store.syncCatalog({expectedRevision:0,projects:catalog});await store.syncProject({projectId:catalog[0].id,expectedRevision:0,document});
 const previous=await readFile(path.join(store.directory,'state.json'),'utf8');
 const older={...document,observedAt:'2020-01-01T00:00:00Z'};await assert.rejects(store.syncProject({projectId:catalog[0].id,expectedRevision:1,document:older}),/OLDER_OBSERVATION/);
 const reopened=structuredClone(document);reopened.milestones[0].state='active';await assert.rejects(store.syncProject({projectId:catalog[0].id,expectedRevision:1,document:reopened}),/REOPENING_REQUIRES/);assert.equal(await readFile(path.join(store.directory,'state.json'),'utf8'),previous);
 reopened.correctionReason='The user reopened the capture milestone after reproducing data loss.';await store.syncProject({projectId:catalog[0].id,expectedRevision:1,document:reopened});assert.equal((await store.read(catalog[0].id)).record.revision,2);
});
test('concurrent writers do not lose updates; corrupt and symlink stores fail closed',async t=>{
 const store=await setup(t);const results=await Promise.allSettled([store.syncCatalog({expectedRevision:0,projects:catalog}),store.syncCatalog({expectedRevision:0,projects:catalog})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await store.read()).catalogRevision,1);
 await store.syncProject({projectId:catalog[0].id,expectedRevision:0,document});const file=path.join(store.directory,'state.json');const raw=JSON.parse(await readFile(file,'utf8'));raw.snapshots[catalog[0].id].document.goal='changed without hash';await writeFile(file,JSON.stringify(raw));await assert.rejects(store.read(),/STORE_HASH_MISMATCH/);
 await rm(file);await symlink(path.join(store.directory,'missing'),file);await assert.rejects(store.read(),/STORE_FILE_INVALID/);
});
