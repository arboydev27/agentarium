import { sendEvent } from './adapters.mjs';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
// Explicitly synthetic integration demonstration; it does not run an AI model.
const sessionId = 'bridge-demo-' + Date.now();
const steps = [
  ['working', 'Synthetic bridge demonstration'],
  ['tool', 'Synthetic tool event'],
  ['waiting', 'Synthetic input request'],
  ['working', 'Synthetic continuation'],
  ['completed', 'Synthetic demonstration finished'],
];
for (let i = 0; i < steps.length; i++) {
  const [type, task] = steps[i];
  await sendEvent({
    id: randomUUID(),
    agentId: 'demo',
    sessionId,
    sequence: i,
    timestamp: Date.now(),
    type,
    provider: 'Custom',
    name: 'Bridge demo',
    task,
  });
  console.log(type);
  if (i < steps.length - 1) await setTimeout(3000);
}
