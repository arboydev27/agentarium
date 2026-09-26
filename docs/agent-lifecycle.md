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

## Identity and ordering

The stable agent key is `${sessionId}:${agentId}`. New snapshots also retain an explicit `sessionId` for session filtering. Older snapshots fall back to the composite ID until a fresh event supplies the explicit field. Use stable IDs within a session and a new session ID for independent runs. Avoid colons in either component to prevent ambiguous composite keys. A parent ID is interpreted within the child's session.

An event for an existing agent must have a strictly greater `sequence` than the last accepted event. An equal or lower sequence is stale, regardless of its timestamp. Use a monotonic per-agent counter in custom producers and preserve its continuity across producer restarts for an existing session.

The bridge also deduplicates event IDs against retained SQLite event rows. The browser maintains a bounded set of 3,000 recently accepted event IDs. A unique event ID does not bypass sequence checks.

New agents receive the lowest unused seat. Their color and zone are assigned from eight presets. There is no current agent deletion or seat-reclamation API. The bridge retains up to 256 agents, while the world renders seats 0–7; overflow residents remain in the UI list. Completing a live task does not remove its resident.

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

When the browser socket closes, its resident statuses become disconnected locally. On reconnection, the server snapshot replaces that state. When the bridge itself restarts, recovered agents are marked disconnected until fresh events arrive. A socket heartbeat checks connection health, not whether an individual external task is alive.

See [state.ts](../src/state.ts) and the [shared reducer](../src/shared/protocol.mjs) for exact behavior.
