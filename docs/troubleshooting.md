# Troubleshooting

## Development server will not start

Check `node --version` against the Node 22.13 minimum, then run `npm ci` from the repository root. Vite uses port 5173 with strict-port behavior. If it is occupied, stop the conflicting process or intentionally choose another port and update bridge allowed origins to match.

An experimental SQLite warning on Node 22 is not itself a bridge startup failure. Read subsequent error output for filesystem, port, or runtime errors.

## Connected world is empty

A fresh live database has no residents. Connecting the browser does not launch agents. Export the printed bridge token in a producer terminal and run `npm run bridge:demo` to separate transport problems from provider configuration problems.

## Bridge connection fails

1. Confirm the bridge is running and inspect `http://127.0.0.1:4318/health` locally.
2. Use `ws://127.0.0.1:4318` in the browser, including `ws://` rather than `http://`.
3. Use the token printed by the current bridge process. A restart generates a new token unless `GROVE_TOKEN` was supplied.
4. Verify the page's exact origin is allowed. Scheme, host, and port all matter.
5. If you customized the port, update both browser URL and producer `GROVE_URL`.

The server binds IPv4 loopback. Prefer `127.0.0.1` when `localhost` resolves unexpectedly. An HTTPS-hosted page may block a plain local WebSocket, and hosted origins are not allowed by default. Use the locally served app; do not disable browser security.

Authentication failure closes with `4003` and stops automatic retries. Reconnect explicitly with the correct token. Other disconnects retry with exponential backoff capped at 30 seconds.

## Hooks run but nothing appears

The provider process must inherit `GROVE_TOKEN`; exporting it after that process started does not update its environment. Check stderr for hook delivery diagnostics. The hook returns success even if delivery fails so it does not block the provider's normal workflow.

Regenerate hook configuration after moving the repository or changing Node installations. Confirm the generated entries were merged into the configuration actually used by that provider and that the provider emits the hook names supported by the adapter. Never replace unrelated existing hooks while troubleshooting.

For Codex, the proxy must be launched by a compatible App Server client. It does not attach to an existing desktop session merely because it is running.

## Events are ignored or statuses look unexpected

A `200` event response with `accepted: false` is a duplicate or stale event, not a transport failure. Check event IDs and sequence continuity. Starting sequence numbers over for an existing session/agent will keep producing stale events; use a new session for independent runs.

Missing provider agent IDs fall back to `main`; missing hook session IDs fall back to `default`. This can combine work that should be separate. Tool failure can map to failed before the task later recovers. Session end maps to idle rather than removing the resident.

Omitted task text preserves the previous task label. No event means no inferred status change: there is no per-agent inactivity timeout.

## Residents are missing from the scene

Only the eight most recently active sessions render in 3D. Older residents and child agents remain in the list. Completion does not delete a session, and there is no deletion API. The bridge rejects additions beyond 256 residents. Use a separate database for a fresh experiment while retaining previous data.

If residents become disconnected after restarting the bridge, that is expected recovery behavior. Fresh events restore their reported status.

## Rendering or build issues

Run `npm run build` to check TypeScript and asset compilation. A large-chunk warning for the 3D bundle is a known optimization opportunity, not a build failure.

For poor frame rate, use low quality, disable cinematic orbit, and check browser WebGL support. For missing characters, verify that `/models/robot.glb` is served successfully and inspect the browser console. Subpath hosting needs asset URL review. Network-blocked Google Fonts can change typography without affecting the local model asset.

## Useful evidence for a bug report

Include Node version, browser, operating system, provider version when relevant, current mode, reproduction steps, and the relevant error/status code. Use redacted synthetic event examples. Exclude tokens, prompts, transcripts, and sensitive tool data.

## Discovery reports no sessions or unknown activity

Restart the bridge after upgrading, reconnect, and enable a reader. A connected bridge alone does not enable discovery. Cards distinguish missing history, empty storage, format/read errors, and successful scans. CLI histories are separate from Claude/Gemini web histories. Check the provider home directory in the bridge environment. See [Local session discovery](local-discovery.md).

Claude/Gemini discovery supplies existence and recency; add hooks for activity. Codex working/tool observations expire after two minutes without supporting records. Hook/proxy event counters do not include history scans.

## Task details or recap are missing

Restart the bridge and reconnect to load its new capabilities. An older bridge can still supply status while lacking durable recap or stable acknowledgement scope. Recap only contains meaningful telemetry accepted after the upgrade; local discovery scans and events lost during downtime are not included.

Built-in adapters still omit request bodies, outcomes, and source links. Enabling `GROVE_RICH_CONTEXT=1` allows an explicitly configured producer to send these optional fields; it does not enrich existing adapters automatically. Without a source link, use Copy session ID. “Marked seen” is local acknowledgement, not provider resolution. See [Real-work attention and recap](real-work.md).
