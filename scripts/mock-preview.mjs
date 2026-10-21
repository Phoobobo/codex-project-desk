// Public fictional browser fixture. Never connects to the real host or reads chats.
import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {catalog,document,emptyDocument} from '../test/fixture.mjs';
await mkdir('output/preview',{recursive:true});
const code=await build({stdin:{contents:`import {mount} from './src/view.ts';import {projectDesk} from './src/projection.ts';
const catalog=${JSON.stringify(catalog)},document=${JSON.stringify(document)},emptyDocument=${JSON.stringify(emptyDocument)};
let sequence=0;window.fixtureEvents=[];window.fixtureOffline=false;
const view=mount(window.document.getElementById('app'),{refresh:async(projectId)=>{if(window.fixtureOffline)throw Error('模拟读取失败');return {...projectDesk({catalogRevision:1,catalog,selectedProjectId:projectId||null,record:projectId?{revision:1,sha256:projectId==='aurora-notes'?'a'.repeat(64):'b'.repeat(64),syncedAt:document.observedAt,document:projectId==='aurora-notes'?document:emptyDocument}:null}),reader:{instance:'fixture',sequence:++sequence}};},openLink:async url=>{window.fixtureEvents.push({type:'openLink',url});},requestSync:async prompt=>{window.fixtureEvents.push({type:'requestSync',prompt});}});
window.fixtureView=view;view.start();`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'iife',minify:true,loader:{'.png':'dataurl'}});
const css=await readFile('src/style.css','utf8');
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Project Desk · Fictional demo</title><style>${css}</style></head><body><div id="app"></div><script>${code.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></body></html>`;
await writeFile('output/preview/index.html',html);console.log(path.resolve('output/preview/index.html'));
