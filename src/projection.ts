import type {ReaderInput,DeskSnapshot} from './model.ts';
export function projectDesk(input:ReaderInput):DeskSnapshot{
  const metadata=input.catalog.find(p=>p.id===input.selectedProjectId);const record=input.record;const document=record?.document;
  const project=metadata&&record&&document?{...metadata,...document,revision:record.revision,sha256:record.sha256,syncedAt:record.syncedAt,metrics:{accepted:document.milestones.filter(m=>m.state==='accepted').length,total:document.milestones.length,blocked:document.milestones.filter(m=>m.state==='blocked'||m.blockers.length>0).length,awaitingAcceptance:document.attention.filter(a=>a.kind==='acceptance'&&a.state==='waiting').length,awaitingDecision:document.attention.filter(a=>a.kind==='decision'&&a.state==='waiting').length,reportedOpen:document.issues.filter(i=>i.reportedBy==='user'&&i.status!=='resolved').length}}:null;
  return {schema:'project-desk.snapshot.v1',observedAt:new Date().toISOString(),catalogRevision:input.catalogRevision,catalog:input.catalog,selectedProjectId:input.selectedProjectId,project};
}
