# Agentarium

The Agentarium repository contains **Agent Grove**, a runnable 3D world for AI agent activity. Built with React, TypeScript, React Three Fiber, Three.js, Zustand, and a local Node.js bridge.

## Documentation

See the [detailed documentation](docs/README.md) for setup, architecture, agent lifecycle, bridge protocol, provider integrations, 3D world internals, development, troubleshooting, and the proposed roadmap.

## What works

- A 29.25 × 22.2 island with an expanded café and terrace, communal table, espresso counter, studio, garden pergola, courtyard, landscaping, and day/evening lighting.
- Gentle tree sway, drifting leaves, courtyard water ripples, and evening lamp glows, with reduced-motion and low-quality alternatives.
- Eight expressive CC0 robot residents with skeletal sitting, idle, celebration, and failure animations. Working residents open their laptops; idle residents close them.
- Orbit and zoom controls, five camera presets, slow camera orbit, ambient audio, reduced motion, and rendering-quality controls.
- A clearly labeled simulator with tasks, delegation, waiting, completion, failure, pause, speed, reset, an activity feed, and an inspector.
- Opt-in local session discovery for Codex, Claude Code CLI, and Gemini CLI; up to eight sessions occupy stable seats, with pinned sessions first.
- Guided local connection setup, fresh-event diagnostics, and a session filter for live residents.
- An authenticated loopback event bridge with SQLite state, ordering, deduplication, WebSocket delivery, reconnect snapshots, and disconnect indicators.
- Claude Code and Gemini CLI telemetry hooks, a Codex App Server stdio proxy, and a generic event endpoint.
- Optional WebMCP controls using the same application state as the visible UI.

This is the first playable implementation, not a finished film-quality animation production. It uses one reusable character rig with color variants. Residents now use authored keyboard/attention clips and short reversible walking routes. A full city, custom human characters, island-wide pathfinding, and desktop packaging remain future milestones. Fine scenery details mount when close enough to see and disappear on low quality; this is a finite island, not an infinite streamed world. See [World layout and rendering](docs/world-layout.md).

**The initial world is simulated. No live provider is connected automatically, no provider settings are modified, and no AI task is launched by the simulator.** The adapters have automated protocol/fixture coverage. They still need end-to-end validation against the specific installed provider versions and sessions you choose to connect.

## Start locally

Requires Node.js 22.13 or later. Node 22 may print an experimental notice for its built-in SQLite module.

```sh
cd /Users/arboy/dev/personal-projects/agentarium
npm ci
npm run dev
```

Open the exact address printed by Vite, normally http://127.0.0.1:5173.

```sh
npm test
npm run build
```

The source build is a static web application. The local bridge is a separate process and is intentionally not included in the hosted static bundle.

## Discover existing local sessions

After connecting the local bridge, enable provider readers in **Discover existing sessions**. The world shows up to eight non-hidden sessions across providers, prioritizing pins then recency; older sessions remain in the list. The demo stays unchanged. Restart the bridge after updating to load this feature.

Codex local history can reveal saved desktop sessions and recorded lifecycle activity. Claude Code CLI and Gemini CLI discovery identifies sessions; their hooks provide detailed activity. These read-only readers are experimental and local-only. Unknown activity is shown explicitly. See [Local session discovery](docs/local-discovery.md) for setup, privacy, compatibility, and limits.

## Connect real events

1. In this project, run `npm run bridge` in a second terminal.
2. Copy the session token printed by that process into the local app's **Simulation → Connect bridge** dialog. The default address is `ws://127.0.0.1:4318`.
3. Set `GROVE_TOKEN` to that same token in the environment that launches your agent and its hook commands. Do not commit it or paste it into a prompt.
4. Configure an adapter below, preserving all existing hooks.

