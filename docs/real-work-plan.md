# Agentarium real-work attention plan

Status: implementation in progress. Written September 29, 2026. This is the next product milestone before another major map expansion. The separate [desktop companion plan](companion-product-plan.md) is an independent project brief.

## Implementation checkpoint

The first code milestone now provides optional validated rich context, persisted attention episodes, searchable task briefs, local acknowledgements, attention-first list/seating, supplied result links, a bounded durable recap, and bridge capability diagnostics. Read [the usage and limits guide](real-work.md) for exact current behavior.

The plan below remains the target, not a claim that every acceptance gate is complete. Built-in adapters remain status-only; real provider-version validation, richer provider capture, native source navigation, a configurable retention/clear-data UI, discovery-change recap, and finer concurrent-request semantics remain outstanding. Current history starts at upgrade and records accepted telemetry only. Verification so far uses automated fixtures and an isolated synthetic browser workflow.

## Product outcome

Help people answer: **What is my AI working on, what needs me, and what happened while I was away?** Every useful signal should lead to context or an action. The world makes activity memorable; the task list must make it immediately accessible.

The initial audience is people running several AI tasks across tools. Developers need to find changes, failures, and test results. Knowledge workers need to find research, drafts, and decisions. Both follow the same structure: task → progress → attention → result.

| Need                      | Product behavior                                               | World expression                        |
| ------------------------- | -------------------------------------------------------------- | --------------------------------------- |
| Know what is happening    | Real task identity, source, and trustworthy activity           | Residents reflect reported activity     |
| Know what needs attention | Explicit requests, reported failures, and observation problems | Restrained resident indicators          |
| Recover context           | Objective, latest meaningful activity, and next step           | Selecting a resident opens its brief    |
| Act on results            | Open a source session or supported output; acknowledge locally | Resident becomes an entry point to work |

## Existing foundation and actual gaps

The current implementation already provides provider-qualified identity, a list beyond eight seats, stable recent-session seating, pins, hiding, and attention filtering across known waiting/failed residents. It separates bridge connectivity from task state, exposes discovery diagnostics, and persists telemetry snapshots. See [session management](session-management.md), [local discovery](local-discovery.md), and [bridge protocol](bridge-protocol.md).

The missing layer is actionable context: structured requests, trustworthy source links, result metadata, durable attention history, and a recap that survives disconnection. Current attention is a status filter, not a request inbox. The browser activity feed is not a durable history view. Discovery is bounded and cannot promise every historical session. Existing adapters intentionally omit prompts, tool results, and full transcripts; richer content cannot simply be assumed available.

## Intended journey

1. Connect a provider and see its supported observations, evidence source, and last successful update.
2. Browse known sessions in a compact list; the world seats up to eight without limiting the list.
3. Select a task to understand its objective, last reported activity, freshness, and available actions.
4. When explicit input is requested, an attention item shows the request, its age, and an Open session action where supported.
5. Return later to a Since you were away view containing meaningful changes, unresolved requests, and supplied results.
6. Open the original work, or acknowledge a result locally. Neither action implies approval or completion at the provider.

Example: “Choose a deployment target” appears only when supplied as a supported request. Without request text, show “Provider reported waiting; details unavailable.” Never manufacture the question from a generic waiting state.

## Feature requirements

### Task brief and complete list

Show provider, session identity, member/subagent identity when known, objective/title, last meaningful activity, event time, observation time, freshness, and source. Label unavailable fields explicitly. A session can contain multiple turns; a completed turn does not permanently complete the conversation. Introduce run/turn identity only where supported, with clearly labeled session-level fallback.

All retained known tasks remain reachable without the camera. Keep list filtering independent of seating. Provide recent-first and attention-first list modes, search, and a clear indication of reader limits. Render meaningful text without requiring animation, hover, or color recognition.

### Attention inbox

Represent actionable requests and reported failures as distinct items with stable identity, first/last occurrence, source evidence, and resolution state. Display observation problems separately: lost connection is not a request for input or proof that work failed.

Deduplicate repeated notifications and reconnect snapshots. Preserve unresolved items across reload and bridge restart. Later authoritative evidence can resolve an item; local acknowledgement means seen, not resolved. If an integration cannot identify individual requests, use a documented session-level status episode and show that limitation.

Hidden and unseated sessions remain discoverable from attention. Preserve existing pins and hiding. An optional attention-first seating mode fills unpinned seats from non-hidden attention sessions before recency; it never silently unhides a session or evicts a pin. Apply stable tie-breaking and retain eligible seats to avoid visual churn. Display overflow counts when pins occupy all eight seats.

### Completion handoff

Show the reported outcome, completion time, and available output references. Distinguish successful completion, failure, and interruption. A turn-ending event alone must not imply that the user's objective was achieved or that tests passed.

Use producer-supplied summaries only when explicitly enabled and supported. Otherwise show a factual fallback such as “Turn completed; no outcome summary supplied.” Do not add generated summaries in the first release. Acknowledge completion locally without changing provider state.

### Away recap

Show completions, new requests, reported failures, and meaningful connection changes since the user's last acknowledged recap cursor. Merely focusing the window must not erase unseen items. Offer an explicit Mark reviewed action; unresolved requests remain in the inbox afterward.

Use durable bridge history and an opaque ordered cursor rather than browser wall-clock time. Scope cursors to bridge identity and consumer identity. Paginate and bound responses. If retained history has been pruned or the database replaced, show an incomplete-history notice and available range. Repeated scans must not flood the recap with identical discoveries.

