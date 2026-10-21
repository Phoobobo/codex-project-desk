import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,copyFile,cp,rm,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {build} from 'esbuild';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {createHotReader} from '../src/hot-reader.ts';
import {DeskStore} from '../src/store.ts';
import {publishEngine,coreHashes,digest} from '../scripts/engine-release.mjs';
import {catalog,document} from './fixture.mjs';
import {UI_URI} from '../src/server.ts';
const ABI='project-desk.reader.v1';
async function setup(t){
 const base=await mkdtemp(path.join(tmpdir(),'project-desk-hot-'));t.after(()=>rm(base,{recursive:true,force:true}));const root=path.join(base,'installed');await mkdir(path.join(root,'dist/engines'),{recursive:true});const release=JSON.parse(await readFile('dist/engine-release.json','utf8'));
 for(const file of ['server.mjs','desk.html','THIRD-PARTY-NOTICES.txt'])await copyFile('dist/'+file,path.join(root,'dist',file));await mkdir(path.join(root,'skills/project-desk'),{recursive:true});for(const file of ['mcp.json','plugin.json','skills/project-desk/SKILL.md'])await copyFile(file,path.join(root,file));await copyFile('dist/engines/'+release.sha256+'.mjs',path.join(root,'dist/engines',release.sha256+'.mjs'));release.core=await coreHashes(root);await writeFile(path.join(root,'dist/engine-release.json'),JSON.stringify(release));
 const store=new DeskStore(path.join(base,'private-data'));await store.syncCatalog({expectedRevision:0,projects:catalog});await store.syncProject({projectId:catalog[0].id,expectedRevision:0,document});return {root,base,store,release,input:await store.read(catalog[0].id)};
}
async function candidate(root,base,version,mutate="snapshot.project.nextCheckpoint+=' / hot logic'"){
 const dir=path.join(base,version);await cp(root,dir,{recursive:true});const code=`import {parentPort,workerData} from 'node:worker_threads';import {projectDesk} from './src/projection.ts';const snapshot=projectDesk(workerData);${mutate};parentPort.postMessage({abi:${JSON.stringify(ABI)},version:${JSON.stringify(version)},snapshot});`;
 const bundle=await build({stdin:{contents:code,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',target:'node22'});const bytes=bundle.outputFiles[0].contents;const release={abi:ABI,version,sha256:digest(bytes),core:await coreHashes(root)};await writeFile(path.join(dir,'dist/engines',release.sha256+'.mjs'),bytes);await writeFile(path.join(dir,'dist/engine-release.json'),JSON.stringify(release));return {dir,release};
}
async function pointer(root,release){const file=path.join(root,'dist/engine-release.json');await writeFile(file+'.tmp',JSON.stringify(release));await rename(file+'.tmp',file);}
test('live stdio keeps its connection and UI through reader update, rollback and invalid release',async t=>{
 const {root,base,store,release}=await setup(t);const original=path.join(base,'original');await cp(root,original,{recursive:true});const next=await candidate(root,base,'2.0.1');const sourceBefore=await readFile(path.join(store.directory,'state.json'),'utf8');
 const transport=new StdioClientTransport({command:process.execPath,args:[path.join(root,'dist/server.mjs'),'--data-dir',store.directory],cwd:root,stderr:'pipe'});const client=new Client({name:'hot-test',version:'1'});await client.connect(transport);t.after(()=>client.close());const pid=transport.pid;const tools=await client.listTools();const html=await client.readResource({uri:UI_URI});const read=()=>client.callTool({name:'read_project_desk',arguments:{projectId:catalog[0].id}});
 const first=(await read()).structuredContent;assert.equal(first.engine.version,'2.0.0');await publishEngine(next.dir,root,release.sha256);const second=(await read()).structuredContent;assert.equal(second.engine.version,'2.0.1');assert.match(second.project.nextCheckpoint,/hot logic/);assert.equal(second.reader.instance,first.reader.instance);assert.equal(transport.pid,pid);assert.deepEqual(await client.listTools(),tools);assert.deepEqual(await client.readResource({uri:UI_URI}),html);
 await assert.rejects(publishEngine(original,root,release.sha256),/changed since inspection/);await pointer(root,{...next.release,sha256:'f'.repeat(64)});assert.equal((await read()).isError,true);assert.equal(JSON.parse(await readFile(path.join(root,'dist/engine-release.json'))).sha256,'f'.repeat(64));await pointer(root,next.release);await publishEngine(original,root,next.release.sha256);const rolled=(await read()).structuredContent;assert.equal(rolled.engine.version,'2.0.0');assert.doesNotMatch(rolled.project.nextCheckpoint,/hot logic/);assert.equal(await readFile(path.join(store.directory,'state.json'),'utf8'),sourceBefore);
});
test('publisher rejects corrupted bytes, core/UI changes, ABI changes and stale writers',async t=>{
 const {root,base,release}=await setup(t);const next=await candidate(root,base,'2.0.1');const file=path.join(next.dir,'dist/engines',next.release.sha256+'.mjs');const bytes=await readFile(file);await writeFile(file,'invalid');await assert.rejects(publishEngine(next.dir,root,release.sha256),/hash mismatch/);await writeFile(file,bytes);
 for(const name of ['dist/desk.html','mcp.json','plugin.json']){const original=await readFile(path.join(next.dir,name));await writeFile(path.join(next.dir,name),'changed');await assert.rejects(publishEngine(next.dir,root,release.sha256),/full plugin update/);await writeFile(path.join(next.dir,name),original);}
 await pointer(next.dir,{...next.release,abi:'different.v2'});await assert.rejects(publishEngine(next.dir,root,release.sha256),/Invalid engine release/);await pointer(next.dir,next.release);await assert.rejects(publishEngine(next.dir,root,'0'.repeat(64)),/changed since inspection/);
});
test('hung, failed and out-of-scope engines fail without automatic fallback',async t=>{
 const {root,input,release}=await setup(t);const read=createHotReader(path.join(root,'dist'),100);
 async function install(code){const bytes=Buffer.from(code),sha256=digest(bytes);await writeFile(path.join(root,'dist/engines',sha256+'.mjs'),bytes);await pointer(root,{...release,sha256});}
 await install('setInterval(()=>{},1000)');await assert.rejects(read(input),/ENGINE_TIMEOUT/);await install('throw Error("private detail")');await assert.rejects(read(input),/ENGINE_FAILED/);
 await install(`import {parentPort,workerData} from 'node:worker_threads';console.log('not MCP stdout');parentPort.postMessage({abi:${JSON.stringify(ABI)},version:'2.0.0',snapshot:{schema:'project-desk.snapshot.v1',observedAt:new Date().toISOString(),catalogRevision:workerData.catalogRevision,catalog:workerData.catalog,selectedProjectId:'another-project',project:null}});`);await assert.rejects(read(input),/ENGINE_SCOPE_INVALID/);
 await pointer(root,release);assert.equal((await createHotReader(path.join(root,'dist'))(input)).engine.version,'2.0.0');
});
