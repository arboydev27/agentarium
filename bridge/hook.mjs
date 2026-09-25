import { hookToEvent, sendEvent } from './adapters.mjs';
// A telemetry hook must not block or modify agent execution, including on failure.
const provider = process.argv[2]?.toLowerCase() === 'gemini' ? 'Gemini' : 'Claude';
try {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 1048576) throw new Error('Hook input too large');
  }
  const event = hookToEvent(provider, JSON.parse(input));
  await sendEvent(event);
} catch (e) {
  process.stderr.write('[Agent Grove] ' + e.message + '\n');
}
process.stdout.write('{}\n');
