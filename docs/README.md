# Agentarium documentation

**Agentarium** visualizes agent activity as residents in a Mars-inspired 3D colony. The browser starts with simulated activity. Real activity requires the separate local bridge and a configured telemetry adapter.

Implementation guides describe the current code; planning documents are explicitly marked as proposed. The product plans were added September 29, 2026. Source files linked throughout are the authority when behavior changes.

- [World asset upgrade](world-asset-upgrade.md): completed family coverage, shared Blender kit, material pipeline, review evidence, and limits.
- [Blender reference habitat](blender-habitat.md): editable reference source, PBR materials, export workflow, and reference-area validation.

## Reading guide

| Document                                               | What it covers                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| [Getting started](getting-started.md)                  | Install, run, connect the bridge, and send a synthetic event                         |
| [Local session discovery](local-discovery.md)          | Existing chats, latest-eight seating, provider coverage, and evidence limits         |
| [Architecture](architecture.md)                        | System boundaries, data flow, and source ownership                                   |
| [Agent lifecycle](agent-lifecycle.md)                  | Status meanings, simulation, identity, ordering, and visual capacity                 |
| [Bridge protocol](bridge-protocol.md)                  | Event schema, HTTP, WebSocket, authentication, persistence, and configuration        |
| [Provider integrations](provider-integrations.md)      | Claude, Gemini, Codex, and custom telemetry                                          |
| [3D world](3d-world.md)                                | Scene construction, character animation, cameras, and performance                    |
| [Interface](interface.md)                              | The game HUD: layout, roster, panes, keyboard, idle fade, and narrow screens         |
| [World layout and rendering](world-layout.md)          | Zone dimensions, seat placement, detail levels, and expansion guidance               |
| [Resident identity and journeys](resident-journeys.md) | Accessories, personalities, cross-zone routing, reservations, and interruption rules |
| [Rendering performance](rendering-performance.md)      | Local frame timing, scene cost, quality checks, and measurement limits               |
| [Spatial scenery chunks](spatial-streaming.md)         | Terrain coverage, scenery cells, asynchronous landmarks, and recovery                |
| [Development](development.md)                          | Commands, formatting, tests, extension workflow, and deployment boundaries           |
| [Troubleshooting](troubleshooting.md)                  | Common startup, connection, attribution, and rendering problems                      |
| [Roadmap](roadmap.md)                                  | Current limitations and proposed next milestones                                     |
| [World expansion plan](world-expansion-plan.md)        | Horizon, connected districts, streaming, and performance gates                       |

For a first run, start with Getting started. For a new provider, read Agent lifecycle, Bridge protocol, and Provider integrations. For visual changes, read Architecture, 3D world, and Interface.

- [Real-work attention and recap](real-work.md): task briefs, attention-first views, optional context, durable history, and current integration limits.

## Product planning

- [Agentarium real-work attention plan](real-work-plan.md): the next in-repository milestone—task briefs, attention, results, away recap, and integration diagnostics.
- [Standalone desktop companion plan](companion-product-plan.md): a portable brief for a separate application and repository, with its own scope, architecture, and release gates.

The Agentarium plan tracks an implementation in progress; its usage guide distinguishes shipped behavior from remaining work. The companion brief remains a separate future project.

## Current scope

The implementation includes an eight-seat 3D environment, a simulator, a live event bridge, SQLite snapshots, provider adapters, and optional browser automation tools. It observes external agents; it does not launch real AI work, manage provider credentials, or schedule tasks. A working resident indicates the latest reported status, not independent proof that a model is currently computing.

The project uses a shared animated rig with alien equipment, identity-based palettes, and authored travel between colony facilities. Continuous desert terrain, craters, and distant mountains surround the settlement. Terrain combines fine nearby tiles and coarse coverage; inactive landmarks retain silhouettes. The Mars identity comes from the surface itself: sky, horizon, and far landforms. Northstar Spaceport includes a decorative rocket cycle and rover. Generated navmeshes, unbounded terrain, bespoke character bodies, and film-quality animation remain future work. Provider adapters have fixture tests; compatibility with a particular installed provider must be verified in that environment.

See [Mars reinvention](mars-reinvention.md) for implementation evidence and limitations.

- [Managing live sessions](session-management.md): pins, hiding, restoration, saved choices, and attention.
