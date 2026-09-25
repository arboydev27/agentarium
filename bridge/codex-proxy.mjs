import {spawn} from 'node:child_process';
import readline from 'node:readline';
import {codexToEvent,sendEvent} from './adapters.mjs';
// Use this in place of `codex app-server` in an App Server client's launch config.
// All protocol bytes are passed through unchanged; telemetry never writes stdout.
const child=spawn(process.env.CODEX_BINARY||'codex',['app-server',...process.argv.slice(2)],{stdio:['pipe','pipe','inherit']});
process.stdin.pipe(child.stdin);child.stdout.pipe(process.stdout);
let chain=Promise.resolve();const lines=readline.createInterface({input:child.stdout});lines.on('line',line=>{try{const event=codexToEvent(JSON.parse(line));if(event)chain=chain.then(()=>sendEvent(event)).catch(e=>process.stderr.write('[Agent Grove] '+e.message+'\n'));}catch{}});
child.on('error',e=>{process.stderr.write(e.message+'\n');process.exitCode=1});child.on('exit',code=>{process.exitCode=code??1;process.stdin.unpipe(child.stdin);process.stdin.pause();});
for(const sig of ['SIGINT','SIGTERM'])process.once(sig,()=>child.kill(sig));
