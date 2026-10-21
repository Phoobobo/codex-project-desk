import {readFile,writeFile,mkdir,copyFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const {version}=JSON.parse(await readFile('package.json','utf8'));
const base='output/package/'+version,stage=base+'/codex-project-desk';
const sourceFiles=execFileSync('git',['ls-files'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const engine=JSON.parse(await readFile('dist/engine-release.json','utf8'));
const files=[...sourceFiles,'dist/server.mjs','dist/desk.html','dist/THIRD-PARTY-NOTICES.txt','dist/engine-release.json','dist/engines/'+engine.sha256+'.mjs'];
await rm(stage,{recursive:true,force:true});
await mkdir(stage,{recursive:true});
const hashes=[];
for(const file of files){await mkdir(path.dirname(stage+'/'+file),{recursive:true});await copyFile(file,stage+'/'+file);const b=await readFile(file);hashes.push({file,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')});}
await writeFile(stage+'/FILES.sha256',hashes.map(f=>f.sha256+'  '+f.file).join('\n')+'\n');
const zip=path.resolve(base,`codex-project-desk-${version}.zip`);
// Python's stdlib writes a deterministic archive; no install, network or publishing.
execFileSync('python3',['-c',`import pathlib,zipfile,sys
root=pathlib.Path(sys.argv[1]);out=sys.argv[2]
with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED) as z:
 for p in sorted(root.rglob('*')):
  if p.is_file():
   i=zipfile.ZipInfo('codex-project-desk/'+str(p.relative_to(root)),(2026,10,21,0,0,0));i.external_attr=0o100644<<16;i.compress_type=zipfile.ZIP_DEFLATED;z.writestr(i,p.read_bytes())
`,stage,zip]);
const bytes=await readFile(zip);
const manifest={name:'codex-project-desk',version,kind:'local-review-candidate',installed:false,published:false,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceDirty:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()!=='',zip:path.basename(zip),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),files:hashes,hostVerification:'NOT_VERIFIED_BY_PACKAGING'};
await writeFile(base+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({zip,sha256:manifest.sha256,bytes:manifest.bytes}));
