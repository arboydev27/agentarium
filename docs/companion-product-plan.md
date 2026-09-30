# Desktop AI companion: standalone product plan

Status: proposed independent project brief, September 29, 2026. This document can be copied into a new repository. It does not add a desktop companion to Agentarium or require Agentarium to be installed.

## Purpose and audience

Create one animated companion at the edge of the desktop that helps frequent AI users understand **what is running, what needs them, and what finished**. It should remain useful while someone writes, codes, researches, or uses another app.

The first audience is an individual running multiple AI sessions on one computer. The character provides a recognizable presence; accurate context and fast access to source sessions provide utility. Success means the user keeps it enabled because it catches meaningful moments without becoming distracting.

## Core experience

One companion represents overall AI activity, with one task in focus. It is not a separate character per agent. A compact badge shows the active-task count; an expandable panel provides a task switcher, attention queue, task brief, and recent results.

| Situation              | Visible behavior                                  | Action                                   |
| ---------------------- | ------------------------------------------------- | ---------------------------------------- |
| Work running           | Subtle working animation and optional short label | Inspect task or open session             |
| Several tasks running  | Count badge and stable focused task               | Switch or pin focus                      |
| Explicit input request | Persistent restrained attention marker            | Read request and open source             |
| Reported failure       | Distinct failure indicator                        | Inspect supplied details and open source |
| Completion             | Brief notice, then quiet completed state          | Open available result or acknowledge     |
| Connection lost        | Separate unknown/connection indicator             | Inspect integration health               |
| Nothing running        | Quiet idle pose                                   | Expand panel or hide                     |

Example: while writing a document, the user sees “Updating sign-in flow · Working.” Later the companion shows “Needs your input.” Expanding it reveals the provider-supplied request and Open session. If the integration supplied only a waiting status, say that details are unavailable.

### Focus and notification rules

Default focus prioritizes unresolved explicit requests, then reported failures, then running work. Use stable ordering within a priority and avoid switching on every tool event. Users can pin a task; another task needing attention receives a badge without replacing that pinned focus. The panel always explains which task the character represents.

Deduplicate notices by request/completion identity. Local acknowledgement means seen, not provider approval or resolution. Snooze suppresses interruptions but retains the queue. Routine progress is quiet. Never steal keyboard focus, interrupt typing, or make every completion an urgent alert.

## First release scope

Start with macOS as the proposed first platform, one character, and one integration validated against real installed provider sessions. Select the integration through a short evidence spike; do not assume any desktop app exposes its live sessions merely because a CLI exists.

Include:

- Movable edge placement, saved position, compact mode, hide/show, snooze, and quit.
- Working, waiting, completed, failed, idle, and unknown/disconnected presentation.
- Multiple-task switching, pinned focus, clear source identity, and freshness timestamps.
- A small task brief and attention queue with supported Open session actions.
- Outcome and output references only when supplied by the integration.
- Setup diagnostics explaining supported observations and unavailable capabilities.
- Keyboard-accessible panel, reduced motion, text equivalents, and optional task-title hiding.

The app must install and run independently. Provider tasks continue normally when it is closed or disconnected. No Agentarium world, renderer, seat allocation, or simulator is required.

Defer direct prompts, approvals, cancellation, voice, custom-character marketplaces, cloud sync, billing, team features, Windows/Linux support, and broad provider coverage. A durable away recap is a follow-on after the attention loop is proven.

## Desktop architecture and feasibility spike

Use a desktop shell around a lightweight presentation layer and a local observation service. Select the shell after prototyping its window behavior on the target OS; this brief does not prescribe a framework or claim current OS API support.

Required spike checks:

1. Transparent edge window, dragging, saved placement, and display scaling.
2. Background animation without focus stealing; keyboard focus only on deliberate interaction.
3. Correct input hit regions so transparent space does not block other applications.
4. Behavior across multiple monitors, display removal, Spaces, fullscreen apps, sleep/wake, and screen locking.
5. Menu/tray access to show, hide, snooze, diagnostics, and quit even if the companion is offscreen.
6. Reduced motion, screen-reader labels, and keyboard access to all useful information.
7. Idle and active CPU, memory, and energy measurements; establish a budget before asset polish.

Define fallback behavior when an OS surface cannot support the overlay. Choose the least intrusive permissions supported by the design; do not assume screen recording, accessibility control, or transcript scraping is necessary.

Suggested modules:

| Module               | Responsibility                                                               |
| -------------------- | ---------------------------------------------------------------------------- |
| Local observer       | Opt-in adapters, authenticated local IPC, capability and health reporting    |
| Normalized state     | Session/run identity, ordering, deduplication, evidence, attention lifecycle |
| Companion controller | Focus priority, animation state, interruption budget, snooze                 |
| Desktop host         | Window lifecycle, input regions, display placement, startup/quit             |
| Task panel           | Briefs, queue, source navigation, settings and diagnostics                   |
| Local persistence    | Preferences, unresolved items, acknowledgements, bounded history             |