The bridge binds only to `127.0.0.1`. It checks browser origins and authenticates both event ingestion and WebSocket subscriptions. Browser authentication travels in the first WebSocket message, not in the URL. Tokens stay in memory. SQLite data is in this checkout’s ignored `bridge/data/` directory (resolved relative to the bridge module even when launched from another working directory) and is not uploaded with the site. On a bridge restart, saved agents retain their last status with a stale-evidence marker until fresh evidence arrives. Silence alone does not mean an agent stopped working.

Use the local application for live connections. An HTTPS-hosted page may not be allowed to reach a plain local WebSocket, and its origin is not permitted by the bridge by default. Do not disable browser security to bypass this.

### Claude Code

Generate a mergeable settings fragment:

```sh
node bridge/print-hook-config.mjs claude
```

Merge its `hooks` entries into the applicable Claude Code settings. Do not replace existing hooks. The generator prints an absolute path to this checkout; regenerate after moving it. Launch Claude Code with `GROVE_TOKEN` in its environment.

The telemetry command receives hook JSON on stdin and returns `{}` with exit code 0, including when the bridge is unavailable. It neither grants permissions nor changes tool inputs. It captures lifecycle metadata and tool names, omitting prompts, tool arguments, responses, and transcript paths. SubagentStart/SubagentStop identify child agents and connect them to the parent. Some provider versions expose fewer events or omit agent IDs on some hooks; those cannot be accurately attributed to a child.

Reference: https://code.claude.com/docs/en/hooks

### Gemini CLI

```sh
node bridge/print-hook-config.mjs gemini
```

Merge the generated `hooks` entries into your Gemini CLI settings, preserving existing entries. Launch Gemini CLI with `GROVE_TOKEN` in its environment. The adapter observes BeforeAgent, BeforeTool, AfterTool, BeforeModel, AfterAgent, Notification, SessionStart, and SessionEnd. This version displays the session's main agent; it does not infer unsupported Gemini subagent relationships.

Reference: https://geminicli.com/docs/hooks/reference/

### Codex App Server

The proxy is intended for a client that already speaks the Codex App Server protocol over stdio. Configure that client's server launch command to be:

```sh
node /absolute/path/to/agentarium/bridge/codex-proxy.mjs
```

It launches `codex app-server`, forwards stdin/stdout protocol bytes, and mirrors supported notifications to the bridge. Set `GROVE_TOKEN` in the client's launch environment. Optionally set `CODEX_BINARY` to an exact executable path. Extra command-line arguments are forwarded to `codex app-server`.

The client still initializes the server and starts/subscribes to its threads. The proxy alone does not run a task and does not automatically attach to existing Codex desktop sessions. It currently represents each observed thread as a main agent; child-thread relationships are not inferred. It observes turn status, relevant tool items, approval requests, and thread status notifications.

Reference: https://learn.chatgpt.com/docs/app-server

### Test the bridge without an AI provider

After exporting `GROVE_TOKEN` in that terminal:

```sh
npm run bridge:demo
```

This sends a clearly named **Bridge demo** resident through synthetic states. The connection is real, but the events are synthetic and no model is called.

### Custom event contract

POST JSON to `http://127.0.0.1:4318/events` with `Authorization: Bearer <session-token>`.

```json
{
  "id": "unique-event-id",
  "sessionId": "your-session-id",
  "agentId": "your-agent-id",
  "sequence": 1,
  "timestamp": 1790000000000,
  "type": "working",
  "provider": "Custom",
  "name": "Research agent",
  "task": "Reviewing references",
  "parentId": "optional-parent-agent-id"
}
```

Use the current Unix time in milliseconds. Increment `sequence` for each agent within a session. Allowed states: idle, working, tool, waiting, completed, failed, disconnected, unknown. Provider: Codex, Claude, Gemini, or Custom. Parent IDs are scoped to the same session. Unknown fields are dropped. IDs and names are limited to 200 characters; task labels to 300. Duplicate IDs and older sequences are ignored. Up to 256 telemetry agents are retained. Discovery adds up to 64 recent sessions per provider in memory. Up to eight non-hidden provider-qualified sessions receive stable 3D seats, with pins before recency; overflow remains in the list. Always send a consistent provider (omission means Custom).

