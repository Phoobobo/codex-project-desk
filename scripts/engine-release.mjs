import {readFile,writeFile,mkdir,realpath,lstat,rename,rm} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const CORE_FILES=['dist/server.mjs','dist/desk.html','dist/THIRD-PARTY-NOTICES.txt','mcp.json','plugin.json','skills/project-desk/SKILL.md'];
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function coreHashes(root){
  return Object.fromEntries(await Promise.all(CORE_FILES.map(async file=>[file,digest(await readFile(path.join(root,file)))])));
}
export async function verifyRelease(root){
  root=await realpath(root);
  const release=JSON.parse(await readFile(path.join(root,'dist/engine-release.json'),'utf8'));
  if(release.abi!=='project-desk.reader.v1'||!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(release.version)||! /^[0-9a-f]{64}$/.test(release.sha256))throw Error('Invalid engine release');
  const core=await coreHashes(root);
  if(JSON.stringify(Object.keys(release.core||{}).sort())!==JSON.stringify([...CORE_FILES].sort())||CORE_FILES.some(file=>release.core[file]!==core[file]))throw Error('Core, UI, permissions or integration metadata changed; a full plugin update is required');
  const filename=path.join(root,'dist/engines',release.sha256+'.mjs');
  if(await realpath(filename)!==filename)throw Error('Engine symlinks are not supported');
  const info=await lstat(filename);if(!info.isFile()||info.size>2_000_000)throw Error('Invalid engine file');
  const bytes=await readFile(filename);
  if(bytes.length>2_000_000||digest(bytes)!==release.sha256)throw Error('Engine hash mismatch');
  return {root,release,bytes};
}
async function immutable(file,bytes){
  try {await writeFile(file,bytes,{flag:'wx',mode:0o600});}
  catch(error){if(error.code!=='EEXIST'||!Buffer.from(await readFile(file)).equals(Buffer.from(bytes)))throw error;}
}

// Explicit local publishing command, never an MCP tool or background updater.
// The caller must select both the candidate and the exact installed plugin root.
export async function publishEngine(candidate,target,expectedCurrent){
  if(!/^[0-9a-f]{64}$/.test(expectedCurrent||''))throw Error('An expected current engine SHA-256 is required');
  const next=await verifyRelease(candidate);
  target=await realpath(target);
  const dist=path.join(target,'dist');
  if(await realpath(dist)!==dist)throw Error('Target dist symlink is not supported');
  const lock=path.join(dist,'.engine-update.lock');
  await writeFile(lock,JSON.stringify({pid:process.pid,at:new Date().toISOString()}),{flag:'wx',mode:0o600});
  let temp;
  try{
    const current=await verifyRelease(target);
    if(current.release.sha256!==expectedCurrent)throw Error('Engine changed since inspection; no update applied');
    if(CORE_FILES.some(file=>current.release.core[file]!==next.release.core[file]))throw Error('Candidate requires a full plugin update');
    if(next.release.sha256===current.release.sha256){
      if(next.release.version!==current.release.version)throw Error('Same engine hash has different version');
      return {changed:false,root:target,active:current.release};
    }
    if(next.release.version===current.release.version)throw Error('Changed engine bytes require a new version');
    const history=path.join(dist,'engine-history');await mkdir(history,{recursive:true});
    if(await realpath(history)!==history)throw Error('History symlink is not supported');
    await immutable(path.join(history,current.release.sha256+'.json'),JSON.stringify(current.release,null,2)+'\n');
    await immutable(path.join(dist,'engines',next.release.sha256+'.mjs'),next.bytes);
    temp=path.join(dist,'.engine-release-'+randomUUID()+'.json');
    await writeFile(temp,JSON.stringify(next.release,null,2)+'\n',{flag:'wx',mode:0o600});
    await rename(temp,path.join(dist,'engine-release.json'));temp=undefined;
    return {changed:true,root:target,previous:current.release,active:next.release};
  }finally{if(temp)await rm(temp,{force:true});await rm(lock);}
}

if(process.argv[1]&&await realpath(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  if(args.length!==6||args[0]!=='--candidate'||args[2]!=='--target'||args[4]!=='--expect')throw Error('Usage: node scripts/engine-release.mjs --candidate PLUGIN_ROOT --target INSTALLED_PLUGIN_ROOT --expect CURRENT_ENGINE_SHA256');
  console.log(JSON.stringify(await publishEngine(args[1],args[3],args[5]),null,2));
}
