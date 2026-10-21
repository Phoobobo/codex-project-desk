import {build as esbuild} from 'esbuild';
import {coreHashes,digest} from './engine-release.mjs';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
// Keep dependency labels relative to this package even with a shared install.
const build=options=>esbuild({preserveSymlinks:true,...options});
await mkdir('dist',{recursive:true});
const ui=await build({entryPoints:['src/ui.ts'],bundle:true,write:false,format:'iife',platform:'browser',loader:{'.png':'dataurl'},target:'es2022',minify:true,metafile:true});
const css=await readFile('src/style.css','utf8');
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>项目工作台</title><style>${css}</style></head><body><div id="app"></div><script>${ui.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></body></html>`;
await writeFile('dist/desk.html',html);
const server=await build({entryPoints:['src/server.ts'],outfile:'dist/server.mjs',bundle:true,platform:'node',format:'esm',target:'node22',metafile:true,banner:{js:'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);'}});

const packages=new Set([...Object.keys(ui.metafile.inputs),...Object.keys(server.metafile.inputs)].flatMap(file=>{const m=file.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//);return m?[m[1]]:[];}));
const notices=[];
for(const dir of [...packages].sort()){
  const pkg=JSON.parse(await readFile(dir+'/package.json','utf8'));
  const files=(await readdir(dir)).filter(f=>/^(license|copying|notice)(\.|$)/i.test(f));
  if(!files.length)throw Error(`Missing third-party license: ${pkg.name}`);
  notices.push(`${pkg.name}@${pkg.version} (${pkg.license})\n`+(await Promise.all(files.map(f=>readFile(dir+'/'+f,'utf8')))).join('\n'));
}
await writeFile('dist/THIRD-PARTY-NOTICES.txt',notices.join('\n\n---\n\n'));
const engine=await build({entryPoints:['src/engine.ts'],bundle:true,write:false,platform:'node',format:'esm',target:'node22'});
const engineBytes=engine.outputFiles[0].contents;
const engineHash=digest(engineBytes);
const engineVersion=(await readFile('src/engine-version.ts','utf8')).match(/ENGINE_VERSION = '([^']+)'/)[1];
await mkdir('dist/engines',{recursive:true});
await writeFile('dist/engines/'+engineHash+'.mjs',engineBytes);
await writeFile('dist/engine-release.json',JSON.stringify({abi:'project-desk.reader.v1',version:engineVersion,sha256:engineHash,core:await coreHashes('.')},null,2)+'\n');
console.log('Built stable stdio broker, UI and separately versioned read engine (no listener).');
