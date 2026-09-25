export const STATUSES=['idle','working','tool','waiting','completed','failed','disconnected'];
export const PROVIDERS=['Codex','Claude','Gemini','Custom'];
export const COLORS=['#eeb960','#c6a0e8','#8dcbb9','#ef917b','#8ebbe2','#b8c774','#e3afd2','#d9cba3'];
const zones=['Café','Café','Garden','Garden','Studio','Studio','Courtyard','Courtyard'];
export function validateEvent(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Event must be an object');
 for(const key of ['id','agentId','sessionId'])if(typeof input[key]!=='string'||!input[key].length||input[key].length>200)throw new Error('Invalid '+key);
 if(!STATUSES.includes(input.type))throw new Error('Invalid event type');
 if(!Number.isSafeInteger(input.sequence)||input.sequence<0)throw new Error('Invalid sequence');
 if(!Number.isFinite(input.timestamp)||input.timestamp<0||input.timestamp>Date.now()+300000)throw new Error('Invalid timestamp');
 for(const key of ['name','task','parentId'])if(input[key]!==undefined&&(typeof input[key]!=='string'||input[key].length>(key==='task'?300:200)))throw new Error('Invalid '+key);
 if(input.provider!==undefined&&!PROVIDERS.includes(input.provider))throw new Error('Invalid provider');
 const clean={};for(const key of ['id','agentId','sessionId','sequence','timestamp','type','name','provider','task','parentId'])if(input[key]!==undefined)clean[key]=input[key];return clean;
}
export function reduceAgentEvent(agents,event){
 const key=event.sessionId+':'+event.agentId;const old=agents.find(a=>a.id===key);
 if(old&&event.sequence<=old.sequence)return agents;
 if(!old){const occupied=new Set(agents.map(a=>a.seat));let seat=0;while(occupied.has(seat))seat++;return [...agents,{id:key,name:event.name||'Agent '+(agents.length+1),provider:event.provider||'Custom',color:COLORS[seat%8],status:event.type,task:event.task||'Connected agent',zone:zones[seat%8],seat,startedAt:event.timestamp,updatedAt:event.timestamp,parentId:event.parentId?event.sessionId+':'+event.parentId:undefined,sequence:event.sequence,source:'live'}];}
 return agents.map(a=>a.id===key?{...a,status:event.type,task:event.task??a.task,provider:event.provider??a.provider,name:event.name??a.name,updatedAt:event.timestamp,sequence:event.sequence,parentId:event.parentId?event.sessionId+':'+event.parentId:a.parentId,startedAt:(a.status==='idle'||a.status==='completed'||a.status==='failed')&&event.type==='working'?event.timestamp:a.startedAt}:a);
}
