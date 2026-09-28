const zones = ['Café', 'Café', 'Garden', 'Garden', 'Studio', 'Studio', 'Courtyard', 'Courtyard'];
export function sessionKey(agent) {
  return JSON.stringify([agent.provider, agent.sessionId]);
}
export function mergeSessions(telemetry, discovered) {
  const records = new Map(telemetry.map((a) => [a.id, a]));
  for (const found of discovered) {
    const old = records.get(found.id);
    if (!old) records.set(found.id, found);
    else {
      const preferHistory =
        found.updatedAt > old.updatedAt && (found.observedAt || 0) > (old.observedAt || 0);
      records.set(found.id, {
        ...(preferHistory ? found : old),
        name: found.name,
        color: found.color,
        updatedAt: Math.max(found.updatedAt, old.updatedAt),
        sequence: old.sequence,
      });
    }
  }
  return [...records.values()];
}

// One stable seat per top-level session, ordered by its newest member's activity.
export function seatLatestSessions(agents, previous = []) {
  const groups = new Map();
  for (const agent of agents) {
    const key = sessionKey(agent);
    const group = groups.get(key) || { key, members: [], updatedAt: 0 };
    group.members.push(agent);
    group.updatedAt = Math.max(group.updatedAt, agent.updatedAt);
    groups.set(key, group);
  }
  const top = [...groups.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt || a.key.localeCompare(b.key))
    .slice(0, 8);
  const seats = new Map();
  const occupied = new Set();
  for (const group of top) {
    const old = previous.find((a) => sessionKey(a) === group.key && a.seat >= 0 && a.seat < 8);
    if (old && !occupied.has(old.seat)) {
      seats.set(group.key, old.seat);
      occupied.add(old.seat);
    }
  }
  for (const group of top) {
    if (seats.has(group.key)) continue;
    let seat = 0;
    while (occupied.has(seat)) seat++;
    seats.set(group.key, seat);
    occupied.add(seat);
  }
  const representatives = new Map(
    top.map((g) => [
      g.key,
      g.members.find((a) => a.agentId === 'main') ||
        g.members.find((a) => !a.parentId) ||
        g.members[0],
    ]),
  );
  return agents
    .map((a) => {
      const key = sessionKey(a);
      const seat = representatives.get(key)?.id === a.id ? seats.get(key) : 8;
      return { ...a, seat, zone: seat < 8 ? zones[seat] : 'Outside the grove' };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
}
