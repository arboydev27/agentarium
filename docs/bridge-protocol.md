# Bridge protocol

The [bridge server](../bridge/server.mjs) binds to IPv4 loopback (`127.0.0.1`). Its default address is `http://127.0.0.1:4318`; browser subscribers use `ws://127.0.0.1:4318`.

## Configuration

| Variable        | Consumer             | Default / behavior                                                                       |
| --------------- | -------------------- | ---------------------------------------------------------------------------------------- |
| `GROVE_PORT`    | Server               | `4318`                                                                                   |
| `GROVE_TOKEN`   | Server and producers | Server generates a random token when omitted; producers require the matching token       |
| `GROVE_DB`      | Server               | `bridge/data/grove.sqlite`, resolved relative to the server module                       |
| `GROVE_ORIGINS` | Server               | Comma-separated replacement for the default browser-origin list; entries are not trimmed |
| `GROVE_URL`     | Producers            | `http://127.0.0.1:4318`                                                                  |
| `CODEX_BINARY`  | Codex proxy          | `codex`                                                                                  |

Default origins are `http://127.0.0.1:5173`, `http://localhost:5173`, `http://127.0.0.1:4173`, and `http://localhost:4173`. Requests without an Origin header are permitted to reach authentication. Origin restrictions are browser protection, not a substitute for a token.

Environment variables must be passed through the launching shell/process; the project does not automatically load `.env` files. A relative custom `GROVE_DB` path is relative to the launching working directory. For example:

```sh
GROVE_DB=/absolute/path/to/experiment.sqlite npm run bridge
```

Changing the server port also requires changing the browser connection URL and producer `GROVE_URL`.

## Event schema

```json
{
  "id": "event-001",
  "agentId": "main",
  "sessionId": "session-001",
  "type": "working",
  "timestamp": 1790294400000,
  "sequence": 1,
  "name": "Research agent",
  "provider": "Custom",
  "task": "Reviewing the implementation"
}
```

The timestamp above is illustrative. Producers should send the actual current epoch milliseconds.

| Field       | Required | Validation                                                                                |
| ----------- | -------- | ----------------------------------------------------------------------------------------- |
| `id`        | Yes      | Nonempty string, at most 200 characters                                                   |
| `agentId`   | Yes      | Nonempty string, at most 200 characters                                                   |
| `sessionId` | Yes      | Nonempty string, at most 200 characters                                                   |
| `type`      | Yes      | `idle`, `working`, `tool`, `waiting`, `completed`, `failed`, `disconnected`, or `unknown` |
| `timestamp` | Yes      | Finite number ≥ 0, no more than five minutes ahead of bridge time                         |
| `sequence`  | Yes      | Nonnegative safe integer; strictly increasing for an existing agent                       |
| `name`      | No       | String, at most 200 characters                                                            |
| `provider`  | No       | `Codex`, `Claude`, `Gemini`, or `Custom`                                                  |
| `task`      | No       | String, at most 300 characters                                                            |
| `parentId`  | No       | String, at most 200 characters; same-session agent ID                                     |

Unknown properties are dropped. Old timestamps are allowed; ordering is based on sequence. See [Agent lifecycle](agent-lifecycle.md) for identity, merge semantics, and capacity.

## HTTP endpoints

`GET /health` requires no token and returns:

```json
{ "ok": true, "service": "agent-grove" }
```

`POST /events` requires `Authorization: Bearer <token>` and a JSON event body. The server limits the accumulated HTTP body to 65,536 JavaScript characters.

| Status | Meaning                                                                                       |
| ------ | --------------------------------------------------------------------------------------------- |
| `202`  | Accepted, persisted, and broadcast; `{ "accepted": true }`                                    |
| `200`  | Ignored duplicate or stale event; `{ "accepted": false, "reason": "duplicate" }` or `"stale"` |
| `400`  | Invalid JSON/event or another error caught during ingestion                                   |
| `401`  | Missing or invalid authentication                                                             |
| `403`  | Disallowed Origin                                                                             |
| `413`  | Request body exceeds the limit                                                                |
| `429`  | Adding a resident would exceed the 256-agent limit                                            |
| `404`  | Unsupported authenticated route/method                                                        |

Allowed preflight requests receive `204`. The current ingestion error handler also reports database errors as `400`, so inspect the returned error rather than assuming every such response is a schema mistake.

## WebSocket subscription

Connect and send authentication as the first message within five seconds:

```json
{ "type": "authenticate", "token": "your-bridge-token" }
```

The server sends a full snapshot after successful authentication:

```json
{ "type": "snapshot", "agents": [] }
```

Subsequent accepted events are wrapped as:

```json
{ "type": "event", "event": { "id": "..." } }
```

The abbreviated event above stands for the complete validated event. Snapshot entries are reduced Agent records, including their composite ID, status, seat, zone, color, timestamps, source, and metadata; see [state.ts](../src/state.ts) for the type.

Invalid or timed-out authentication closes the socket with code `4003`. Authenticated clients may configure local discovery as described below. Use HTTP for lifecycle event ingestion. WebSocket payloads are limited to 65,536 bytes. The server checks socket liveness using ping/pong every 15 seconds.

