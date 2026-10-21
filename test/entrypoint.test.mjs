import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {createServer,UI_URI} from '../src/server.ts';
import {DeskStore} from '../src/store.ts';
import {projectDesk} from '../src/projection.ts';
import {catalog,document} from './fixture.mjs';
test('MCP separates visible reads from model-only CAS writes and supports project discovery',async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'project-desk-mcp-'));t.after(()=>rm(directory,{recursive:true,force:true}));const server=createServer('<!doctype html><title>Project Desk</title>',new DeskStore(directory),async input=>projectDesk(input));const client=new Client({name:'test',version:'1'});const [a,b]=InMemoryTransport.createLinkedPair();await Promise.all([server.connect(a),client.connect(b)]);t.after(async()=>{await client.close();await server.close();});
 const {tools}=await client.listTools();assert.equal(tools.length,4);
 const entry=tools.find(t=>t.name==='open_project_desk');assert.deepEqual(entry._meta['openai/ui'].entrypoints,[{type:'global'},{type:'thread'}]);
 for(const name of ['sync_project_catalog','sync_project_snapshot']){const tool=tools.find(t=>t.name===name);assert.deepEqual(tool._meta.ui.visibility,['model']);assert.equal(tool.annotations.readOnlyHint,false);}
 assert.deepEqual(tools.find(t=>t.name==='read_project_desk')._meta.ui.visibility,['model','app']);
 const resource=await client.readResource({uri:UI_URI});assert.deepEqual(resource.contents[0]._meta.ui.csp.connectDomains,[]);
 const call=(name,args={})=>client.callTool({name,arguments:args});assert.equal((await call('read_project_desk')).structuredContent.catalogRevision,0);
 assert.ok(!(await call('sync_project_catalog',{expectedRevision:0,projects:catalog})).isError);assert.ok(!(await call('sync_project_snapshot',{projectId:catalog[0].id,expectedRevision:0,document})).isError);
 const read=(await call('read_project_desk',{projectId:catalog[0].id})).structuredContent;assert.equal(read.project.revision,1);assert.equal(read.project.metrics.accepted,2);assert.equal(read.pluginVersion,'0.2.0');
 const conflict=await call('sync_project_snapshot',{projectId:catalog[0].id,expectedRevision:0,document});assert.equal(conflict.isError,true);assert.match(conflict.content[0].text,/CONFLICT/);
 assert.equal((await call('read_project_desk')).structuredContent.project,null);assert.equal((await call('approve')).isError,true);
});
