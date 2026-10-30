# Visual rebuild plan

This plan answers one question: how does Agentarium stop looking like a prototype and start looking like a game world? It is grounded in the renderer as it exists today, not in the feature list. Nothing below touches the bridge, session identity, attention, task briefs, or the simulator.

## Tooling decision

**Stay on Three.js. Use Blender as the asset factory. No game engine, no Rust.**

| Option                                 | Verdict        | Why                                                                                                                                                                                                                                                                |
| -------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Three.js + React Three Fiber (current) | Keep           | Already supports PBR materials, cascaded shadows, environment lighting, instancing, and a full post-processing stack. Every gap listed below is reachable without leaving it.                                                                                      |
| Blender                                | Adopt properly | Modeling, UV unwrapping, sculpting, baking (ambient occlusion, normal, edge wear), texture painting, rigging, animation, GLB export. The current scripts only use it to place primitives, which is why the kit looks like boxes.                                   |
| Unity / Unreal / Godot                 | Not now        | Better editors and terrain tools, but a full rewrite of the world layer, loss of the React UI and bridge integration, and weak or dead web export (Unreal) or heavy builds (Unity WebGL). Reconsider only if the product becomes an installable first-person game. |
| Rust / C++ custom renderer             | No             | Two projects instead of one. A renderer ships zero visuals by itself.                                                                                                                                                                                              |

The honest framing: the current look is not a Three.js limitation. It is the result of defaults never being replaced. A Three.js scene with scanned PBR textures, a real sky, cascaded shadows, ambient occlusion, bloom, and tone mapping looks like a game. The same scene with an indoor studio environment map, flat fog, and 512 px noise looks like a demo.

## What the renderer does today

Read from `src/World.tsx`, `src/world/Environment.tsx`, `src/world/WorldSurfaceMaterial.tsx`, `src/world/terrain.ts`, `src/world/TerrainTiles.tsx`, and `assets/blender/*.py`.

| Layer                | Current state                                                                                                                    | Effect on the image                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Camera               | Orthographic by default. Perspective only in the Horizon preset.                                                                 | Isometric diorama. No depth, no atmospheric perspective, nothing can fill the frame.                                |
| Sky                  | Flat background color `#d9a184` with linear fog of the same color.                                                               | Beige haze from the camera outward. Flattens contrast everywhere.                                                   |
| Environment lighting | `RoomEnvironment` (an indoor studio) baked to a PMREM at 0.28 intensity.                                                         | Reflections and ambient come from a grey room, not a Mars sky. Metals look wrong, ambient is colorless.             |
| Direct lighting      | Ambient + hemisphere + sun + a cyan fill directional. Sun shadow frustum fixed at 46 m, 2048 px, PCF radius 2.                   | Four overlapping fills wash out the sun. Shadows are soft and low-contrast.                                         |
| Tone mapping         | R3F default (ACES) with no exposure tuning.                                                                                      | ACES desaturates and shifts saturated orange toward yellow.                                                         |
| Post-processing      | None.                                                                                                                            | No ambient occlusion, so nothing is grounded. No bloom, so emissive strips and screens do not glow.                 |
| Terrain              | 1,200 m plane, 254 segments (one vertex per 4.7 m). Height from a handful of sine functions. Vertex colors plus a grain texture. | The colony sits on a flat plane. No dunes, ridges, strata, or micro relief. Rocks are hex pebbles scattered on top. |
| Textures             | Five 512 px families generated procedurally inside Blender.                                                                      | Noise, not material. No scanned detail, no macro variation, visible tiling.                                         |
| Hardware kit         | Fifteen modules built from `box`, `cyl`, and `pipe` primitives in Python.                                                        | Reads as blocking geometry. No bevels, panels, bolts, cables, wear, or decals.                                      |
| Residents            | `robot.glb` at 0.37 scale with procedural CCD posing. Color and accessory variants.                                              | Generic robots, not aliens. Poses, not animation.                                                                   |
| Layout               | Desks and swivel chairs on open plinths under the sky. Habitats are flat walls behind them.                                      | The concept breaks before texture is even judged.                                                                   |

## The rebuild, in order

The order matters. Lighting is first because every later asset is judged under it. Terrain is second because it is the largest surface in every frame. Characters come late because they are the most expensive and gain the most from a finished environment to stand in.

### Phase 0. Tooling and a look-dev harness

- Install Blender 4.5 LTS (`brew install --cask blender`). The existing scripts assumed a disk image and the executable is not currently on this machine.
- Add `@react-three/postprocessing`, `postprocessing`, and `n8ao`. Use the `three/examples/jsm/csm` cascaded shadow module that ships with Three.js.
- Add a `?lookdev=1` route: a fixed camera, a fixed time of day, and a fixed resident pose, so every phase can be compared as a before/after screenshot from the same frame.
- Create `assets/source/` with a `LICENSES.md`. Download CC0 PBR sets at 2K from Poly Haven and ambientCG: two sand or regolith variants, one gravel, one dark basalt, one layered sedimentary rock, one painted metal, one rusted metal, one concrete. Convert to KTX2 at build time so the runtime cost stays low.
- Decide the style target. Recommended: stylized-realistic. Real materials and lighting, simplified silhouettes, saturated but believable Mars palette. This is achievable without a 3D artist and avoids the uncanny valley of full realism.

