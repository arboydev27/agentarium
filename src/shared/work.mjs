// Shared by the bridge and browser. No animation or provider-control state belongs here.
export function safeWorkUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}
export function validateWork(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid work');
  const clean = {};
  for (const [key, limit] of Object.entries({ objective: 300, activity: 300, runId: 200 })) {
    if (value[key] === undefined) continue;
    if (typeof value[key] !== 'string' || !value[key].trim() || value[key].length > limit)
      throw new Error('Invalid work.' + key);
    clean[key] = value[key];
  }
  if (value.sourceUrl !== undefined) {
    clean.sourceUrl = safeWorkUrl(value.sourceUrl);
    if (!clean.sourceUrl) throw new Error('Invalid work.sourceUrl');
  }
  if (value.request !== undefined) {
    const r = value.request;
    if (
      !r ||
      !['input', 'approval'].includes(r.kind) ||
      typeof r.id !== 'string' ||
      !r.id ||
      r.id.length > 200
    )
      throw new Error('Invalid work.request');
    clean.request = { id: r.id, kind: r.kind };
    if (r.message !== undefined) {
      if (typeof r.message !== 'string' || !r.message.trim() || r.message.length > 1000)
        throw new Error('Invalid work.request.message');
      clean.request.message = r.message;
    }
  }
  if (value.result !== undefined) {
    const r = value.result;
    if (!r || typeof r.summary !== 'string' || !r.summary.trim() || r.summary.length > 1000)
      throw new Error('Invalid work.result');
    clean.result = { summary: r.summary };
    if (r.url !== undefined) {
      clean.result.url = safeWorkUrl(r.url);
      if (!clean.result.url) throw new Error('Invalid work.result.url');
    }
  }
  return clean;
}
export function attentionFor(agent) {
  if (agent.attention) return agent.attention;
  if (!['waiting', 'failed'].includes(agent.status)) return undefined;
  return {
    id: 'legacy:' + agent.updatedAt,
    kind: agent.status === 'failed' ? 'failure' : 'waiting',
    since: agent.updatedAt,
    updatedAt: agent.updatedAt,
  };
}
export function workUpdate(old, event) {
  const previous = old ? attentionFor(old) : undefined;
  const work = event.work;
  // Request identity is scoped to a run when supplied. Only a new episode creates a new ID.
  const runId = work?.runId ?? old?.work?.runId;
  const sameRun = !work?.runId || work.runId === old?.work?.runId;
  let attention;
  if (event.type === 'waiting' || event.type === 'failed') {
    const kind = event.type === 'failed' ? 'failure' : work?.request?.kind || 'waiting';
    const requestId = work?.request?.id;
    const reuse =
      sameRun &&
      previous &&
      (event.type === 'failed' ? previous.kind === 'failure' : previous.kind !== 'failure') &&
      (!requestId || previous.requestId === requestId);
    attention = reuse
      ? { ...previous, updatedAt: event.timestamp }
      : {
          id: event.id,
          kind,
          since: event.timestamp,
          updatedAt: event.timestamp,
          ...(requestId ? { requestId } : {}),
        };
    if (event.type === 'waiting' && work?.request) {
      attention.kind = work.request.kind;
      if (work.request.message !== undefined) attention.message = work.request.message;
    }
  } else if (['unknown', 'disconnected'].includes(event.type)) {
    attention = previous; // Observation loss cannot resolve an unanswered request.
  }
  return {
    attention,
    work: {
      objective: work?.objective ?? (sameRun ? old?.work?.objective : undefined),
      sourceUrl: work?.sourceUrl ?? old?.work?.sourceUrl,
      runId,
      activity: work?.activity ?? event.task,
      // Results belong only to the current terminal observation, never the next task.
      result: ['completed', 'failed'].includes(event.type) ? work?.result : undefined,
    },
  };
}
