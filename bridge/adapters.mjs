import {randomUUID} from 'node:crypto';
export function hookToEvent(provider,input,{now=Date.now(),sequence=Date.now()*1000+Number(process.hrtime.bigint()/1000n%1000n)}={}){
 const event=input.hook_event_name;if(!event)return null;
 const map=provider==='Claude'?{UserPromptSubmit:'working',PreToolUse:'tool',PostToolUse:'working',PostToolUseFailure:'failed',PermissionRequest:'waiting',Notification:'waiting',Stop:'completed',StopFailure:'failed',SubagentStart:'working',SubagentStop:'completed',SessionStart:'idle',SessionEnd:'idle'}:{BeforeAgent:'working',BeforeTool:'tool',AfterTool:'working',BeforeModel:'working',AfterAgent:'completed',SessionStart:'idle',SessionEnd:'idle',Notification:'waiting'};
 const type=map[event];if(!type)return null;
 if(event==='Notification'&&provider==='Claude'&&!['permission_prompt','idle_prompt','elicitation_dialog'].includes(input.notification_type))return null;
 const subagent=event==='SubagentStart'||event==='SubagentStop';const id=input.agent_id||'main';
 // Deliberately omit prompts, tool inputs, outputs, file paths, and transcript paths.
 return {id:randomUUID(),sessionId:String(input.session_id||'default'),agentId:id,sequence,timestamp:now,type,provider,name:input.agent_type?String(input.agent_type).slice(0,80):provider+' agent',task:type==='tool'?'Using '+String(input.tool_name||'a tool').slice(0,100):type==='working'?'Working on a task':type==='waiting'?'Waiting for your input':undefined,parentId:subagent?'main':undefined};
}
export function codexToEvent(message,{now=Date.now(),sequence=Date.now()*1000+Number(process.hrtime.bigint()/1000n%1000n)}={}){
 const p=message.params||{};const method=message.method;const sessionId=p.threadId||p.thread?.id;if(!sessionId)return null;
 let type,task;
 if(method==='thread/started'){type='idle';task='Ready for a task';}
 else if(method==='turn/started'){type='working';task='Working on a task';}
 else if(method==='turn/completed'){type=p.turn?.status==='failed'?'failed':p.turn?.status==='interrupted'?'idle':'completed';}
 else if(method==='item/started'){const item=p.item?.type;if(['commandExecution','fileChange','mcpToolCall','webSearch','dynamicToolCall'].includes(item)){type='tool';task=({commandExecution:'Running a command',fileChange:'Editing files',mcpToolCall:'Using a connected tool',webSearch:'Searching the web',dynamicToolCall:'Using a tool'})[item];}}
 else if(method==='item/completed'&&['commandExecution','fileChange','mcpToolCall','webSearch','dynamicToolCall'].includes(p.item?.type)){type='working';}
 else if(method==='thread/status/changed'){const st=p.status;if(st?.type==='active'){type=st.activeFlags?.some(f=>f==='waitingOnApproval'||f==='waitingOnUserInput')?'waiting':'working';}else if(st?.type==='notLoaded')type='disconnected';else if(st?.type==='idle')type='idle';}
 else if(method?.endsWith('/requestApproval')||method==='item/tool/requestUserInput'){type='waiting';task='Waiting for your input';}
 if(!type)return null;
 return {id:randomUUID(),sessionId,agentId:'main',sequence,timestamp:now,type,provider:'Codex',name:'Codex agent',task};
}
export async function sendEvent(event){if(!event)return;const token=process.env.GROVE_TOKEN;if(!token)throw new Error('Set GROVE_TOKEN from the bridge terminal.');const base=process.env.GROVE_URL||'http://127.0.0.1:4318';const u=new URL(base);if(!['127.0.0.1','localhost','[::1]'].includes(u.hostname))throw new Error('GROVE_URL must point to the local bridge.');const r=await fetch(new URL('/events',u),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(event),signal:AbortSignal.timeout(2000)});if(!r.ok)throw new Error('Bridge returned '+r.status);}
