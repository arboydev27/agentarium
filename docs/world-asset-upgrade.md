# World asset upgrade

The approved Expedition Base Blender reference now establishes the material and authored-detail standard across every active asset family. The rollout extends the approved Mars colony identity through authored hardware, textured procedural scenery, and residents. Existing route footprints, factual agent state, reduced motion, rendering quality, and interface tokens remain the governing constraints.

## Coverage ledger

All active families are complete within this rollout. Completion means implementation plus the scoped checks below; it does not mean every scene object was converted into an imported Blender mesh.

| Family                 | Implemented coverage                                                                                                 | State and evidence                                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reference habitat      | Pressure hull, airlock, service lines, storage, terrain patch, supports and tracks                                   | Complete; exported-asset tests and Expedition Base close/wide, lighting, quality and revisit checks                                                                                                |
| Shared colony hardware | Pressure habitats, solar racks and sensor masts at field, biolab, power, lookout and reference destinations          | Complete; fifteen-module manifest, GLB envelopes, route tests; `asset-fix-biolab.png`, `asset-fix-field.png`, `asset-fix-power.png`                                                                |
| Central colony         | Habitat Commons, Research Array, Resource Lab, Comms Court, service walls, tanks, dish, decks and paths              | Complete; authored structures and textured concrete; `asset-fix-desktop.png`; relocated tank placement included in route tests and review                                                          |
| Space program          | Rocket, trussed gantry, launchpad, control cabin and six-wheel rover                                                 | Complete; authored modules and terrain-supported apron; `asset-fix-rover.png` shows the unobstructed rover                                                                                         |
| Scientific landmarks   | Tracking telescope, lookout survey console, sensor masts and field sample cabinet                                    | Complete; authored modules and route tests; `asset-fix-observatory.png`, `asset-fix-lookout-close.png`, `asset-fix-field.png`                                                                      |
| Terrain and geology    | Ground, cliffs, crater, boulders, distant formations, paths and decks                                                | Complete; normal/roughness ground, world-space surface detail and eroded geometry; `asset-fix-crater-close.png`, `asset-final-bluff.png`, `asset-final-bluff-oblique.png`, `asset-fix-horizon.png` |
| Resident equipment     | Body/accessory finish, workstations and furniture                                                                    | Complete; local-space ceramic finish preserves animation, authored workstation details preserve contact positions; desktop/mobile review and rig tests                                             |
| Orbital assets         | Authored relay module (kept in the GLB); planet surfaces and solar-system bodies were removed with the orbital views | Historical; `asset-fix-orbit.png` records the former orbital scene. The relay is no longer rendered anywhere                                                                                       |
| Verification           | Loading/fallbacks, route clearance, desktop/mobile, quality, reduced motion, build and tests                         | Complete within the review scope below; final reviewer returned **ship**                                                                                                                           |

Review captures are local files under `.impeccable/review/`. The final overview is also recorded at `/Users/arboy/.codex/visualizations/2026/09/24/01a0d1c9-503f-79e2-a814-96af4aeaa46f/agentarium-upgraded-world.png`.

## Shared hardware pipeline

`assets/blender/build_world_kit.py` first runs `build_habitat.py`, regenerating the reference habitat and its deterministic texture library. It then authors `assets/blender/world-kit.blend`, exports `public/models/world-kit/colony-hardware.glb`, and writes `public/models/world-kit/manifest.json`. Regenerate from the repository root:

```sh
blender --background --factory-startup --python assets/blender/build_world_kit.py
```

The editable `.blend` retains separate named pieces. Export preparation merges meshes by material within each module after saving the source. It does not flatten the saved authoring file. Running either generator overwrites its generated files; the shared-kit generator also overwrites reference habitat exports and textures. Save manual edits separately or incorporate them into the generator before regenerating. Blender is needed for authoring, not for loading the shipped GLBs. The development run used the official Blender CLI from its disk image without installing a new global application or changing the user's open Blender window.

The fifteen module names are the runtime API:

- `pressure-habitat`, `solar-rack`, `sensor-mast`
- `service-wall`, `resource-tank`, `communications-dish`
- `survey-rover`, `survey-rocket`, `launch-gantry`, `control-cabin`
- `workstation`, `telescope`, `survey-console`, `sample-cabinet`
- `orbital-relay`

`src/world/scenery/WorldKit.tsx` selects named nodes, clones placement transforms, and shares cache-owned geometry/materials with `dispose={null}`. Existing scenic lazy-loading and fallback boundaries remain in use. Local landmark titles remain runtime labels. The current GLB URL revision is `colony-5`; increment the revision when changing the exported module set so a development loader cache cannot retain an older bundle.