### Integration diagnostics and actions

Each integration reports capabilities separately: session discovery, lifecycle, explicit requests, outcomes, artifact references, and source navigation. Show the adapter/version last validated, last successful observation, last event, freshness, and unsupported capabilities. A connected WebSocket is not evidence that every provider is reporting.

The first release supports Open session and validated output links, plus local acknowledgement and organization. If navigation is unsupported, offer Copy session ID and clear instructions instead of inventing a deep link. Do not send prompts, approve operations, cancel work, or launch provider tasks.

## State and protocol design

Evolve the shared contract before adding UI. The following are proposed concepts, not fields currently accepted by `/events`:

| Concept           | Minimum information                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Evidence          | Provider, adapter/source, event time, observation time, freshness                         |
| Task context      | Stable session/member keys, optional run key, objective, latest activity                  |
| Attention item    | Stable request/episode key, kind, bounded message, first/last seen, resolution evidence   |
| Result            | Run/episode association, reported outcome, optional bounded summary and output references |
| Navigation target | Validated target type and destination, capability that supplied it                        |
| History record    | Durable monotonic cursor, event identity, normalized meaningful change                    |
| Consumer state    | Bridge-scoped recap cursor and local seen/acknowledged choices                            |

Keep factual state, transport health, attention state, and cosmetic movement separate. Walking to a café must never create a work event. Reuse provider/session/agent identity and event deduplication; do not key records by resident seat.

Add explicit protocol version/capability negotiation, validation limits, TypeScript declarations, SQLite schema migrations, and old-record defaults. Old producers must continue to report basic statuses. Unsupported rich metadata should degrade visibly, not drop otherwise valid status events. Preserve ordering and distinguish provider timestamps from receipt order.

Persist normalized meaningful history and unresolved attention transactionally. Define configurable retention and a bounded resolved-history policy before release; unresolved attention must not disappear with ordinary event pruning. Discovery-derived changes need their own evidence label and deduplication policy, never synthetic hook attribution. Do not assume the current 10,000-event log is a complete or permanent activity history.

## Implementation sequence and acceptance gates

### 1. Establish trustworthy evidence

Audit actual provider payloads using controlled sessions. Record a capability matrix and sanitized fixtures; choose one verified integration for the first complete experience. Extend the protocol, migrations, and normalized state with optional context and attention evidence.

Likely touchpoints: `src/shared/protocol.mjs`, its declarations, `bridge/adapters.mjs`, `bridge/discovery.mjs`, `bridge/server.mjs`, and browser ingestion/types.

Acceptance: legacy events still work; migrations preserve identity and sequence; duplicates/out-of-order events cannot reopen resolved requests; missing capabilities produce honest fallbacks. Verify working, waiting, failure, completion, and reconnect against the selected installed provider rather than fixtures alone.

### 2. Ship task briefs and attention

Build a shared task/attention projection consumed by the list, inspector, and world. Extend the existing attention filter into an inbox. Add validated source navigation and explicit local acknowledgement. Implement recent-first/attention-first choices with the seating policy above.

Likely touchpoints: `src/state.ts`, `src/sessions.ts`, `src/shared/live.mjs`, `src/preferences.ts`, `src/SessionControls.tsx`, `src/App.tsx`, and small presentation changes in `src/World.tsx`.

Acceptance: a waiting task outside the latest eight, including a hidden task, is discoverable without camera interaction. Pins survive view changes. Status is readable with reduced motion. Repeated updates create one attention item, and a genuine new request can demand attention again.

### 3. Ship durable recap and completion handoff

Add an authenticated, paginated history query with a consistent snapshot/cursor boundary. Persist normalized outcomes and output references. Build Since you were away with explicit review and retention-gap handling.

Acceptance: events arriving during history fetch/reconnect are neither lost nor duplicated; restart preserves unresolved requests; acknowledgement does not resolve provider work; two viewers have independent review cursors; unavailable outputs and pruned history are explained.

### 4. Validate usefulness and harden release

Run realistic multi-task sessions with developers and knowledge workers. Test keyboard-only and reduced-motion use, reconnects, stale history, bounded discovery, and provider-version mismatch. Update setup, protocol, architecture, lifecycle, troubleshooting, and capability documentation alongside each shipped phase.

Release gate: users can identify what needs them, understand the evidence, and reach the original task without navigating the world. Do not broaden provider claims until their end-to-end checks pass.

## Privacy and trust boundaries

Keep the bridge local and authenticated. Rich request/outcome text is a deliberate metadata expansion: make it opt-in, bounded, locally stored, and removable. Do not collect credentials, reasoning, full transcripts, or arbitrary tool arguments/results. Document retention and clearing behavior. Redact fixtures and diagnostic exports.

Treat provider text and links as untrusted data. Render plain text; validate navigation schemes and destinations. Do not execute arbitrary commands or turn local paths into shell invocations. Display unsupported local outputs as descriptive references until a safe opener exists.

## Success measures and deferred scope

Compare the same multi-task workflow with and without Agentarium: time to find an input request, time to reach the relevant session/result, missed requests, and misleading alerts. Start with explicit usability sessions and local diagnostics rather than adding remote analytics. Record a baseline before setting numerical improvement targets.

Defer major map expansion, higher resident capacity, cross-provider command/control, billing, cloud synchronization, team accounts, and generated summaries. The key hypothesis is that people keep Agentarium open because it catches meaningful work changes and helps them act faster.
