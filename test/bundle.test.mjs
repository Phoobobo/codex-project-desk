import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,copyFile,rm,cp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {catalog,document} from './fixture.mjs';
import {UI_URI} from '../src/server.ts';
test('self-contained bundle initializes and syncs without node_modules or a repository',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'project-desk-bundle-'));t.after(()=>rm(root,{recursive:true,force:true}));await cp('dist/engines',path.join(root,'engines'),{recursive:true});for(const file of ['server.mjs','desk.html','engine-release.json'])await copyFile('dist/'+file,path.join(root,file));
 const transport=new StdioClientTransport({command:process.execPath,args:[path.join(root,'server.mjs'),'--data-dir',path.join(root,'private-data')],cwd:root,stderr:'pipe'});const client=new Client({name:'bundle-test',version:'1'});await client.connect(transport);t.after(()=>client.close());
 const resource=await client.readResource({uri:UI_URI});assert.match(resource.contents[0].text,/ui\/initialize/);assert.match(resource.contents[0].text,/项目工作台/);
 const call=(name,arguments_)=>client.callTool({name,arguments:arguments_});await call('sync_project_catalog',{expectedRevision:0,projects:catalog});await call('sync_project_snapshot',{projectId:catalog[0].id,expectedRevision:0,document});
 const result=await call('read_project_desk',{projectId:catalog[0].id});assert.ok(!result.isError);assert.equal(result.structuredContent.project.metrics.accepted,2);assert.equal(result.structuredContent.engine.version,'2.0.0');
});
