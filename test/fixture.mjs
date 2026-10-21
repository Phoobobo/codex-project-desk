// Fictional public samples. No real project or chat identifiers.
export const thread={id:'11111111-1111-4111-8111-111111111111',title:'Aurora Notes · 离线体验'};
export const decisionThread={id:'22222222-2222-4222-8222-222222222222',title:'Aurora Notes · 同步策略'};
export const at='2026-10-21T10:00:00.000Z';
const proof=(kind,summary,owner=thread)=>({kind,summary,thread:owner,observedAt:at});
const evidence=[proof('progress','负责人已更新实现进度；仍需按标准验收。')];
const base={criteria:['用户可以顺利完成核心操作','结果有可回读的验证证据'],owner:thread,blockers:[],evidence};
export const document={schema:'project-desk.project.v1',observedAt:at,goal:'让每一个想法，在任何地方都能被可靠记录。',nextCheckpoint:'下一步：确认离线体验，再决定多设备冲突处理方式。',milestones:[
 {...base,id:'capture',title:'快速捕捉灵感',outcome:'打开即写，随时保存第一条想法。',state:'accepted',acceptedAt:at,evidence:[proof('user_acceptance','用户已确认：快速记录路径符合预期。')]},
 {...base,id:'organize',title:'找到重要的笔记',outcome:'通过搜索与标签，找回刚刚记录的内容。',state:'accepted',acceptedAt:at,evidence:[proof('user_acceptance','用户完成搜索与标签验收。')]},
 {...base,id:'offline',title:'安心离线记录',outcome:'断网后仍可编辑，重新连接后不丢内容。',state:'ready_for_review'},
 {...base,id:'sync',title:'多设备无缝衔接',outcome:'在另一台设备继续写，遇到冲突也能安全处理。',state:'blocked',owner:decisionThread,blockers:[{id:'conflict-policy',title:'冲突时，保留哪一份？',summary:'两台设备同时修改同一段内容时，默认合并规则还没有确定。',impact:'跨设备同步的最终验证暂时无法开始；离线记录验收可继续。',nextStep:'选择默认保留两份并提示用户，或允许按更新时间覆盖。建议先保留两份。',owner:decisionThread,evidence}]},
 {...base,id:'share',title:'把想法分享出去',outcome:'生成易读的分享页，让协作更轻松。',state:'active'},
 {...base,id:'launch',title:'准备第一次发布',outcome:'收齐核心体验的验收，交付稳定的首个版本。',state:'planned'},
],attention:[
 {id:'review-offline',kind:'acceptance',title:'离线体验可以验收了',summary:'离线编辑与重新连接已完成实现，演示环境准备完毕。',ask:'断网写一段笔记，再重新连接，确认内容完整保留。',impact:'通过后，离线里程碑可以确认完成。',state:'waiting',owner:thread,milestoneId:'offline',criteria:['离线新建与编辑可用','恢复连接后内容不丢失','同步状态清晰可见'],evidence},
 {id:'choose-conflict',kind:'decision',title:'确定冲突处理方式',summary:'跨设备同步需要明确默认冲突处理策略。',ask:'同时修改时，是否默认保留两份内容，让用户选择？',impact:'解除多设备同步的验证卡点。',state:'waiting',owner:decisionThread,milestoneId:'sync',criteria:[],evidence},
],issues:[
 {id:'search-reset',title:'搜索后返回，筛选条件丢失',summary:'打开搜索结果再返回时，已选择的标签被清空。',reportedBy:'user',status:'triage',priority:'normal',owner:null,latestUpdate:'已记录，等待确认复现步骤。',nextStep:'复现标签筛选后的返回路径。',evidence:[proof('report','用户在体验中报告此问题。')]},
 {id:'sync-state',title:'同步状态提示不够清楚',summary:'网络不稳定时，不知道笔记是否已经保存。',reportedBy:'user',status:'in_progress',priority:'high',owner:thread,latestUpdate:'正在补充离线、等待与完成三种提示。',nextStep:'实现完成后，请用户重新体验弱网提示。',milestoneId:'offline',evidence},
 {id:'keyboard',title:'快捷键偶尔失效',summary:'弹窗关闭后，快速新建快捷键没有响应。',reportedBy:'user',status:'resolved',priority:'normal',owner:thread,latestUpdate:'已复测：弹窗关闭后快捷键恢复正常。',nextStep:'继续观察后续使用是否复现。',evidence:[proof('verification','桌面浏览器连续重复操作 10 次，未再复现。')]},
 {id:'share-preview',title:'分享预览文字截断',summary:'较长的标题在分享预览中无法完整阅读。',reportedBy:'user',status:'ready_for_review',priority:'normal',owner:thread,latestUpdate:'换行修复已准备好，等待体验确认。',nextStep:'使用一个长标题检查预览。',evidence},
 {id:'device-switch',title:'设备切换后出现重复段落',summary:'冲突编辑后恢复连接，内容可能重复。',reportedBy:'user',status:'blocked',priority:'high',owner:decisionThread,latestUpdate:'等待确定默认冲突处理方式。',nextStep:'先完成同步策略决策，再验证重复内容。',milestoneId:'sync',evidence},
 {id:'internal-cleanup',title:'整理内部模块命名',summary:'维护性建议，无用户可见缺陷。',reportedBy:'agent',status:'triage',priority:'low',owner:thread,latestUpdate:'仅记录为维护建议。',nextStep:'等待独立评估。',evidence},
],source:{kind:'manual',summary:'Fictional demonstration data; no live chats were accessed.',threads:[thread,decisionThread]}};
export const catalog=[{id:'aurora-notes',name:'Aurora Notes',kind:'local',hostId:null},{id:'field-atlas',name:'Field Atlas',kind:'remote',hostId:null}];
export const emptyDocument={schema:'project-desk.project.v1',observedAt:at,goal:'Explore a new place with confidence.',nextCheckpoint:'Clarify the first milestone.',milestones:[],attention:[],issues:[],source:{kind:'manual',summary:'Fictional empty project.',threads:[]}};