Acceptance: Blender runs headless from the repo root, the post stack renders an empty pass at 60 fps, and the look-dev frame is captured as the baseline.

### Phase 1. Light, sky, camera, post

This phase changes no models and will change the project more than any other.

- **Perspective camera by default.** Field of view 35 to 42 degrees. Keep the orbit-around-a-focus-point interaction. Keep an "Overview" isometric preset for people who want the map-like view.
- **Sky dome.** A shader sky with a Mars gradient: butterscotch at the zenith, pale pink-tan at the horizon, a blue halo around the sun disc. Stars and a faint Phobos at night. The dome replaces the flat background color.
- **Environment from the sky.** Render the sky dome to a PMREM each time the time of day changes and set it as `scene.environment`. Reflections and ambient then match the world.
- **One sun.** Low elevation (25 to 35 degrees) for long shadows and visible surface relief. Remove the cyan fill directional. Reduce ambient and hemisphere to a fraction of the sun. Contrast comes back.
- **Cascaded shadow maps.** Three cascades: crisp within 15 m, acceptable to 80 m, soft to the horizon. Replaces the fixed 46 m frustum.
- **Fog that matches the sky.** Exponential height fog tinted toward the horizon color, starting well beyond the colony, so near objects stay crisp and the distance fades into atmosphere rather than beige paint.
- **Tone mapping and grade.** Switch to AgX, which holds saturated oranges without clipping to yellow. Tune exposure. Add a small LUT for a warm-shadow, cool-highlight Mars grade.
- **Post stack.** N8AO (ambient occlusion), Bloom with a high threshold so only screens, light strips, and the rocket glow, SMAA, Vignette, and a subtle chromatic aberration at the frame edge. Depth of field only in the cinematic/watch mode.
- **Day/night.** Drive sun elevation, sky, environment, and interior emissives from one time-of-day value. Night gets warm habitat windows against a cold sky.

Acceptance: the look-dev frame shows visible sun direction, contact shadows under every object, glowing emissives, and a sky with a horizon. Existing tests pass. Frame time on the reference laptop stays under 16 ms at high quality.

### Phase 2. Terrain and ground materials

- **Height.** Replace the sine-function height with layered noise: domain-warped FBM for broad landforms, ridged noise for mesas and crater rims, a dune function (asymmetric slip faces aligned to a wind direction) for the plains, and authored stamps for the crater and the colony plateau. Bake it to a 4K heightmap. Keep `terrainHeight()` as the single source of truth so navigation and route tests still read the same surface.
- **Mesh.** Replace the 254-segment plane with a clipmap or the existing tile system at real resolution: 0.25 m vertex spacing within 60 m of the camera, 1 m to 200 m, 8 m beyond. GPU displacement from the heightmap for the far rings, CPU-sampled geometry near the camera where residents walk.
- **Material.** A splat-mapped layered PBR ground: fine sand on flats, regolith gravel on gentle slopes, exposed basalt and layered rock on steep slopes and rims, dark dust in depressions. Blend by slope and height, break tiling with a 500 m macro tint and a 50 m macro normal, add a detail normal within 10 m. Triplanar only on cliffs.
- **Rocks.** Replace the hex pebbles with instanced scanned rock meshes (CC0 from Poly Haven) in three size classes, scattered by slope and noise, sunk into the ground with a dust skirt decal so they belong to the surface. Large boulders get LOD.
- **Paths and tracks.** Worn-ground decals along every authored route: compacted lighter sand with tire ruts on vehicle routes and footprint-scuffed sand on walking routes. Replace the flat light-grey path ribbons.
- **Crater, mesas, and the far ridge.** Rebuild as part of the heightmap rather than separate meshes. The current distant landforms become silhouettes carved into the terrain.

Acceptance: the ground reads as sand and rock at every distance from 1 m to the horizon with no visible tiling. Every resident route still passes its clearance tests. Draw calls for terrain and rocks stay under 60.

### Phase 3. The hero habitat and the colony layout

This is the milestone the original plan called "one convincing character at one convincing workstation" and never shipped.

- **Enclosed modules.** Residents work inside pressurized habitats with large glazed walls facing the default camera. Each module has an airlock, external ribs, radiators, cable runs, a dust skirt at the foundation, and an interior with workstations, lighting, and personal props.
- **Dollhouse reveal.** When the camera zooms in or a resident is selected, the roof and camera-facing wall fade so the interior is fully visible. At a distance the glazing shows warm interior light and silhouettes.
- **Modeling.** Build the module in Blender by hand, not by primitive script: beveled edges, panel lines, bolts, greebles, decals, and baked ambient occlusion and edge wear. Target 20k to 40k triangles per module, 2K texture atlas per material group.
- **Interior light.** Emissive ceiling panels, laptop screen glow, status lights per resident state (working, waiting, failed). These feed bloom from Phase 1 and become the readable signal for agent state.
- **Layout.** Reduce the colony to three or four modules connected by short pressurized corridors on one plateau, dense with props: crates, tanks, cables, antennas, a rover bay. Density over area.

