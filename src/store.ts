import {mkdir,readFile,writeFile,rename,rm,lstat} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {z} from 'zod';
import {projectSchema,projectDocumentSchema,catalogInputSchema,projectInputSchema} from './model.ts';
import type {ReaderInput,StoredProject} from './model.ts';
const recordSchema=z.object({revision:z.number().int().positive(),sha256:z.string().regex(/^[0-9a-f]{64}$/),syncedAt:z.string().refine(value=>Number.isFinite(Date.parse(value))),document:projectDocumentSchema}).strict();
const stateSchema=z.object({schema:z.literal('project-desk.store.v1'),catalogRevision:z.number().int().nonnegative(),catalog:z.array(projectSchema),snapshots:z.record(z.string(),recordSchema)}).strict();
type State=z.infer<typeof stateSchema>;
const initial=():State=>({schema:'project-desk.store.v1',catalogRevision:0,catalog:[],snapshots:{}});
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const recordFor=(state:State,id:string)=>Object.hasOwn(state.snapshots,id)?state.snapshots[id]:null;
export class DeskStore{
  readonly directory:string;
  constructor(directory:string){this.directory=directory;}
  async load():Promise<State>{
    let raw:string;
    try{const file=path.join(this.directory,'state.json');const info=await lstat(file);if(!info.isFile()||info.isSymbolicLink()||info.size>12_000_000)throw Error('STORE_FILE_INVALID');raw=await readFile(file,'utf8');}
    catch(error:any){if(error.code==='ENOENT')return initial();throw error;}
    if(Buffer.byteLength(raw)>12_000_000)throw Error('STORE_FILE_INVALID');
    const state=stateSchema.parse(JSON.parse(raw));if(new Set(state.catalog.map(p=>p.id)).size!==state.catalog.length)throw Error('CATALOG_DUPLICATE');
    for(const record of Object.values(state.snapshots))if(record.sha256!==hash(record.document))throw Error('STORE_HASH_MISMATCH');return state;
  }
  async read(projectId?:string):Promise<ReaderInput>{
    const state=await this.load();if(projectId&&!state.catalog.some(p=>p.id===projectId))throw Error('PROJECT_NOT_IN_CATALOG');
    const selectedProjectId=projectId||null;return {catalogRevision:state.catalogRevision,catalog:state.catalog,selectedProjectId,record:selectedProjectId?recordFor(state,selectedProjectId):null};
  }
  private async change(update:(state:State)=>unknown){
    await mkdir(this.directory,{recursive:true,mode:0o700});const info=await lstat(this.directory);if(!info.isDirectory()||info.isSymbolicLink())throw Error('STORE_DIRECTORY_INVALID');
    const lock=path.join(this.directory,'.write.lock');await writeFile(lock,JSON.stringify({pid:process.pid,at:new Date().toISOString()}),{flag:'wx',mode:0o600});let temp:string|undefined;
    try{
      const state=await this.load();const previous=JSON.stringify(state);const result=update(state);const bytes=JSON.stringify(state,null,2)+'\n';if(Buffer.byteLength(bytes)>12_000_000)throw Error('STORE_TOO_LARGE');
      const history=path.join(this.directory,'history');await mkdir(history,{recursive:true,mode:0o700});const historyInfo=await lstat(history);if(!historyInfo.isDirectory()||historyInfo.isSymbolicLink())throw Error('HISTORY_DIRECTORY_INVALID');
      await writeFile(path.join(history,randomUUID()+'.json'),previous+'\n',{flag:'wx',mode:0o600});temp=path.join(this.directory,'.state-'+randomUUID()+'.json');await writeFile(temp,bytes,{flag:'wx',mode:0o600});await rename(temp,path.join(this.directory,'state.json'));temp=undefined;return result;
    }finally{if(temp)await rm(temp,{force:true});await rm(lock);}
  }
  async syncCatalog(input:unknown){
    const value=catalogInputSchema.parse(input);if(new Set(value.projects.map(p=>p.id)).size!==value.projects.length)throw Error('CATALOG_DUPLICATE');
    return this.change(state=>{if(value.expectedRevision!==state.catalogRevision)throw Error('CATALOG_CONFLICT_READ_FIRST');state.catalog=value.projects;state.catalogRevision++;return {catalogRevision:state.catalogRevision,projectCount:state.catalog.length};});
  }
  async syncProject(input:unknown){
    const value=projectInputSchema.parse(input);
    return this.change(state=>{
      if(!state.catalog.some(p=>p.id===value.projectId))throw Error('PROJECT_NOT_IN_CATALOG');const old=recordFor(state,value.projectId);
      if((old?.revision??0)!==value.expectedRevision)throw Error('PROJECT_CONFLICT_READ_FIRST');
      if(old&&Date.parse(value.document.observedAt)<Date.parse(old.document.observedAt))throw Error('OLDER_OBSERVATION_REJECTED');
      if(old&&!value.document.correctionReason){
        const milestones=new Set(value.document.milestones.filter(m=>m.state==='accepted').map(m=>m.id));const issues=new Set(value.document.issues.filter(i=>i.status==='resolved').map(i=>i.id));
        if(old.document.milestones.some(m=>m.state==='accepted'&&!milestones.has(m.id))||old.document.issues.some(i=>i.status==='resolved'&&!issues.has(i.id)))throw Error('REOPENING_REQUIRES_CORRECTION_REASON');
      }
      const record:StoredProject={revision:(old?.revision??0)+1,sha256:hash(value.document),syncedAt:new Date().toISOString(),document:value.document};
      Object.defineProperty(state.snapshots,value.projectId,{value:record,writable:true,configurable:true,enumerable:true});return {projectId:value.projectId,revision:record.revision,sha256:record.sha256,syncedAt:record.syncedAt};
    });
  }
}
