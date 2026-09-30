# Real-work attention and recap

Agentarium now has a first implementation of the [real-work plan](real-work-plan.md). It observes work; it never answers provider questions, approves operations, starts tasks, or cancels them.

## Using it

Restart the bridge after updating, then reconnect through Simulation / Manage connection. Existing hook/proxy producers continue to work without configuration changes.

- **Search tasks** searches resident names, providers, session IDs, task labels, supplied objectives, and request text in the current view.
- **List order → Attention first** sorts attention ahead of routine activity. The list is not limited to eight residents.
- **World seating → Pins, then attention first** prioritizes non-hidden attention sessions for unpinned seats. Pins retain priority, hidden sessions remain hidden, and eligible residents retain their seats. The overflow count includes unseated subagents; subagents share a session's resident.
- **Need attention → View all** clears search and session filters and includes hidden and unseated residents. Select a task to read its brief and first-reported request time.
- **Mark seen locally** acknowledges an episode without resolving it. A new episode becomes unseen. Saved acknowledgements are scoped to bridge database, agent, and episode, and bounded to the latest 512 acknowledgements in this browser origin. Older acknowledgements may appear unseen again.
- **Recap** loads meaningful hook/proxy changes since the last explicit review. Refresh retrieves newer changes; Load more follows the same fixed upper cursor. Mark loaded changes reviewed advances only through loaded entries, not unread pages or later arrivals. It never clears unresolved attention.

Search, list order, and seating mode are temporary. Existing pin/hide choices remain saved. Recap cursors persist separately for each bridge database and browser origin. Different browsers have independent review state; tabs can have stale displays until refreshed. An unavailable browser store produces a visible error when saving.

## Task briefs and truthful fallbacks

The brief distinguishes objective from latest activity, names the provider and evidence source, and includes member/run identity where supplied. Built-in adapters currently supply status and generic task/tool labels, not full objectives, request bodies, result summaries, or source links. No details are guessed.

Waiting/failure starts an attention episode. Repeated accepted waiting/failure events retain the episode's first timestamp. Unknown/disconnected events preserve earlier unresolved attention. Accepted working/tool/idle/completed evidence ends it. A distinct supplied request or run begins another episode. This is one current episode per agent, not a provider-native queue of simultaneous approvals. Per-agent sequence validation rejects stale delivery; a producer that incorrectly labels an old request as a newer event can still reopen it.

Newer conclusive local-history evidence can supersede telemetry attention; newer unknown history preserves it. Discovery-only attention uses a timestamp-based fallback identity and is not durably archived. Restarted telemetry stays marked stale until fresh evidence arrives.

A completion is a reported turn/status ending, not proof the user's objective succeeded. Supplied outcomes are labeled as reported. A later task does not inherit the prior result. HTTPS source/output links open in a new tab; unsupported links are rejected. Without a source link, Copy session ID provides a fallback. Clipboard failure offers manual-copy guidance.

## Optional rich context

Rich metadata is off by default. A deliberately configured producer can supply an optional `work` object after starting the bridge with:

```sh
GROVE_RICH_CONTEXT=1 npm run bridge
```

The token still belongs in the producer's environment. Enabling this setting does not change the built-in adapters or discover extra content automatically. An event containing `work` is rejected when the setting is off; status-only events remain accepted. See [Bridge protocol](bridge-protocol.md#real-work-context-and-history) for validation and a sample.

Rich text is displayed as plain text and stored locally in agent snapshots, the bounded event log, and meaningful recap records. Do not include secrets, full transcripts, reasoning, or arbitrary tool arguments/results. HTTPS destinations must have no embedded username/password. Local files, shell commands, custom schemes, and HTTP links are unsupported.

Turning the flag off stops new rich events; it does not erase previously saved metadata. There is no in-app clear-history control yet. To start with empty storage while preserving the old database for backup, stop the bridge and point `GROVE_DB` at a new file. This produces a new bridge identity and independent acknowledgement/recap state. Browser site-data clearing removes local presentation choices, not the bridge database.

## Recap coverage

The bridge stores up to 10,000 meaningful records in a separate cursor-ordered journal: new attention episodes, transitions to completed/failed, new terminal runs, and reported unknown/disconnected transitions. Routine tool events and repeated waiting signals do not flood the recap. Request detail updates within the same episode update the brief, not the earlier journal entry.

History begins when this version starts recording; existing event logs are not backfilled. It excludes local discovery scans, browser connection interruptions, and telemetry lost before delivery. It is not a complete record of all provider activity. If retention removes entries after a saved cursor, the UI identifies incomplete history. Unresolved telemetry attention persists in agent snapshots independently of journal pruning.

Recap entries are historical observations: inspecting one opens the current task brief, which may have changed or resolved. A missing current task is explained. Provider session IDs in the brief remain the fallback when source navigation is unavailable.

## Diagnostics and remaining validation

Connection setup now shows whether durable recap and rich context are available and explains built-in integration limits. Discovery cards and event receipt diagnostics remain separate. Capabilities are bridge features, not a promise that a specific installed provider supplies every field.

Automated checks cover status-only compatibility, rich validation, request identity, uncertainty, hidden/pinned overflow, history pagination, retention gaps, authentication, and database restart. Browser checks use an isolated bridge with synthetic tasks. Real installed Claude/Gemini/Codex request/result capture and source navigation still require dedicated adapter work and end-to-end verification. No new provider-version compatibility is claimed by this milestone.