Acceptance: a single screenshot of one habitat with one working resident inside looks like concept art for the game. Resident seat positions, routes, and selection still work.

### Phase 4. Characters

- **Design.** Aliens, not robots. One body plan with strong silhouette variants (height, limb proportion, head shape) and material variants (skin, suit, equipment). Stylized enough to animate well with a humanoid rig.
- **Rig and clips.** Model and rig in Blender with Rigify or a Mixamo-compatible skeleton so free motion-capture clips can be retargeted: idle, walk, sit down, stand up, type, look at screen, wave for attention, celebrate, slump on failure. Export as one GLB with named clips. Three.js blends them with crossfades.
- **Replace the CCD pose system** with clip blending driven by the existing resident state machine. Keep reduced-motion alternatives.
- **Scale.** Residents stand around 1.7 m against doors of 2.1 m and desks of 0.75 m so the world reads at human scale.
- **Faces.** Simple blend-shape expressions (neutral, focused, confused, happy) toggled by state. This is what makes them characters rather than props.

Acceptance: the full idle, walk, sit, type, finish, celebrate sequence plays without snapping or furniture intersection on one resident, then on all eight.

### Phase 5. Rollout, ambient life, and budget

- **Landmarks.** Rebuild the spaceport, observatory, biolab, power field, and relay with the Phase 3 modeling standard. Cut any landmark that does not earn its place in the frame.
- **Ambient life.** Blowing dust as GPU particles, occasional dust devils on the plains, heat shimmer near the horizon, flag and cable sway, beacon blinks, rover patrols, rocket exhaust with a ground dust wash.
- **Camera presets.** Rebuild every preset as a composed shot with a foreground, midground, and the horizon, so a jump feels like a cut in a film rather than a map pan.
- **Performance budget.** Target 60 fps on an Apple Silicon laptop at high quality and 30 fps at low. Instance everything repeated, LOD every landmark, KTX2 all textures, cap shadow cascades at low quality, and keep the resident count at eight visible.

Acceptance: every preset reads as a finished shot, frame time stays within budget, and the full test suite passes.

## Risks and decisions

- **Terrain changes affect navigation.** Routes, arrival pads, and clearance tests all sample `terrainHeight()`. Phase 2 must re-validate every route and may need authored flat zones under the colony and landmarks.
- **Asset licensing.** CC0 (Poly Haven, ambientCG, Kenney, Quaternius) keeps this clean. CC-BY needs attribution in the app. Paid kits (Sketchfab, Unity Asset Store) are faster for characters but tie the look to someone else's style.
- **Blender work is hand work.** The old scripts were deterministic; the new modules will be edited files. Keep the scripts for export and validation, not for authoring.
- **Scope discipline.** The failure mode of the last month was breadth. Each phase ends with a look-dev screenshot compared against the baseline. No new destinations or view scales until Phase 5.

## Effort

| Phase                       | Rough effort                                      |
| --------------------------- | ------------------------------------------------- |
| 0. Tooling                  | 1 day                                             |
| 1. Light, sky, camera, post | 2 to 3 days                                       |
| 2. Terrain                  | 4 to 6 days                                       |
| 3. Hero habitat             | 4 to 6 days, including Blender modeling           |
| 4. Characters               | 5 to 10 days, dominated by modeling and animation |
| 5. Rollout and ambient life | 5 to 8 days                                       |

Phases 1 and 2 alone will change the project more than everything done in the last month. They are also the cheapest.

## Status

### Phase 1: implemented

Shipped in the surface renderer (`src/World.tsx`, `src/world/Sky.tsx`, `src/world/PostProcessing.tsx`, `src/world/perspective.ts`):

- Perspective camera for every preset, fitted to the authored spans. The orthographic camera and the Horizon-only camera swap are gone.
- A shader sky dome (butterscotch zenith, dusty horizon, blue sun halo, HDR sun disc; stars and a moon at night) that follows the camera and also generates the environment map, replacing the indoor `RoomEnvironment`.
- One key light that blends from sun to moon with the sky, low ambient and hemisphere fill, no fill directional. The shadow frustum fits the orbit distance, with a 4096 px map at high quality and 1024 px at low.
- Exponential fog tinted to the horizon color; background and fog follow the day/night transition.
- AgX tone mapping. At high quality the composer adds N8AO ambient occlusion, bloom (threshold above 1.0 so only emissives and the sun bloom), chromatic aberration at the edges, vignette, and SMAA. Low quality skips the composer.
- Laptop screens and deck light strips raised to HDR emissive values so they bloom.
- `?lookdev=<view>&night=1` pins a preset, pauses the simulator, and disables cinematic motion for before/after captures. Baseline captures from before this phase are in `.impeccable/review/`.

Not done in this phase: cascaded shadow maps (the single fitted frustum was sufficient at 4096 px), a time-of-day slider (the day/night toggle drives a smooth transition instead), a color-grade LUT, and depth of field in cinematic mode. Scenic landmark streaming now measures the perspective frustum; low camera angles see further, so more landmark modules load than under the orthographic camera.
