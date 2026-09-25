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

| Field       | Required | Validation                                                                     |
| ----------- | -------- | ------------------------------------------------------------------------------ |
| `id`        | Yes      | Nonempty string, at most 200 characters                                        |
| `agentId`   | Yes      | Nonempty string, at most 200 characters                                        |
| `sessionId` | Yes      | Nonempty string, at most 200 characters                                        |
| `type`      | Yes      | `idle`, `working`, `tool`, `waiting`, `completed`, `failed`, or `disconnected` |
| `timestamp` | Yes      | Finite number ≥ 0, no more than five minutes ahead of bridge time              |
| `sequence`  | Yes      | Nonnegative safe integer; strictly increasing for an existing agent            |
| `name`      | No       | String, at most 200 characters                                                 |
| `provider`  | No       | `Codex`, `Claude`, `Gemini`, or `Custom`                                       |
| `task`      | No       | String, at most 300 characters                                                 |
| `parentId`  | No       | String, at most 200 characters; same-session agent ID                          |

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

Invalid or timed-out authentication closes the socket with code `4003`. Later client messages do not ingest events; use HTTP for writes. WebSocket payloads are limited to 65,536 bytes. The server checks socket liveness using ping/pong every 15 seconds.

The browser retries closed connections after 1, 2, 4, 8, 16, then at most 30 seconds. Authentication failures are not retried automatically. A successful snapshot resets the retry counter. Credentials stay in memory and are not placed in the URL.

## Storage and delivery guarantees

SQLite uses WAL mode and two tables: `events` (ID, agent ID, sequence, JSON payload) and `agents` (composite ID and JSON snapshot). Accepted updates are transactional. The event table retains the newest 10,000 rows; agent snapshots retain current sequence values independently of event pruning.

There is no history/replay HTTP endpoint, migration framework, or resident deletion API. Snapshots recover current state after reconnect, but do not rebuild the browser activity feed. Producer delivery has a two-second timeout and no retry queue, so telemetry can be lost while the bridge is unavailable. This is an observational prototype, not an exactly-once delivery system.

Built-in adapters forward selected lifecycle metadata and tool names. Custom producers can supply arbitrary allowed text, which is stored locally; keep secrets and unnecessary task content out of events. Do not expose this loopback service as a public multi-user backend without a separate security design.