Prefer a bundled observer managed by the host for independent installation. It must own its process lifecycle and not leave orphan listeners. If an optional external bridge mode is later offered, negotiate protocol capabilities and handle missing/incompatible services explicitly.

## Observation contract and truthful behavior

Normalize provider-qualified session/member identity, optional run identity, status, event and observation timestamps, source evidence, capability flags, optional request/outcome text, and validated navigation targets. Keep transport health independent of the last reported task state.

A discovered chat is not proof of a running agent. An old working record should carry freshness uncertainty. A completed turn is not proof that the entire objective succeeded. Missing request text, output references, or deep links must have clear fallbacks. Unsupported navigation can offer Copy session ID.

Use stable request IDs where available; otherwise document a weaker status-episode model. Persist unresolved attention and deduplicate restarts/reconnects. Distinguish a new request from repeated observations of an existing request. One task's completion must not clear another task's attention.

## What to carry over from Agentarium

Agentarium is an existing browser-based 3D activity viewer backed by a local Node bridge. Its reusable lessons are provider-qualified identities, separate history/telemetry evidence, stale-state handling, validation, ordering, adapter fixtures, and reconnection diagnostics.

Candidate source areas to review when starting the separate repository:

- `src/shared/protocol.mjs` and declarations: event validation and reduction.
- `src/shared/live.mjs`: evidence merging and identity; exclude world seating.
- `bridge/adapters.mjs`, `bridge/hook.mjs`, and `bridge/codex-proxy.mjs`: observation adapters and delivery limits.
- `bridge/discovery.mjs`: opt-in bounded discovery with provider-specific limitations.
- Bridge/browser tests and documentation: sanitized fixtures, reconnect behavior, and setup lessons.

These are starting points, not a ready-made production SDK. Current adapters omit full request/result content, delivery can be lost during downtime, and provider support varies. Review dependency and asset licenses before copying. Keep provenance and tests with reused code.

Initially copy only the narrow reusable modules into the new repository, with their limitations documented. Extract a versioned shared package when both products demonstrate stable common needs. Neither product should import from the other's working directory or require the other to release first.

## Delivery plan

### Phase 1: prove useful data and desktop behavior

Validate one integration with working → request → resumed → completed, plus failure and disconnection. Build the minimal overlay spike and measure its resource cost. Record the actual provider version and supported capabilities.

Exit: the app observes real tasks and can remain at the edge of the screen without blocking ordinary work. Unsupported platforms/surfaces and navigation are documented.

### Phase 2: build the attention loop

Add normalized task state, multi-task focus, persistent attention, the task panel, and safe source navigation. Use a placeholder character while validating behavior.

Exit: two simultaneous tasks remain distinguishable; requests survive restart; a pinned task stays in focus; repeated events do not repeat notices; clicking an item reaches the correct source or an honest fallback.

### Phase 3: add character and user controls

Add one cohesive set of animations, transition rules, compact labels, snooze, title privacy, placement persistence, and accessibility. Keep animation cosmetic and independently pausable.

Exit: keyboard-only and reduced-motion use retain all functionality; dragging/display changes cannot strand the app; hidden/snoozed states remain recoverable; the overlay never takes focus without deliberate interaction.

### Phase 4: package and pilot

Package the app and observer, document installation and integration setup, and implement target-platform signing/distribution requirements after checking current platform documentation. Include upgrade/migration handling, clean quit/uninstall, and opt-in startup behavior.

Exit: a fresh installation works without an Agentarium checkout or manually managed development servers. Pilot users run real multi-task workflows and report useful alerts, missed events, distraction, and resource impact.

### Phase 5: expand only after validation

Add durable away recap, more verified integrations, richer supplied outputs, and then additional platforms. Preserve capability differences rather than presenting all providers as equivalent.

## Privacy, security, and validation

Keep observation local by default and opt in per integration. Store bounded metadata; do not collect provider credentials, full transcripts, reasoning, arbitrary tool arguments, or screen contents. Rich titles/request/outcome text needs explicit controls and a clear-data action. Diagnostic exports should be previewable and redacted.

Treat all provider content as untrusted. Render text safely, validate target schemes/destinations, and never execute a provider-supplied command through a link. Prefer private local IPC; authenticate any loopback network service. Keep operational provider actions out of the first release.

Test ordering, duplicates, restart, sleep/wake, offline periods, stale evidence, late events, multiple tasks, and unsupported capabilities. Verify actual window behavior on hardware, including display changes and fullscreen apps. Track usefulness through opt-in pilot feedback: time to notice a request, time to reach the task, false alerts, interruption burden, and how often users hide or disable the companion. Do not add remote analytics by default.

## Decisions to resolve when this project starts

- First supported provider and exact observation route, based on the integration spike.
- Desktop shell and character rendering format, based on window and resource tests.
- Default notice duration, focus stability, retention, and freshness policies.
- Supported source-navigation targets and fallback instructions.
- Distribution method, update ownership, and product name.

These decisions should not block documenting the concept, but they are prerequisites for promising a reliable installable product.
