# Local session discovery

The demo remains unchanged. In live setup, enable provider readers to discover existing local conversations and observe later activity without launching or resuming tasks.

## Setup

1. Restart `npm run bridge` after updating the code; keep the app running locally.
2. Open **Simulation**, connect using the current bridge token, and find **Discover existing sessions**.
3. Enable Codex, Claude, or Gemini discovery individually.
4. Check each card's availability, session count, last scan time, and limitations.
5. Close setup. The eight most recently active sessions occupy the world; older records remain in the list.

Discovery runs inside the bridge, so it does not require exporting `GROVE_TOKEN` to another terminal. External hook/proxy producers still require that export. If the UI asks for a bridge restart, reloading the webpage alone will not update the Node process.

## Coverage

| Provider        | Read-only source                                                                              | Activity evidence                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Codex           | Latest `state_N.sqlite` under `CODEX_HOME` or `~/.codex`; excludes archived and subagent rows | Selected lifecycle records in local session logs; works with saved desktop sessions at this location |
| Claude Code CLI | Top-level UUID `.jsonl` filenames under `CLAUDE_CONFIG_DIR/projects` or `~/.claude/projects`  | File metadata establishes existence/recency; configure hooks for activity                            |
| Gemini CLI      | `session-*.json` and `session-*.jsonl` under `~/.gemini/tmp/*/chats`                          | Session metadata establishes existence/recency; configure hooks for activity                         |

`GROVE_GEMINI_HOME` overrides the Gemini root. Pass overrides in the bridge's launching environment; `.env` files are not automatically loaded.

Readers are experimental and version-sensitive. Claude Desktop/web histories, Gemini web chats, Antigravity, remote machines, and cloud-only sessions are not covered. Missing history is reported as unavailable. On the development machine, a read-only smoke test found 44 Codex sessions; supported Claude/Gemini history directories were absent, so those readers were verified with fixtures rather than real provider sessions.

## Identity and seats

One character represents one provider-qualified session. Recency is the latest timestamp among its known members. The newest eight sessions receive seats; surviving sessions keep their seats and new eligible sessions take vacated ones. Older records remain in the list. Subagents do not take extra seats when the main resident is known. If only a child is known, it can represent that session until the main arrives.

Filtering affects only the list. Completion does not delete a session or force it out of a seat. Use the inspector for the full title, session ID, evidence source, and timestamps.

Agent identities use `JSON.stringify([provider, sessionId, agentId])`. Use a consistent provider/session/main-agent identity to merge discovery and telemetry. Existing bridge-owned snapshot keys are upgraded transactionally at startup without resetting sequence values. Provider storage is never migrated or edited.

## Evidence and freshness

A conversation is not proof of a running agent. Claude/Gemini discovery-only residents show **Activity unknown**. Codex recognizes recorded starts, tool calls/results, completion, and interruption. It does not infer approval state from arbitrary text. Working/tool evidence expires to unknown after two minutes without supporting records, so a quiet long-running operation can appear unknown.

The inspector labels history observations and their timestamps. Historical completion means the last recorded task completed. Completions older than 30 seconds use the idle pose; recent completions can celebrate. Hook/proxy statuses remain separately reported telemetry.

History refreshes do not increment the hook/proxy event counter or create synthetic activity-feed entries. The footer indicates local-session monitoring separately.

## Polling and privacy

Discovery is off initially. Enabled providers refresh approximately every five seconds while authenticated viewers are connected. Choices apply to the bridge process, are shared by its viewers, and reset on bridge restart. Disabling a provider removes its discovered records; separately persisted hook/proxy residents remain. Late results from a superseded scan are discarded.

Discovered records stay in bridge memory and are delivered to authenticated viewers. They are not written to the bridge event log. Titles can contain private content. The browser receives IDs, titles/names, timestamps, status evidence, and presentation fields. Codex/Gemini files are parsed locally, but transcript bodies, reasoning, tool arguments/results, and provider credentials are not forwarded. Claude discovery reads filenames and file timestamps only.

## Bounds and limitations

- At most 64 recent sessions per provider are returned per scan.
- Claude/Gemini enumeration stops at 1,000 project entries or 10,000 matching files and reports truncation.
- Codex examines only the last 256 KiB of each candidate session log.
- Gemini legacy JSON files over 2 MiB are skipped. JSONL uses a 64 KiB header and 256 KiB tail; unusual metadata rewrites outside those bounds may be missed.
- Partial/unsupported files may be skipped or shown with unknown activity. Nested subagent folders and symlink files are not enumerated.
- The telemetry store separately retains up to 256 residents. There is no full-history browser, provider-settings installer, cloud sync, session deletion, or task launcher.

## Implementation

[discovery.mjs](../bridge/discovery.mjs) implements the readers. [server.mjs](../bridge/server.mjs) handles authenticated configuration, polling, and merged snapshots. [live.mjs](../src/shared/live.mjs) merges records and assigns stable latest-eight seats. [Discovery tests](../bridge/discovery.test.mjs) and [live-state tests](../src/live.test.ts) exercise fixtures, content omission, identity, seating, and demo isolation.

Codex's supported `thread/list` API can list stored sessions, but a separate App Server is not automatically attached to the desktop process's runtime. This implementation explicitly labels its local-history observation rather than assuming that connection. See the [official App Server reference](https://learn.chatgpt.com/docs/app-server).

Storage references: [Claude Code sessions](https://code.claude.com/docs/en/sessions), [Gemini session management](https://geminicli.com/docs/cli/session-management/), and [Gemini recording source](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/services/chatRecordingService.ts).
