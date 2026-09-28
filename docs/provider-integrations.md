# Provider integrations

This page covers hook/proxy telemetry. For existing chats and desktop session observation, see [Local session discovery](local-discovery.md).

All integrations below send telemetry to an already running bridge. They do not start tasks on behalf of the browser. First complete [Getting started](getting-started.md), then export the bridge's `GROVE_TOKEN` in the process environment that will run the adapter.

The mappings below describe [adapters.mjs](../bridge/adapters.mjs), not a guarantee that every provider version emits every event. Automated coverage uses fixtures; verify the provider version and event payloads in a real session before relying on attribution.

## Claude Code and Gemini CLI hooks

Generate the appropriate settings fragment from the repository root:

```sh
node bridge/print-hook-config.mjs claude
node bridge/print-hook-config.mjs gemini
```

Run only the command for the provider you intend to configure. The generator prints JSON; it does not edit settings. Merge the generated hook entries into the provider's applicable configuration, preserving existing hooks. Generated commands include absolute paths to the current Node executable and `bridge/hook.mjs`; regenerate them after moving the checkout or changing Node installations.

The hook reads JSON from stdin, normalizes it, and sends a best-effort HTTP event. It writes `{}` to stdout and exits successfully even when normalization or delivery fails, with diagnostics on stderr. Delivery can wait up to two seconds; the hook is not a background durable queue. Generated timeout values are 3 for Claude and 3000 for Gemini, matching the units assumed by this implementation.

### Claude mapping

| Hook                                | Agentarium status                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `SessionStart`, `SessionEnd`        | `idle`                                                                         |
| `UserPromptSubmit`                  | `working`                                                                      |
| `PreToolUse`                        | `tool`                                                                         |
| `PostToolUse`                       | `working`                                                                      |
| `PostToolUseFailure`, `StopFailure` | `failed`                                                                       |
| `PermissionRequest`                 | `waiting`                                                                      |
| `Notification`                      | `waiting` only for `permission_prompt`, `idle_prompt`, or `elicitation_dialog` |
| `Stop`                              | `completed`                                                                    |
| `SubagentStart`                     | `working`, parent `main`                                                       |
| `SubagentStop`                      | `completed`, parent `main`                                                     |

### Gemini mapping

| Hook                                      | Agentarium status |
| ----------------------------------------- | ----------------- |
| `SessionStart`, `SessionEnd`              | `idle`            |
| `BeforeAgent`, `BeforeModel`, `AfterTool` | `working`         |
| `BeforeTool`                              | `tool`            |
| `AfterAgent`                              | `completed`       |
| `Notification`                            | `waiting`         |

Gemini normalization currently does not inspect tool response error fields. Unknown hooks are ignored.

Both adapters use `session_id`, falling back to `default`, and `agent_id`, falling back to `main`. `agent_type` can provide the resident name. Missing IDs can collapse distinct work into one resident; they cannot be reconstructed reliably from the available metadata. Tool labels use `tool_name`. Prompts, tool arguments/results, transcript paths, and full provider payloads are not forwarded.

Hook sequences are derived from wall time and a high-resolution clock fragment. They are best-effort ordering values, not a durable per-agent counter; clock adjustments or tightly simultaneous hooks can produce stale events.

## Codex App Server proxy

Configure a client that already speaks Codex App Server stdio to launch:

```sh
node /absolute/path/to/agentarium/bridge/codex-proxy.mjs
```

The proxy launches `codex app-server`, forwards client stdin and server stdout, and observes server messages for telemetry. Extra proxy arguments are forwarded after `app-server`. Set `CODEX_BINARY` if the executable is not available as `codex`; inherit `GROVE_TOKEN` and optionally `GROVE_URL` in the launching environment.

Running this command alone is not a complete App Server client. It does not automatically attach to an existing Codex desktop conversation. The current adapter creates one `main` resident per thread and does not infer child agents.

| Server message                       | Agentarium behavior                                                      |
| ------------------------------------ | ------------------------------------------------------------------------ |
| `thread/started`                     | Idle resident                                                            |
| `turn/started`                       | Working                                                                  |
| `turn/completed`                     | Failed for failed turns, idle for interrupted turns, otherwise completed |
| `item/started`                       | Tool status for recognized tool item types                               |
| `item/completed`                     | Working for those same types                                             |
| `thread/status/changed`              | Active → working/waiting; notLoaded → disconnected; idle → idle          |
| Methods ending in `/requestApproval` | Waiting                                                                  |
| `item/tool/requestUserInput`         | Waiting                                                                  |

Recognized tool item types are `commandExecution`, `fileChange`, `mcpToolCall`, `webSearch`, and `dynamicToolCall`. Active status flags `waitingOnApproval` and `waitingOnUserInput` produce waiting status. Unrecognized messages and messages without a thread ID are ignored.

Telemetry sends are serialized, with errors reported to stderr. There is no durable retry queue or queue-size bound. Provider protocol forwarding is separate from those telemetry requests.

## Custom producers

Use `POST /events` with the [bridge event schema](bridge-protocol.md#event-schema). Choose stable agent/session IDs, globally unique event IDs, and increasing per-agent sequence numbers. Use `provider: "Custom"` unless the producer actually represents one of the named providers.

For a minimal transport smoke test, use `npm run bridge:demo`. For integration testing, verify working → tool → waiting → completion, a failure and recovery, duplicate/stale rejection, bridge downtime, and reconnect snapshots. Use synthetic metadata during those checks.

## Provider references

The existing integrations target these provider interfaces. Consult their current documentation when configuring an installed version:

- [Claude Code hooks](https://code.claude.com/docs/en/hooks)
- [Gemini CLI hooks](https://geminicli.com/docs/hooks/reference/)
- [Codex App Server](https://learn.chatgpt.com/docs/app-server)
