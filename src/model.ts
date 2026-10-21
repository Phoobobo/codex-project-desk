import {z} from 'zod';
const text=z.string().trim().min(1).max(2000);
const title=z.string().trim().min(1).max(140);
const id=z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/);
const timestamp=z.string().refine(value=>Number.isFinite(Date.parse(value)),'Expected a timestamp');
export const threadSchema=z.object({id:z.string().uuid(),title}).strict();
export const evidenceSchema=z.object({kind:z.enum(['user_acceptance','verification','progress','report']),summary:text,thread:threadSchema.optional(),url:z.string().max(1000).refine(value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}},'Expected an HTTPS URL without credentials').optional(),observedAt:timestamp}).strict();
export const blockerSchema=z.object({id,title,summary:text,impact:text,nextStep:text,owner:threadSchema.nullable(),evidence:z.array(evidenceSchema).max(20).default([])}).strict();
export const milestoneSchema=z.object({id,title,outcome:text,state:z.enum(['planned','active','blocked','ready_for_review','accepted','unknown']),criteria:z.array(text).max(20),owner:threadSchema.nullable(),blockers:z.array(blockerSchema).max(20),evidence:z.array(evidenceSchema).max(30),acceptedAt:timestamp.optional()}).strict().superRefine((value,ctx)=>{
  if(value.state==='accepted'&&(!value.acceptedAt||!value.evidence.some(e=>e.kind==='user_acceptance'&&(e.thread||e.url))))ctx.addIssue({code:'custom',message:'Accepted milestones need a dated user acceptance reference'});
  if(value.state==='accepted'&&value.blockers.length)ctx.addIssue({code:'custom',message:'An accepted milestone cannot contain open blockers'});
  if(value.state==='blocked'&&!value.blockers.length)ctx.addIssue({code:'custom',message:'A blocked milestone needs an actionable blocker'});
});
export const attentionSchema=z.object({id,kind:z.enum(['acceptance','decision']),title,summary:text,ask:text,impact:text,state:z.enum(['waiting','in_progress','done']),owner:threadSchema.nullable(),milestoneId:id.optional(),criteria:z.array(text).max(20).default([]),evidence:z.array(evidenceSchema).max(30).default([])}).strict();
export const issueSchema=z.object({id,title,summary:text,reportedBy:z.enum(['user','agent','unknown']),status:z.enum(['triage','in_progress','blocked','ready_for_review','resolved']),priority:z.enum(['critical','high','normal','low']),owner:threadSchema.nullable(),latestUpdate:text,nextStep:text,milestoneId:id.optional(),evidence:z.array(evidenceSchema).max(30)}).strict().superRefine((value,ctx)=>{
  if(value.status==='resolved'&&!value.evidence.some(e=>(e.kind==='verification'||e.kind==='user_acceptance')&&(e.thread||e.url)))ctx.addIssue({code:'custom',message:'Resolved issues require verification evidence'});
});
export const projectDocumentSchema=z.object({schema:z.literal('project-desk.project.v1'),observedAt:timestamp,goal:text,nextCheckpoint:text,milestones:z.array(milestoneSchema).max(60),attention:z.array(attentionSchema).max(100),issues:z.array(issueSchema).max(300),source:z.object({kind:z.enum(['codex_host','manual']),summary:text,threads:z.array(threadSchema).max(200)}).strict(),correctionReason:text.optional()}).strict().superRefine((value,ctx)=>{
  for(const key of ['milestones','attention','issues'] as const){const values=value[key].map(v=>v.id);if(new Set(values).size!==values.length)ctx.addIssue({code:'custom',message:`Duplicate ${key} id`});}
  const blockerIds=value.milestones.flatMap(m=>m.blockers.map(b=>b.id));if(new Set(blockerIds).size!==blockerIds.length)ctx.addIssue({code:'custom',message:'Duplicate blocker id'});
  const milestones=new Set(value.milestones.map(m=>m.id));for(const item of [...value.attention,...value.issues])if(item.milestoneId&&!milestones.has(item.milestoneId))ctx.addIssue({code:'custom',message:'Unknown milestone reference'});
});
export const projectSchema=z.object({id,name:title,kind:z.enum(['local','remote','chatgpt','unknown']),hostId:z.string().max(160).nullable().default(null)}).strict();
export const catalogInputSchema=z.object({expectedRevision:z.number().int().nonnegative(),projects:z.array(projectSchema).max(200)}).strict();
export const projectInputSchema=z.object({projectId:id,expectedRevision:z.number().int().nonnegative(),document:projectDocumentSchema}).strict();
export type Project=z.infer<typeof projectSchema>;
export type ProjectDocument=z.infer<typeof projectDocumentSchema>;
export type Milestone=z.infer<typeof milestoneSchema>;
export type Attention=z.infer<typeof attentionSchema>;
export type Issue=z.infer<typeof issueSchema>;
export type Blocker=z.infer<typeof blockerSchema>;
export type Evidence=z.infer<typeof evidenceSchema>;
export type ThreadRef=z.infer<typeof threadSchema>;
export type StoredProject={revision:number;sha256:string;syncedAt:string;document:ProjectDocument};
export type ReaderInput={catalogRevision:number;catalog:Project[];selectedProjectId:string|null;record:StoredProject|null};
export type DeskProject=Project&ProjectDocument&{revision:number;sha256:string;syncedAt:string;metrics:{accepted:number;total:number;blocked:number;awaitingAcceptance:number;awaitingDecision:number;reportedOpen:number}};
export type DeskSnapshot={schema:'project-desk.snapshot.v1';observedAt:string;catalogRevision:number;catalog:Project[];project:DeskProject|null;selectedProjectId:string|null;engine?:{version:string;sha256:string};reader?:{instance:string;sequence:number};pluginVersion?:string};