The browser retries closed connections after 1, 2, 4, 8, 16, then at most 30 seconds. Authentication failures are not retried automatically. A successful snapshot resets the retry counter. Credentials stay in memory and are not placed in the URL.

## Storage and delivery guarantees

SQLite uses WAL mode. Its original tables are `events` (ID, agent ID, sequence, JSON payload) and `agents` (composite ID and JSON snapshot). Accepted updates are transactional. The event table retains the newest 10,000 rows; agent snapshots retain current sequence values independently of event pruning.

An authenticated meaningful-history endpoint and versioned schema initialization are now available (see below); there is no resident deletion API. Snapshots recover current state after reconnect but do not rebuild the ephemeral activity feed. The separate Recap view reads durable history. Producer delivery has a two-second timeout and no retry queue, so telemetry can be lost while the bridge is unavailable. This is an observational prototype, not an exactly-once delivery system.

Built-in adapters forward selected lifecycle metadata and tool names. Custom producers can supply arbitrary allowed text, which is stored locally; keep secrets and unnecessary task content out of events. Do not expose this loopback service as a public multi-user backend without a separate security design.

## Local discovery messages

New servers include `discoverySupported: true` and a `providers` diagnostics array in the initial snapshot. An authenticated browser can send `{"type":"discover","providers":["Codex","Claude","Gemini"]}` with any subset, including an empty array to disable all local readers. Other provider values are rejected. Discovery is off by default and shared across viewers; choices reset at restart.

Scanning emits `{"type":"sessions","agents":[...],"providers":[...]}`. This is an authoritative merged resident snapshot, not a new lifecycle event. Browsers preserve event counters and stable latest-eight seating when applying it. A hook event is also followed by this merged snapshot. Provider diagnostics include enabled/state/count/detail/checkedAt.

Identities use the JSON-encoded tuple `[provider, sessionId, agentId]`; omitted event providers mean Custom. Existing bridge-owned keys are upgraded transactionally at startup. Discovered records are memory-only and have `evidence: "history"`, optional `observedAt`, and sequence -1 when no telemetry exists. Submitted events still require a nonnegative sequence. See [Local session discovery](local-discovery.md).

Restored telemetry records preserve their last status and include `telemetryStale: true` after a bridge restart. A newer accepted event clears the flag. Browser transport disconnection does not rewrite task statuses. Pin/hide preferences are local browser presentation choices and introduce no bridge commands.

## Real-work context and history

The updated snapshot advertises `protocolVersion: 2`, a persistent database `bridgeId`, and `capabilities: { attentionEpisodes: true, richContext: boolean, history: true }`. This is additive capability advertisement; legacy status-only producers and older snapshots still work. Reconnect after restarting an updated bridge to discover its capabilities.

`GROVE_RICH_CONTEXT=1` enables optional event `work` metadata. It is off by default. An event with `work` is rejected with HTTP 400 while disabled; strip the field to send a status-only event. Existing adapters do not automatically emit it.

```json
{
  "objective": "Prepare a product research brief",
  "activity": "Waiting for the destination choice",
  "runId": "run-1",
  "sourceUrl": "https://example.com/session/123",
  "request": {
    "id": "question-1",
    "kind": "input",
    "message": "Where should the brief be delivered?"
  }
}
```

This is the `work` object, not a full event. Use real supported destinations rather than the illustrative URL. `objective` and `activity` allow 300 characters; `runId` and request IDs allow 200. Request kind is `input` or `approval`; message is optional, up to 1,000 characters. Requests require a waiting event. Completed/failed events may instead include `result: { summary, url? }`, with a required nonempty summary up to 1,000 characters. Links are limited to 2,048 characters, HTTPS only, with no username/password. Unknown work properties are dropped. Empty required strings, oversized fields, and incompatible status metadata are rejected.

`GET /history?after=0&limit=50` requires the same bearer token and origin policy as events. The response contains `bridgeId`, `until`, `next`, `oldest`, `gap`, `hasMore`, and `items`. Each item has its monotonic `cursor`, event/agent/session identity, status, event time, bridge receipt time, task label, and supplied work/attention metadata. Subsequent pages pass `after=next&until=<original until>` to hold a fixed boundary while new events arrive. Limits are clamped to 1–100. Invalid/ahead-of-database cursors return 400. No credentials belong in query strings.

The journal retains 10,000 meaningful records independently of the raw event log. It begins at upgrade, without replaying old events. Cursor gaps caused by pruning are explicit. New attention episodes, terminal transitions/runs, and reported unknown/disconnected transitions are recorded transactionally with the agent snapshot. Discovery scans and browser transport state are not journaled.

SQLite `user_version` is now 2, with bridge-owned `metadata` and `history` tables created transactionally. Existing agent/event records retain identity and sequence. A newer unknown schema version is rejected. Bridge identity persists across restart and changes with a new database. Attention episodes are embedded in agent JSON snapshots and survive journal pruning. See [Real-work attention and recap](real-work.md) for acknowledgement, retention, and privacy limits.
