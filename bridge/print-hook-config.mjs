import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const provider=process.argv[2]?.toLowerCase();if(!['claude','gemini'].includes(provider)){console.error('Usage: node bridge/print-hook-config.mjs claude|gemini');process.exit(1);}
const script=resolve(dirname(fileURLToPath(import.meta.url)),'hook.mjs');const quote=s=>"'"+s.replaceAll("'","'\\''")+"'";const command=quote(process.execPath)+' '+quote(script)+' '+provider;
const events=provider==='claude'?['SessionStart','UserPromptSubmit','PreToolUse','PostToolUse','PostToolUseFailure','PermissionRequest','Notification','Stop','StopFailure','SubagentStart','SubagentStop','SessionEnd']:['SessionStart','BeforeAgent','BeforeModel','BeforeTool','AfterTool','AfterAgent','Notification','SessionEnd'];
const hooks={};for(const event of events){hooks[event]=[{hooks:[{type:'command',command,timeout:provider==='claude'?3:3000}]}];}
console.log(JSON.stringify({hooks},null,2));
