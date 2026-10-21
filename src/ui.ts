import {App} from '@modelcontextprotocol/ext-apps';
import {mount} from './view.ts';
import {VERSION} from './version.ts';
const app=new App({name:'project-desk',version:VERSION},{},{autoResize:true});
const view=mount(document.getElementById('app')!,{
 refresh:async projectId=>{const result=await app.callServerTool({name:'read_project_desk',arguments:projectId?{projectId}:{}},{timeout:15000});if(result.isError||!result.structuredContent)throw Error('项目读取失败，当前内容已保留');return result.structuredContent;},
 openLink:async url=>{const result=await app.openLink({url},{timeout:10000});if(result.isError)throw Error('LINK_NOT_SUPPORTED');},
 requestSync:async text=>{const result=await app.sendMessage({role:'user',content:[{type:'text',text}]},{timeout:15000});if(result.isError)throw Error('SYNC_REQUEST_UNSUPPORTED');},
});
app.onhostcontextchanged=context=>{if('theme' in context)view.hostTheme(context.theme);};
app.onteardown=async()=>{view.dispose();return {};};
app.connect(undefined,{timeout:10000}).then(()=>{view.hostTheme(app.getHostContext()?.theme);view.start();}).catch(()=>view.fail('宿主连接未建立。请在已安装插件的本地 Codex 聊天中打开工作台。'));
