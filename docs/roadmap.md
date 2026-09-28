# Roadmap and implementation limits

This is a proposed development sequence, not a list of shipped features or scheduled commitments. The current implementation is a playable prototype with a local telemetry path.

The first local-discovery milestone is implemented: opt-in readers, provider diagnostics, provider-qualified identities, and stable latest-eight session seating. The session-control milestone adds browser-local pins, hide/restore, attention across all sessions, and transport/task-state separation. Broader integration hardening remains below.

## 1. Validate real provider integrations

Run controlled sessions against selected Claude Code, Gemini CLI, and Codex App Server versions. Record the version, emitted payload shapes, attribution behavior, and supported lifecycle events. Add regression fixtures from sanitized payloads.

Acceptance: each supported integration has a documented setup tested end to end, including waiting, failure, completion, missing IDs, and bridge recovery. Explicitly document unsupported child-agent attribution.

## 2. Strengthen session and delivery management

Design resident/session cleanup, sequence continuity, bounded delivery queues, and retry semantics. Transport disconnection now preserves last reported state; further provider-level freshness policies remain. Add deliberate SQLite schema/version migration handling before evolving persisted records.

Acceptance: independent sessions cannot accidentally overwrite one another, abandoned residents can be managed without deleting a database, and downtime behavior is both testable and visible to users.

## 3. Improve animation and world interaction

Introduce authored typing and transition clips, richer character variety, and navigation between destinations. Define how seated work, standing, walking, and interruptions blend before adding pathfinding. Preserve reduced-motion alternatives.

Acceptance: characters transition without snapping or furniture intersections, replacement rigs have a documented asset contract, and representative devices meet an agreed performance budget.

## 4. Expand visual capacity

Design additional spaces and a stable assignment policy for more than eight visible agents. Consider grouping by session/provider, focusing active work, and showing overflow intentionally. Profile geometry, animation mixers, DOM labels, and shadows before raising counts.

Acceptance: capacity behavior is understandable, selection works across groups, and expansion does not hide relevant waiting or failed tasks.

## 5. Package the local experience

Evaluate desktop packaging or a managed local launcher for the browser, bridge, credentials, and provider setup. Add diagnostics, explicit configuration ownership, and upgrade handling. Keep static hosted demo behavior distinct from local live connectivity.

Acceptance: a new user can install, connect, diagnose, and update the app without manually coordinating several terminals, while retaining control of existing provider settings.

## Current non-goals and gaps

There is no real-task launcher, provider billing dashboard, multi-user authorization system, public bridge deployment, history API, automated settings installer, desktop package, or continuous-integration workflow. Session pin/hide preferences are persisted locally; visual preferences remain temporary. Asset and bundle performance have no formal budget yet.

The original cinematic-world vision will require substantial art direction, assets, animation work, and profiling in addition to application code. The existing architecture provides a place to connect that work to observable agent state.