The shipping hardware GLB is **8,728,944 bytes (about 8.3 MiB)**. The exported-asset test caps it below 10 MiB, checks every named module and its size envelope, and limits each module to at most eight material-group meshes. These are asset size and geometry guardrails, not loading-time or frame-rate benchmarks. The separate reference habitat remains about 6.8 MiB. The editable sources are 15,350,989 bytes for `world-kit.blend` and 9,079,616 bytes for `expedition-habitat.blend`.

## Materials and geometry

Five original procedural texture families cover ceramic paint, dusty alloy, cast foundation, ironstone, and regolith. Fifteen 512 × 512 PNGs provide color, roughness, and tangent-space normal maps. All fifteen carry deterministic authoring-origin metadata under `impeccable:prompt`; the final metadata scan found zero missing. Color maps use sRGB; data maps use non-color space. These are original project-generated maps, with no external texture CDN or third-party source images.

Authored hardware carries PBR textures and construction detail: pressure seams, gaskets, split panels, access covers, fasteners, wiring, inverter housings, collars, optics, service cables, and footings. Workstations keep the original desk surface, chair contacts, and animated laptop while adding leveling feet, vents, leads, seat seams, and sample containers. Telescope and survey modules add the detector harness, finder optics, controls, and storage appropriate to their role. The rover, rocket, gantry, cabin, and dish use the same material vocabulary; the orbital relay module shares it but is no longer rendered. Decorative vehicle motion has no provider-state meaning.

Terrain uses continuous world-space regolith coordinates at three metres per tile across fine and coarse coverage. Biome vertex colors remain authoritative; the color texture supplies grain rather than an additional red tint. Ground normal and roughness maps use repeat wrapping and quality-dependent anisotropy (8 high, 2 low).

`WorldSurfaceMaterial.tsx` projects grain and roughness triplanarly over cliffs, crater surfaces, paths and decks, with grain-derived micro-normal detail. Concrete uses finer grain and 1.8-metre joints. `TerrainApron.tsx` follows rendered terrain height and adds an edge skirt, grounding the pad rather than bridging empty space. Amber Bluff combines irregular continuous strata, eroded ridges, broken edges and talus; the crater retains textured mineral relief. Residents and accessories use local-space ceramic detail so their finish follows the rig during animation; optical materials remain smooth.

## Verification and review scope

The final automated record is **225 frontend tests across 39 files**, **17 bridge tests**, and a passing production build. Bridge tests required temporary localhost sockets outside the restricted sandbox. Full repository formatting passed before the final localized Bluff edit; that edit passed its formatter check. The existing large Three.js chunk warning remains. The local machine-readable record `.impeccable/review/world-assets-verification.json` records asset hashes, test counts, log paths, and review scope.

The code-led rollout continued the approved identity and reference. Builder browser QA covered the central colony, destination hardware, science fixtures, terrain/geology, residents, orbit/system, desktop and mobile layouts, daylight/evening, low quality, reduced motion, and leaving/revisiting detail. Export tests inspect the shipping GLBs, including route clearance against actual exported surfaces. The labeled simulator supports interaction checks; bridge tests cover protocol behavior separately. The independent reviewer inspected supplied screenshots and source, and did not independently execute the tests or browser interactions.

The independent final reviewer returned **ship** after closing the three original findings: grounded textured pads and paths, authored scientific fixtures, and eroded Bluff/crater treatment. Follow-up evidence also closed the unobstructed rover/relay and relocated resource tank checks. The last Bluff correction is recorded in `asset-final-bluff.png` and `asset-final-bluff-oblique.png`; the earlier `asset-fix-*` captures record the wider correction pass. This verdict applies to the reviewed captures, source, and findings. Browser interaction and automated-check evidence is separately builder-supplied.

After the final asset reload, browser error entries since `2026-10-28T01:51:00Z` were empty. Earlier development HMR entries still contain stale-bundle missing-module errors; they are historical and do not describe the final `colony-5` load. The final user view returned to daylight, high quality, normal motion, and a playing simulator.

## Limits

The result remains a stylized fictional colony with a shared resident rig and finite terrain. It does not claim photorealism, infinite navigation, physical astronomy, representative-device frame rates, or new end-to-end certification of live providers. No controlled performance benchmark was run for this asset rollout. The GLB cap does not measure decoded GPU memory or total scene cost. Profile the current production build on representative devices before assigning a performance budget; historical Earth-world observations in [Rendering performance](rendering-performance.md) are labeled separately.

See [Blender reference habitat](blender-habitat.md) for the reference pipeline and [Mars reinvention](mars-reinvention.md) for the product and activity boundaries.
