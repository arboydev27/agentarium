# Development

## Commands

Run commands from the repository root:

| Command                | Purpose                                                      |
| ---------------------- | ------------------------------------------------------------ |
| `npm ci`               | Install exact lockfile dependencies                          |
| `npm run dev`          | Vite on loopback port 5173, strict port                      |
| `npm run build`        | TypeScript project check followed by Vite production output  |
| `npm run preview`      | Serve the production output on loopback port 4173 by default |
| `npm test`             | Vitest state tests, followed by Node bridge tests            |
| `npm run bridge`       | Local SQLite-backed telemetry server                         |
| `npm run bridge:demo`  | Synthetic events sent through the bridge                     |
| `npm run codex:proxy`  | Start the Codex App Server stdio proxy                       |
| `npm run format`       | Format supported repository files with Prettier              |
| `npm run format:check` | Check formatting without writing changes                     |

There is no dedicated lint command or CI workflow currently. TypeScript checks `src`; bridge `.mjs` files are exercised by Node tests rather than the TypeScript build.

## Formatting

[Prettier configuration](../.prettierrc.json) specifies two-space indentation, single quotes, semicolons, trailing commas, and a 100-character print width. The pinned formatter is installed through the lockfile.

[Ignored formatting paths](../.prettierignore) include dependencies, build output, bridge data, runtime output, TypeScript build metadata, the package lock, and model assets. After a small edit, format the changed files; before handing off broader work, use `npm run format:check`.

## Verification

[state.test.ts](../src/state.test.ts) covers browser state/protocol behavior. [bridge.test.mjs](../bridge/bridge.test.mjs) covers bridge behavior, adapter fixtures, and portability. These tests do not replace real provider end-to-end checks or browser rendering checks.

For a behavior change, run the relevant tests and `npm run build`. For UI/scene changes, also inspect the browser at desktop and narrow widths, with reduced motion, both quality settings, day/evening lighting, and relevant agent statuses. For documentation-only edits, formatting and local-link validation are sufficient unless examples or configuration changes introduce executable behavior.

## Making changes safely

For a new status, update runtime validation, TypeScript declarations/types, labels, reducer assumptions, UI controls, animation mapping, adapters as needed, and tests. Do not add only a visual label: unrecognized statuses are rejected by the bridge.

For a new provider adapter, keep normalization separate from transport, forward only needed metadata, and test representative payloads and missing fields. Document attribution limits and validate against the actual installed provider version.

For scene work, see [3D world](3d-world.md). For transport changes, keep the browser and bridge compatible through the shared [protocol module](../src/shared/protocol.mjs). Schema changes may also require a deliberate strategy for existing SQLite snapshot payloads; there is no migration framework today.

## Repository location and generated paths

The repository folder and npm package are named `agentarium`; the displayed product remains Agent Grove. Existing `grove_*` tool names, `GROVE_*` variables, and deployment identifiers are intentional and do not imply stale filesystem references.

The default database and hook script location are resolved from bridge modules. Generated provider configuration embeds absolute paths and must be regenerated after moving the project or replacing the Node executable. The browser model URL `/models/robot.glb` assumes root-based static hosting; a subpath deployment would need asset/base-path review.

## Build and hosting boundaries

Vite writes the static application to `dist/`. [.openai/hosting.json](../.openai/hosting.json) identifies the existing Sites project and its `dist` output directory. Its project ID is a deployment identity, not a local path. Moving or renaming the checkout does not require replacing it.

Building is separate from publishing. This document does not deploy changes. Static hosting does not run the bridge or make a local provider connection available to visitors. For live local usage, serve the app locally with an allowed origin.

Do not commit `node_modules`, `dist`, bridge databases, generated runtime files, or credentials. The existing [.gitignore](../.gitignore) covers these common paths. Dependency upgrades should be explicit changes with lockfile updates and appropriate verification, rather than being mixed into formatting or documentation work.
