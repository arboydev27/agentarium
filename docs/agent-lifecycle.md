# Agent lifecycle

## Status vocabulary

| Status         | UI label        | Meaning and visual behavior                                            |
| -------------- | --------------- | ---------------------------------------------------------------------- |
| `idle`         | On a break      | Available/inactive; idle animation, closed laptop                      |
| `working`      | Working         | Reported task activity; sitting with small procedural arm movement     |
| `tool`         | Using a tool    | Reported tool activity; sitting with laptop open                       |
| `waiting`      | Needs you       | Waiting for input or approval; remains seated with laptop open         |
| `completed`    | Completed       | Reported completion; celebration animation                             |
| `failed`       | Needs attention | Reported failure; negative gesture animation                           |
| `disconnected` | Disconnected    | Activity is no longer confirmed through the connection; idle animation |

These statuses reflect telemetry. For example, a Claude tool failure maps to `failed` even if the overall task later recovers. The protocol does not enforce a transition graph: any valid newer event can change status, including restarting a completed agent.

A typical sequence is `idle → working → tool → working → completed`. Waiting, failure, and disconnection can occur between those steps. Silence does not trigger an agent timeout.

**Activity unknown** is a separate live status for discovered sessions without sufficiently reliable activity evidence; it uses the idle pose without claiming the task is idle.

## Identity and ordering

The stable agent key is `JSON.stringify([provider, sessionId, agentId])`. Snapshots retain explicit session and agent IDs. Old bridge snapshot keys are upgraded at startup without resetting sequence values. Use stable IDs and a consistent provider on every event (omission means Custom); a parent ID is scoped to the same provider and session.

An event for an existing agent must have a strictly greater `sequence` than the last accepted event. An equal or lower sequence is stale, regardless of its timestamp. Use a monotonic per-agent counter in custom producers and preserve its continuity across producer restarts for an existing session.

The bridge also deduplicates event IDs against retained SQLite event rows. The browser maintains a bounded set of 3,000 recently accepted event IDs. A unique event ID does not bypass sequence checks.

Live presentation selects up to eight non-hidden provider-qualified sessions, prioritizing pins then recency and preserves seats for surviving sessions. New eligible sessions replace the least recent visible sessions. Subagents share their session's capacity rather than taking extra seats when a main resident is known. Older residents remain in the list. The bridge retains up to 256 telemetry agents; discovery separately keeps up to 64 recent sessions per provider in memory. See [Local session discovery](local-discovery.md).

## Metadata updates

New agents default to provider `Custom`, a generated name, and the task text `Connected agent` when those fields are absent. Later events preserve omitted metadata. To change an existing task label, send a new `task` value; omitting it preserves the earlier label even on completion.

A supplied parent ID becomes a same-session parent reference. Omitting it preserves the relationship; the current reducer does not provide an explicit operation to clear it. A visual relationship line appears only when both residents occupy visible seats.

`updatedAt` comes from the event timestamp. `startedAt` is set on creation, and resets when a resident goes from idle, completed, or failed into working. Tool-to-working transitions preserve the start time. Timestamps are supplied by producers, so clock differences affect elapsed-time displays.

## Simulation behavior

The simulator starts with eight named residents and mixed statuses. Its timer runs every `6500 / speed` milliseconds; the UI cycles through 1×, 2×, and 0.5×. Each tick picks one resident:

- Working becomes tool activity.
- Tool activity becomes waiting with a 25% probability, otherwise completed.
- Completed becomes idle; idle becomes working.
- Waiting, failed, and disconnected do not automatically recover.

Spawning a demo task reuses an idle or completed resident. Delegation optionally associates it with a parent. It does not create a ninth visual seat or call an AI provider. Pausing stops simulation progression and ordinary character animation; elapsed-time displays still use wall-clock time.

Reset restores demo agents and clears selection/activity. It does not reset every display preference. Returning from live mode also creates fresh demo state.

## Disconnection

When the browser socket closes, last reported statuses remain intact and the UI labels updates as paused. On reconnection, the server snapshot replaces that state. When the bridge restarts, recovered agents retain their status with `telemetryStale: true` until a newer accepted event or newer history evidence arrives. A socket heartbeat checks connection health, not whether an individual external task is alive.

See [state.ts](../src/state.ts) and the [shared reducer](../src/shared/protocol.mjs) for exact behavior.

See [Managing live sessions](session-management.md) for local presentation choices and attention handling.
