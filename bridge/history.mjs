// A separate autoincrement cursor survives pruning and does not depend on provider clocks.
export function createHistory(db, bridgeId) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS history (cursor INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL)',
  );
  const insert = db.prepare('INSERT INTO history(payload) VALUES (?)');
  return {
    record(old, agent, event) {
      const attentionChanged = agent.attention && agent.attention.id !== old?.attention?.id;
      const terminal =
        ['completed', 'failed'].includes(event.type) &&
        (old?.status !== event.type || agent.work?.runId !== old?.work?.runId);
      const observation =
        ['unknown', 'disconnected'].includes(event.type) && old?.status !== event.type;
      if (!attentionChanged && !terminal && !observation) return;
      insert.run(
        JSON.stringify({
          eventId: event.id,
          agentId: agent.id,
          sessionId: agent.sessionId,
          provider: agent.provider,
          name: agent.name,
          task: agent.task,
          status: event.type,
          time: event.timestamp,
          receivedAt: Date.now(),
          attention: agent.attention,
          work: agent.work,
        }),
      );
      db.exec(
        'DELETE FROM history WHERE cursor NOT IN (SELECT cursor FROM history ORDER BY cursor DESC LIMIT 10000)',
      );
    },
    page(search) {
      const number = (name, fallback) => {
        const raw = search.get(name);
        if (raw !== null && !/^\d+$/.test(raw)) throw new Error('Invalid ' + name);
        const value = raw === null ? fallback : Number(raw);
        if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid ' + name);
        return value;
      };
      const after = number('after', 0);
      const latest =
        db.prepare("SELECT seq FROM sqlite_sequence WHERE name='history'").get()?.seq || 0;
      const until = Math.min(number('until', latest), latest);
      const limit = Math.min(100, Math.max(1, number('limit', 50)));
      if (after > latest) throw new Error('History cursor is ahead of this database');
      const oldest = db.prepare('SELECT MIN(cursor) AS cursor FROM history').get().cursor || 0;
      const rows = db
        .prepare(
          'SELECT cursor,payload FROM history WHERE cursor>? AND cursor<=? ORDER BY cursor LIMIT ?',
        )
        .all(after, until, limit);
      const next = rows.at(-1)?.cursor ?? after;
      return {
        bridgeId,
        until,
        next,
        oldest,
        gap: oldest > 1 && after < oldest - 1,
        hasMore: !!db
          .prepare('SELECT 1 FROM history WHERE cursor>? AND cursor<=? LIMIT 1')
          .get(next, until),
        items: rows.map((row) => ({ cursor: row.cursor, ...JSON.parse(row.payload) })),
      };
    },
  };
}
