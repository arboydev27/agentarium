import {describe,it,expect,beforeEach} from 'vitest';
import {reduceAgentEvent,validateEvent} from './shared/protocol.mjs';
import {useWorld} from './state';
import type {AgentEvent} from './state';
const event=(overrides:Partial<AgentEvent>={}):AgentEvent=>({id:'event-1',sessionId:'session-a',agentId:'agent-a',sequence:1,timestamp:1000,type:'working',provider:'Codex',...overrides});
describe('agent lifecycle',()=>{
 it('keeps identities distinct across sessions and assigns unique seats',()=>{let agents=reduceAgentEvent([],event());agents=reduceAgentEvent(agents,event({sessionId:'session-b'}));expect(agents.map(a=>a.id)).toEqual(['session-a:agent-a','session-b:agent-a']);expect(new Set(agents.map(a=>a.seat)).size).toBe(2)});
 it('ignores stale events after completion',()=>{const initial=reduceAgentEvent([],event({sequence:9,type:'completed'}));expect(reduceAgentEvent(initial,event({sequence:8}))).toBe(initial)});
 it('retains parent relationships through subsequent updates',()=>{let agents=reduceAgentEvent([],event({parentId:'parent'}));agents=reduceAgentEvent(agents,event({sequence:2,type:'tool'}));expect(agents[0].parentId).toBe('session-a:parent')});
 it('starts a fresh task clock only at a new task',()=>{let agents=reduceAgentEvent([],event());agents=reduceAgentEvent(agents,event({sequence:2,type:'tool',timestamp:2000}));expect(agents[0].startedAt).toBe(1000);agents=reduceAgentEvent(agents,event({sequence:3,type:'completed',timestamp:3000}));agents=reduceAgentEvent(agents,event({sequence:4,type:'working',timestamp:4000}));expect(agents[0].startedAt).toBe(4000)});
 it('validates sequence and status and drops unapproved fields',()=>{expect(()=>validateEvent(event({sequence:NaN}))).toThrow();expect(()=>validateEvent({...event(),type:'thinking-secretly'})).toThrow();expect(validateEvent({...event(),prompt:'sensitive'})).not.toHaveProperty('prompt')});
});
describe('simulation isolation',()=>{
 beforeEach(()=>useWorld.getState().reset());
 it('cannot mutate live agents using simulator controls',()=>{useWorld.getState().switchMode('live');useWorld.getState().ingest(event());const before=useWorld.getState().agents;useWorld.getState().setStatus('session-a:agent-a','failed');useWorld.getState().spawn();expect(useWorld.getState().agents).toBe(before)});
 it('ignores duplicate incoming events',()=>{useWorld.getState().switchMode('live');useWorld.getState().ingest(event());useWorld.getState().ingest(event());expect(useWorld.getState().agents).toHaveLength(1);expect(useWorld.getState().events).toHaveLength(1)});
 it('delegates only into an available resident',()=>{useWorld.getState().spawn('demo-0');const a=useWorld.getState().agents.find(a=>a.id===useWorld.getState().selected);expect(a?.parentId).toBe('demo-0');expect(a?.status).toBe('working')});
});
