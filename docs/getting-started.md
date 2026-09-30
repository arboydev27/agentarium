# Getting started

## Requirements and installation

Use Node.js 22.13 or later and npm. The bridge uses Node's built-in SQLite module; Node 22 can print an experimental SQLite notice. Run these commands from the repository root:

```sh
npm ci
npm run dev
```

Open the address printed by Vite, normally `http://127.0.0.1:5173`. The dev command uses a strict port: an occupied port produces an error instead of silently selecting another one.

The initial residents and activity are simulated. Select a resident to inspect it, use the simulation controls to change activity, and explore the five camera presets. No provider account or API key is needed for this mode.

## Connect the local bridge

Keep Vite running and start a second terminal in the repository:

```sh
npm run bridge
```

The bridge prints its address and authentication token. In the app, open **Simulation → Connect bridge**, enter `ws://127.0.0.1:4318`, and paste that token. Connecting switches the app to live mode; a fresh database can produce an empty world until events arrive.

In a third terminal, set the same token and send the included synthetic sequence:

```sh
export GROVE_TOKEN='replace-with-the-token-printed-by-the-bridge'
npm run bridge:demo
```

This creates a Custom resident that moves through working, tool, waiting, working, and completed states at approximately three-second intervals. It exercises the real transport without calling a model. Each run uses a new session, so repeated runs accumulate residents in the bridge database.

The token must also be available in the environment of any provider process that invokes a hook. Exporting it in one terminal does not modify another terminal or an already running desktop application. Do not commit tokens.

To discover existing chats, enable a provider under **Discover existing sessions**; see [Local session discovery](local-discovery.md). For detailed lifecycle telemetry, follow [Provider integrations](provider-integrations.md). Starting the bridge or connecting the UI alone does not connect a provider.

## Run a production build locally

```sh
npm run build
npm run preview
```

Preview normally runs at `http://127.0.0.1:4173`, which is included in the bridge's default allowed origins. The bridge still runs separately. A static hosted build does not contain the Node server or its database.

## Stop and restart

Use Ctrl+C in the development and bridge terminals. Browser connection details and UI preferences are held in memory; reload starts in simulation mode and requires an explicit live reconnection. The bridge retains agent snapshots in `bridge/data/grove.sqlite`. After a bridge restart, recovered residents are disconnected until they receive new events.

Use **Simulation** in the connection controls to return to demo activity. For isolated experiments, start the bridge with a different `GROVE_DB` path instead of deleting an existing database. See [Bridge protocol](bridge-protocol.md#configuration).

## Understand connection diagnostics

The header says **Bridge connected** after authentication. The connection dialog separately shows the count of newly accepted events, their local receipt time, and the providers observed since the latest successful connection. A saved snapshot can contain residents while the new-event count remains zero. Neither a snapshot nor an open socket confirms that a provider is currently working.

The dialog includes a synthetic transport test and separate Claude, Gemini, and Codex setup guidance. Codex local discovery can observe saved desktop sessions when explicitly enabled; the separate App Server proxy does not attach to desktop chats. Authentication failures require correcting the token and reconnecting; other connection losses retry automatically.

In live mode, use the **Session** selector above the resident list to focus on one session and see its attention count. This filters only the list; the scene selects the eight most recently active sessions while preserving seats for survivors. Selecting a resident displays its session ID. Session filtering does not delete database records or free seats.
