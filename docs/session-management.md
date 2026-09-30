# Managing live sessions

The live world has eight seats. Select a resident to **Pin session** or **Hide session**. These controls organize Agentarium; they never delete, archive, resume, or stop a provider's chat or task. Simulation keeps its original residents and controls.

## Pinning and seating

- Up to eight provider-qualified sessions can be pinned. Codex and Claude sessions with the same ID remain distinct.
- Available pinned sessions take priority; non-hidden recent sessions fill the remaining seats. Existing visible sessions retain their seats while eligible.
- Pins apply to a whole session, including its subagents. One session uses one character.
- A pin cannot retrieve a session absent from the bridge snapshot or outside the discovery reader's bounded recent history. Its choice remains saved, but it does not leave an empty seat. Remove absent pins from **Manage sessions** to free pin capacity.
- Unpinning returns a session to normal recency selection. It may remain seated if it is recent enough.

## Hiding and restoring

Hiding removes every resident in the session from the normal list and the world, and removes its pin. Fresh events do not automatically unhide it. The bridge continues to receive its events.

Use **Show residents → Hidden sessions** to inspect hidden residents in the current snapshot. Use **Manage sessions → Hidden sessions → Restore** to restore any saved choice, including sessions currently absent. Restoring returns a session to the recent-session pool; it does not repin it or guarantee a seat.

The session dropdown and Show residents filter affect the list only. They do not change seat assignments. If filters have no matches, the list explains why.

## Attention across all sessions

The **need attention · View all** button remains available when the resident panel is collapsed. It clears the session filter and opens all waiting/failed residents, including hidden sessions, subagents, and sessions outside the grove. Inspect them and optionally restore or pin their session. These are last reported states, not a separate confirmation that a provider is currently awaiting input.

The attention view does not automatically displace pinned sessions or modify saved choices. Completion or later accepted progress/idle evidence resolves an episode; unknown/disconnected evidence preserves earlier unresolved attention. There are no desktop notifications or provider-control actions.

## Saved choices

Pin and hide choices are stored in browser local storage under `agentarium.sessions.v1`, scoped to the app's origin (protocol, host, and port). Refreshing or reconnecting reapplies them. Using `localhost` instead of `127.0.0.1`, a different port, another browser, or clearing browser data creates a separate set of choices. Already-open tabs keep their own in-memory choices until reloaded; they do not synchronize changes live.

Storage contains the schema version and provider/session IDs only. It does not save bridge credentials, titles, task text, or agent status. Discovery enablement remains bridge-process configuration and resets on restart. Other visual preferences remain temporary.

Malformed or unsupported saved preferences fall back to empty choices with a visible notice. If storage is unavailable or full, changes still apply in memory and a warning explains that they were not saved. Use Manage sessions to review all stored pins and hidden choices.

## Bridge connection versus task state

A WebSocket disconnect preserves every last reported task status. The interface labels updates as paused and retains waiting/failed attention indicators. Character activity animation pauses until the connection returns. A successful reconnect hydrates the latest snapshot and reapplies session choices.

On a bridge restart, persisted telemetry preserves its last status and carries `telemetryStale: true`. The inspector identifies it as saved before restart and animation stays paused. A newer accepted event clears this flag; history evidence can supersede it when it is newer. A connected socket alone does not prove an agent is running. Older database records whose statuses were already overwritten by previous releases cannot recover that lost state without fresh evidence.

## Implementation and verification

- `src/preferences.ts`: versioned, validated browser storage with failure handling.
- `src/shared/live.mjs`: pin priority, hidden exclusion, stable seat allocation.
- `src/SessionControls.tsx`: inspector controls and saved-choice manager.
- `src/sessions.ts`: normal/hidden/attention filtering.
- `src/preferences.test.ts`, `src/bridge.test.ts`, and bridge integration tests: pin capacity, new arrivals, child hiding, restoration, reload persistence, storage errors, simulation isolation, disconnects, and restart evidence.

## Real-work controls

Task briefs, search, list ordering, optional attention-first seating, local seen acknowledgements, and durable Recap are described in [Real-work attention and recap](real-work.md). The default remains pins followed by recent sessions. Attention-first seating is opt-in and never overrides pins or hiding. The list remains available beyond the world's eight seats.
