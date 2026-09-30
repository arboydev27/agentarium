# Agentarium documentation

Agentarium is the repository; **Agent Grove** is the product name shown in the application. It visualizes agent activity as residents in a 3D world. The browser starts with simulated activity. Real activity requires the separate local bridge and a configured telemetry adapter.

These documents describe the implementation as of September 28, 2026. Source files linked throughout are the authority when behavior changes.

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
| [World layout and rendering](world-layout.md)          | Zone dimensions, seat placement, detail levels, and expansion guidance               |
| [Resident identity and journeys](resident-journeys.md) | Accessories, personalities, cross-zone routing, reservations, and interruption rules |
| [Rendering performance](rendering-performance.md)      | Local frame timing, scene cost, quality checks, and measurement limits               |
| [Development](development.md)                          | Commands, formatting, tests, extension workflow, and deployment boundaries           |
| [Troubleshooting](troubleshooting.md)                  | Common startup, connection, attribution, and rendering problems                      |
| [Roadmap](roadmap.md)                                  | Current limitations and proposed next milestones                                     |

For a first run, start with Getting started. For a new provider, read Agent lifecycle, Bridge protocol, and Provider integrations. For visual changes, read Architecture and 3D world.

## Current scope

The implementation includes an eight-seat 3D environment, a simulator, a live event bridge, SQLite snapshots, provider adapters, and optional browser automation tools. It observes external agents; it does not launch real AI work, manage provider credentials, or schedule tasks. A working resident indicates the latest reported status, not independent proof that a model is currently computing.

The project currently uses a shared robot rig with color variants and procedural scenery. The expanded island includes local walking routes and camera-aware decorative detail. Residents now have eight accessory styles and authored cross-zone navigation. Custom human characters, generated navmeshes, world streaming, and film-quality animation remain future work. Provider adapters have fixture tests; compatibility with a particular installed provider must be verified in that environment.

- [Managing live sessions](session-management.md): pins, hiding, restoration, saved choices, and attention.
