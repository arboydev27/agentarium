# Roadmap and implementation limits

This is a proposed development sequence, not a list of shipped features or scheduled commitments. The current implementation is a playable prototype with a local telemetry path.

The first local-discovery milestone is implemented: opt-in readers, provider diagnostics, provider-qualified identities, and stable latest-eight session seating. The session-control milestone adds browser-local pins, hide/restore, attention across all sessions, and transport/task-state separation. Broader integration hardening remains below.

## Next product priority: real-work attention

Prioritize the [real-work attention plan](real-work-plan.md) before further major map expansion. Build on the existing all-session list, attention filter, pins/hiding, and diagnostics: establish richer trustworthy evidence, ship task briefs and actionable attention, then add completion handoffs and a durable away recap. The first implementation now includes task briefs, persisted attention episodes, attention-first views, and a bounded telemetry recap; see [current behavior and limits](real-work.md). Real provider capture and validation remain required. Its phased acceptance gates define the implementation sequence; the numbered areas below remain supporting work and longer-term directions.

The [desktop companion plan](companion-product-plan.md) belongs to a separate future project. It is documented here for reuse, not part of Agentarium’s implementation scope or desktop packaging milestone.

## 1. Validate real provider integrations

Run controlled sessions against selected Claude Code, Gemini CLI, and Codex App Server versions. Record the version, emitted payload shapes, attribution behavior, and supported lifecycle events. Add regression fixtures from sanitized payloads.

Acceptance: each supported integration has a documented setup tested end to end, including waiting, failure, completion, missing IDs, and bridge recovery. Explicitly document unsupported child-agent attribution.

## 2. Strengthen session and delivery management

Design resident/session cleanup, sequence continuity, bounded delivery queues, and retry semantics. Transport disconnection now preserves last reported state; further provider-level freshness policies remain. The real-work milestone adds versioned bridge schema initialization; continue testing future migrations before evolving persisted records.

Acceptance: independent sessions cannot accidentally overwrite one another, abandoned residents can be managed without deleting a database, and downtime behavior is both testable and visible to users.

## 3. Improve animation and world interaction

The first character-life milestone now includes generated keyboard/attention poses, local reversible routes, staged arrival/departure, brief completion reactions, follow camera, and watch mode. The original robot is retained. The resident-variety milestone now adds eight procedural accessory styles, stable leisure preferences, authored cross-zone routing, exclusive destinations, and shared-corridor reservations. Distinct new body rigs, generated navmeshes, local crowd steering, and a measured device performance budget remain future work.

The shared rig now has subtle anchored gestures at rest and shared destinations. Route reservations release cleared lanes while keeping the path ahead reserved, and they account for differently named overlapping lanes. Next, evaluate distinct body rigs against the keyboard/seat contract, add richer transition clips, and explore passing lanes or local crowd steering when capacity grows. Preserve reduced-motion alternatives and test interruptions.

Acceptance: characters transition without snapping or furniture intersections, replacement rigs have a documented asset contract, and representative devices meet an agreed performance budget.

## 4. Expand visual capacity

The spatial expansion now includes a 29.25 × 22.2 inhabited district, four explicit zones, a richer café/terrace, ten camera presets including a perspective Horizon, and connected routes to Meadow Lookout, Orchard Commons, Cedar Observatory, two meadow rests, and Southwind Mere. Optional meadow groundcover mounts in nearby spatial chunks, while the terrain, landmarks, and resident state remain continuously available. Arrow-key panning offers bounded travel through the finite 600 × 600 world. The visible capacity remains eight, and most distant landscape remains decorative. Asynchronous asset streaming and infinite terrain are not implemented.

The ambient-life pass adds tree sway, instanced perimeter leaves, basin ripples, evening halos, and surface refinements. An opt-in diagnostic overlay now exposes local frame intervals and renderer counters; initial observations are in [Rendering performance](rendering-performance.md).

The [world expansion plan](world-expansion-plan.md) defines the path from the current finite world to additional connected districts and true asset streaming. The outside paths now follow rendered terrain, and the optional map tracks visible residents; next, profile representative devices and establish a draw-call, triangle, and frame-time budget. Increase route capacity before adding many more destinations. Design a stable assignment policy for more than eight visible agents. Consider grouping by session/provider, focusing active work, and showing overflow intentionally. Profile geometry, animation mixers, DOM labels, and shadows before raising counts.

Acceptance: capacity behavior is understandable, selection works across groups, and expansion does not hide relevant waiting or failed tasks.

## 5. Package the local experience

Evaluate desktop packaging or a managed local launcher for the browser, bridge, credentials, and provider setup. Add diagnostics, explicit configuration ownership, and upgrade handling. Keep static hosted demo behavior distinct from local live connectivity.

Acceptance: a new user can install, connect, diagnose, and update the app without manually coordinating several terminals, while retaining control of existing provider settings.

## Current non-goals and gaps

There is no real-task launcher, provider billing dashboard, multi-user authorization system, public bridge deployment, full provider-history browser, automated settings installer, desktop package, or continuous-integration workflow. Session pin/hide preferences are persisted locally; visual preferences remain temporary. Asset and bundle performance have no formal budget yet.

The original cinematic-world vision will require substantial art direction, assets, animation work, and profiling in addition to application code. The existing architecture provides a place to connect that work to observable agent state.
