import { readFile, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import type { ReaderInput, DeskSnapshot } from './model.ts';

const ABI = 'project-desk.reader.v1';
type Release = {abi:string; version:string; sha256:string};
const hash = (bytes:Buffer) => createHash('sha256').update(bytes).digest('hex');

async function boundedFile(file:string, limit:number) {
  const info=await stat(file);
  if(!info.isFile()||info.size>limit)throw Error('ENGINE_FILE_INVALID');
  const bytes=await readFile(file);
  if(bytes.length>limit)throw Error('ENGINE_FILE_INVALID');
  return bytes;
}

// Release paths are fixed by the installed broker, never supplied by tool calls
// or source records. Execute the exact bytes whose digest was checked.
async function readRelease(directory:string) {
  const release:Release=JSON.parse((await boundedFile(path.join(directory,'engine-release.json'),16_384)).toString('utf8'));
  if(release.abi!==ABI||!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(release.version)||! /^[0-9a-f]{64}$/.test(release.sha256))throw Error('ENGINE_RELEASE_INVALID');
  const root=await realpath(path.join(directory,'engines'));
  const file=await realpath(path.join(root,release.sha256+'.mjs'));
  if(path.dirname(file)!==root)throw Error('ENGINE_PATH_INVALID');
  const bytes=await boundedFile(file,2_000_000);
  if(hash(bytes)!==release.sha256)throw Error('ENGINE_HASH_MISMATCH');
  return {release,bytes};
}

function validateSnapshot(value:any,input:ReaderInput){
 if(value?.schema!=='project-desk.snapshot.v1'||!Number.isFinite(Date.parse(value.observedAt)))throw Error('ENGINE_SNAPSHOT_INVALID');
 if(value.selectedProjectId!==input.selectedProjectId||value.catalogRevision!==input.catalogRevision||JSON.stringify(value.catalog)!==JSON.stringify(input.catalog))throw Error('ENGINE_SCOPE_INVALID');
 if(input.record ? value.project?.id!==input.selectedProjectId||value.project?.sha256!==input.record.sha256||value.project?.revision!==input.record.revision : value.project!==null)throw Error('ENGINE_SCOPE_INVALID');
}
export function createHotReader(directory:string,timeoutMs=10_000){
 // The broker supplies only the selected project's validated projection.
 return async(input:ReaderInput):Promise<DeskSnapshot>=>{
    const {release,bytes}=await readRelease(directory);
    const worker=new Worker(new URL('data:text/javascript;base64,'+bytes.toString('base64')),{
      workerData:input,execArgv:[],stdout:true,stderr:true,env:{},
      resourceLimits:{maxOldGenerationSizeMb:128},
    });
    // Never let engine console output corrupt the MCP stdio stream.
    worker.stdout.resume();worker.stderr.resume();
    const packet:any=await new Promise((resolve,reject)=>{
      let settled=false;
      const finish=(error:Error|null,value?:unknown)=>{
        if(settled)return;settled=true;clearTimeout(timer);
        void worker.terminate().then(()=>error?reject(error):resolve(value),reject);
      };
      const timer=setTimeout(()=>finish(Error('ENGINE_TIMEOUT')),timeoutMs);
      worker.once('message',value=>finish(null,value));
      worker.once('error',()=>finish(Error('ENGINE_FAILED')));
      worker.once('exit',()=>finish(Error('ENGINE_EXITED_WITHOUT_RESULT')));
    });
    if(packet?.abi!==ABI||packet.version!==release.version)throw Error('ENGINE_RESPONSE_INVALID');
    validateSnapshot(packet.snapshot,input);
    return {...packet.snapshot,engine:{abi:ABI,version:release.version,sha256:release.sha256}};
  };
}