Configuration: `GROVE_PORT`, `GROVE_TOKEN`, `GROVE_DB`, and comma-separated `GROVE_ORIGINS` for the server; `GROVE_URL` and `GROVE_TOKEN` for adapters. Defaults permit only the local Vite dev/preview origins. Do not put provider API keys in the frontend.

## Repository location and hosting

The primary development checkout is `/Users/arboy/dev/personal-projects/agentarium`. The npm package is named `agentarium`; the current in-app branding remains Agent Grove. Other machines can clone or copy the project to any directory and run the same npm scripts from that directory.

The `origin` remote and `.openai/hosting.json` still identify the existing private Agent Grove Site. Those are deployment identities, not local filesystem paths, so moving or renaming the checkout does not require changing them. The configured static output is the project-relative `dist` directory, recreated by `npm run build`.

If you previously installed generated Claude or Gemini hook settings, regenerate them from this checkout with `node bridge/print-hook-config.mjs claude` or `gemini` and update the corresponding commands. Generated hook settings intentionally contain an absolute script path; an already-installed copy cannot follow a folder move automatically. A configured Codex client must likewise point to this checkout’s `bridge/codex-proxy.mjs`.

## Architecture

```text
src/App.tsx               Application UI and controls
src/World.tsx             3D environment, cameras, animated residents
src/state.ts              Simulator and reactive agent state
src/shared/protocol.mjs   Shared validation and ordered event reducer
src/bridge.ts             Reconnecting browser WebSocket client
src/webmcp.ts             Optional browser agent tools
bridge/server.mjs         Authenticated HTTP/WebSocket bridge + SQLite
bridge/adapters.mjs       Provider-to-event normalization
bridge/hook.mjs           Non-blocking hook transport
bridge/codex-proxy.mjs    Codex App Server stdio proxy
```

## Validation and limits

`npm test` covers ordering, duplicates, parent relationships, task clocks, simulation/live isolation, malformed inputs, authenticated HTTP/WebSocket transport, reconnect snapshots, and provider event mappings. The browser controls are also exercised through the real UI and WebMCP. Provider integration tests use representative protocol fixtures; they are not proof of a live account connection.

Animation is illustrative, not a view into a model's reasoning. Tool labels come from reported metadata. No fabricated token usage or completion percentages are displayed. The 60 fps figure in the plan remains a target, not a measured guarantee. Rendering cost varies by viewport, hardware, browser, and pixel density.

## Credits

RobotExpressive: Tomás Laulhé (Quaternius), CC0 1.0; glTF modifications by Don McCurdy. Vendored from the official Three.js example. See `public/models/LICENSE.md`.

Environment and application code were authored for Agent Grove. Icons: Lucide (ISC). Fonts: DM Sans and Manrope (Google Fonts, SIL Open Font License). Three.js: MIT. React: MIT.

### Manage your live world

Select a resident to pin or hide its session. **Manage sessions** restores hidden choices and removes pins, even for sessions absent from the current snapshot. Choices survive refreshes in the same browser/app address. **Needs attention** includes waiting and failed residents outside the world and in hidden sessions. Connection loss preserves their last reported states. See [Managing live sessions](docs/session-management.md) for details.

### Watch your residents work

Select a seated-world resident and choose **Follow resident** to watch them move between their desk and a nearby resting spot. Use the eye button in the header for **Watch mode**, which hides the panels while retaining connection context, attention access, and an exit control. Drag to stop following; Escape exits watch mode.

Characters type, review, raise a hand while waiting, and briefly celebrate fresh completion before resting. Arrival/departure is staged when sessions change seats. Reduced motion skips travel and uses still poses. These behaviors use the existing robot rig; see [The 3D world](docs/3d-world.md) for the asset contract, limitations, and animation details.
