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
| Residents            | `robot.glb` at 0.37 scale with procedural CCD posing. Color and accessory variants (replaced in Phase 4).                        | Generic robots, not aliens. Poses, not animation.                                                                   |
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

## Interface

Two interface decisions were made before Phase 3, and both are shipped:

- **The orbital scales are gone.** Planet and Solar system views, the scale store, the second Canvas, and the procedural planet textures were deleted. Zooming out stops at the surface camera's far limit. Mars is read from the surface: sky, horizon, far landforms. The world is one place, and the renderer work in Phases 3 to 5 only has to serve that place.
- **The web-app chrome is gone.** The 80px top bar, brand row, account chrome, white card panels, and the SaaS toolbar are replaced by a game HUD ([docs/interface.md](interface.md)): the world fills the viewport, overlays sit on the edges and corners on dark glass with thin lines, residents are a party-style roster strip with a slide-in detail pane, viewpoints are a number-keyed hotbar, the simulator is a small transport, the map is a corner toggle, and non-essential HUD fades after four seconds idle. Amber attention is the one element that never dims or hides. Keyboard panning, map scouting, watch mode, reduced motion, and narrow screens all survived; the look of the 3D world, the data model, and the bridge did not change.

Why: the owner judged the previous shell to read as a dashboard, which fought every rendering improvement. A HUD lets the surface carry the identity and makes the remaining phases visible instead of boxed in.

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

### Phase 2: implemented

Shipped in the terrain stack (`src/world/noise.ts`, `src/world/terrain.ts`, `src/world/terrainBake.ts`, `src/world/terrainTextures.ts`, `src/world/TerrainMaterial.ts`, `src/world/WornGround.tsx`, `src/world/rocks.ts`, `src/world/DesertGeology.tsx`):

- **Height.** The sine folds are gone. `terrainHeight()` now layers deterministic gradient noise on the authored macro shape: domain-warped swells at ~150 m, plains relief at ~55 m, and noise-driven folds and northern crest. It remains the single source of truth for routes, placement, and tests. Amplitude per wavelength is budgeted to the 4.72 m render grid so every route chord still passes its clearance tests; the plateau edge and the observatory and orchard clearing ramps were widened for the same reason, and the crater floor reaches past the shoreline so grid vertices beside the water sit on it.
- **Ground layers.** Three tileable PBR layers (sand with wind ripples, pebbled gravel, cracked basalt) are baked from the same noise at start-up in Web Workers (512 px at high quality, 256 px at low) as colour, normal, and roughness maps. No texture files or third-party licences are involved, and the bake is covered by tests for warmth, contrast, and seamless wrapping.
- **Material.** `TerrainMaterial` splats the three layers by slope and noise, samples each at two scales with a rotated second lookup to break tiling, applies a 170 m macro tint and a 23 m mid tint, darkens dust in dips, blends a fine sand normal within ten metres of the camera, and folds the authored biome vertex colours in as a tint instead of using them as the whole albedo.
- **Rocks.** The hex "formations" are four noise-displaced rock variants in three size classes, settled into the ground with flattened undersides, instanced per variant, and shaded with the baked basalt layer through the existing triplanar detail path. Meadow pebbles use the same rock body.
- **Paths.** Every authored route surface (meadow trail, lookout branch, turnouts, Southwind, Woodland, Northstar, Windward, Orchard, Observatory, and Dawnlight trails and pads) uses `WornGroundMaterial`: compacted sand that fades into the regolith through an `across` attribute with noisy edges and scuffs; the meadow trail is the vehicle route and carries twin ruts.
- **Render loop.** The canvas content suspends while layers bake and scenic assets load, and the React Three Fiber loop could stay idle after the tree committed (the blank first frame seen during Phase 1). `WakeRenderLoop` in `src/World.tsx` requests a frame after every commit.

Not done in this phase, and why:

- The 0.25 m near-camera mesh. The 254-segment grid is the walkable contract that routes, scenery placement, and dozens of tests sample through `renderedTerrainHeight()`; a clipmap needs a separate visual mesh with a matching feet-on-ground policy and is its own piece of work.
- Carving the far ridge, mesas, and distant landforms into the heightmap. Unselected tiles still render as one flat fan per 75 m tile, which would erase any landform placed in the height field at those distances; this depends on the clipmap above.
- Scanned CC0 rock meshes and path decals as separate assets. Procedural rock bodies and the worn-ground surfaces cover the same ground without downloads; swap in scans when the Blender pipeline (Phase 3) is set up.

### Phase 3: implemented

Shipped as the habitat kit (`assets/blender/build_world_kit.py`, twelve `hab-*` modules in `public/models/world-kit/colony-hardware.glb`) and the enclosure code (`src/world/habitat/habitatLayout.ts`, `KitInstances.tsx`, `Habitats.tsx`, `reveal.ts`):

- **Enclosed modules.** Each of the four decks is now a pressurized module: 2 m wall and glazing tiles scaled to the deck sides, corner columns, 2 × 2 m roof tiles, exterior ribs, tie bands, conduits, dust skirts that drop to the lower ground, wall and roof radiators, and an airlock at every existing door node (open doorway, retracted leaves, hood, keypad, light bar, nameplate). Glazing faces +X and +Z where the authored cameras look in; the service sides are opaque. The Southwind trail leaves Comms Court through a wider gate. The communications dish moved from the court floor to its roof.
- **Routes untouched.** Walls stand on the deck edges, stepping back where the concourse lane, the promenade, the Dawnlight trail, and the Research Array's door-to-terrace chord run within a body radius of the deck edge (`INSETS`; the Resource Lab keeps its sampling rest spots on an open terrace, and the Research Array's south wall stands outside the deck over a floored apron). Ramps follow the walked chords through the doors. A test sweeps the 0.45 m body along every route chord against the real GLB triangles for every placed tile and prop.
- **Dollhouse reveal.** Within 22 m of a module (every zone preset), or when its resident is selected or followed, the roof fades out and the walls between the camera and the room fade to a ghost outline; glazing goes nearly clear. Shadows switch off with the roof. From the overview the modules stay closed and show warm interior light through the glass.
- **Interior.** Warm cove lamps on every wall tile and a luminaire under every roof tile, one fill light per module, and furnishing per zone: galley, lockers and crates in Habitat Commons; server racks and a sample cabinet in the Research Array; hydroponic racks and a locker in the Resource Lab; the survey console and lockers in Comms Court. A pendant status lamp hangs over each desk and carries the resident's state colour (working, tool, waiting, failed bloom; idle glows faintly).
- **Instancing.** Wall, glass, roof, corner, radiator and prop tiles draw as one instanced mesh per material group, with materials cloned per fading group so the reveal never touches the shared GLTF cache. Kit size stays under the 10 MiB test cap.

Not done in this phase, and why:

- Hand-modelled detail at 20–40k triangles per module with baked AO and edge wear. The tiles are authored by the same deterministic Blender script as the rest of the kit (bevelled volumes, trim parts without bevels) at 0.4–1.8k triangles each; the kit GLB is already at 9.6 MB of its 10 MiB budget, so denser tiles need a second GLB and a texture-atlas pass first.
- Pressurized corridors between modules and the "three or four modules on one plateau" relayout. The four decks, seats, door nodes, and route graph are unchanged; corridors would have to cross the concourse lane and the promenade that residents already walk.
- Per-resident props and decals. Furnishing is per zone, not per resident.

### Phase 4: implemented

Shipped as the colonist generator (`assets/blender/build_resident.py` → `public/models/resident/colonist.glb`, 1.3 MB) and the character runtime (`src/world/character.ts`, the `Resident` component in `src/World.tsx`):

- **An original alien, not a robot.** One body plan at 1.79 m: a long egg cranium with large tilted eyes and a narrow jaw, a slim segmented body with ball joints, three-finger mitten hands, a fitted suit with collar ring, chest readout, life-support pack, belt and boots. Eight residents differ by suit colour (the agent colour), trim, skin tone and accent palette, one of eight head accessories, and a build applied as shape keys (tall cranium, wide head, broad or slender torso). Limb lengths are shared so every variant keeps the same keyboard and chair contact.
- **A rigged, clip-driven character.** A 16-bone skeleton skinned in Blender (smooth weights across the torso, rigid limbs). Twelve clips are authored by the generator's analytic solver (two-bone IK for arms and legs, keyed at 24 fps) and exported as named glTF animations: Walking, Rest, ThumbsUp, DeskType, DeskReview, DeskWait, DeskError, BenchRest, CafeBreak, GardenLook, SurveySky, SampleScan. Three.js crossfades them over 0.45 s; the CCD pose system, the runtime clip generator and the procedural accessories are deleted.
- **Scale.** Standing height 1.79 m against the 1.3 m airlock openings and the 1.02 m desks; seated clips put the hips on the chair cushion with the root on the floor, so the seat lift and the bench lift in the motion controllers are gone. The walk cycle covers 1.2 m per clip second and is time-scaled to each resident's pace.
- **Faces.** Focused, Confused and Happy blend shapes on the head, eased per frame from the resident state (working and tool use focused, waiting and failed confused, fresh completion happy, otherwise neutral).
- **Contract tests.** `src/world/character.test.ts` loads the shipped GLB and checks every clip loops, both hands stay over the laptop keys in the typing clips, standing and bench loops stay anchored, the walk covers its stride, the expected morphs, accessories and material names exist, and that dressing eight residents clones materials without touching the shared asset.

Not done in this phase, and why:

- Retargeted motion-capture clips. Mixamo requires an Adobe account and licence acceptance that this project cannot automate, and CC0 clip packs would tie the rig to another skeleton; the authored clips keep the asset fully original and deterministic.
- A dedicated sit-down and stand-up transition. The seated settle is the 0.45 s crossfade plus the existing 0.6 s sitting ramp, which reads cleanly at the desk scale; a transition clip would need the motion controller to wait on clip time.
- A measured frame budget for eight skinned residents. Each resident is 11 draw calls (torso, six limb groups, three head groups, one accessory) and about 7k triangles; Phase 5 owns the budget.

### Phase 5: implemented

Shipped across the kit (`assets/blender/build_world_kit.py`), `src/world/ambient/`, `src/world/ambientLife.ts`, `src/world/scenery/kitMaterials.ts`, the camera presets in `src/world/layout.ts` and the review captures in `docs/review/phase5/`:

- **Landmarks on the Phase 3 standard.** The outpost habitat (`pressure-habitat`, used twice at Dawnlight Biolab, at Helios Power Field and at the Basalt Field Station) is rebuilt on the same raft: ribbed cylindrical hull under a low dome, tie bands, a five-pane glazing band, a habitat airlock with canopy, side radiators, dust skirt, service panels, conduits, roof vent, navigation light and antenna. Three new modules dress the other landmarks: a lattice `relay-mast` with two reflectors and a beacon at the Survey Lookout, a `fuel-farm` (two cradled propellant tanks, manifold, valves, readout, bollards) and eight instanced `pad-beacon` lights at Northstar Spaceport. The spaceport, observatory, biolab, power field and lookout all keep their footprints, so no route or fallback plan changed. No landmark was cut: each preset now composes one into a shot, and the scenic rock formations earn their place as horizon silhouettes.
- **Ambient life.** A wrapping field of 1,400 wind-blown dust particles drawn as one point cloud around the camera focus (GPU-side drift, day and night tints); three dust devils that fade in and out on the far plains, placed in view of the Overview, Horizon, Dawnlight and Helios shots and more than 30 m from every node and zone (tested); every kit navigation light breathing on one shared pulsing material (airlocks, pad beacons, masts, the relay); the spaceport rover patrolling a loop east of the pad clear of the trail and the fuel farm (tested); and a ring of pad dust washing outward under each launch. Low quality draws none of the particles and devils; reduced motion freezes the dust and parks the rover.
- **Camera presets as shots.** The nine landmark presets are authored with a `shot(look, bearing, pitch, span)` helper at a 14 to 16 degree pitch on their old bearings, so each frame carries foreground ground, the landmark in the middle distance and the horizon with sky in the upper third. The four colony presets stay steep for the dollhouse interiors. Shots that include the horizon now mount detail within a 150 m reach of the focus instead of every landmark at once.
- **Budget.** The kit GLB no longer embeds its 3.0 MB of textures; the runtime projects the shared surface maps onto kit materials by name (triplanar, in module space), which also removes a duplicate texture set from GPU memory and leaves 2.5 MiB of the kit cap free (7.4 MB used). The high-quality shadow map drops from 4096 to 2048. The render-stats overlay now counts every pass of the frame; before this it reported only the post-processing quad. Measured in the embedded development browser on this Apple Silicon machine, high quality holds 118 to 120 fps (p95 about 10 ms) on every landmark shot, 88 fps (p95 12.3 ms) at Dawnlight with the colony in frame, and 66 fps (p95 17.5 ms, 1,973 draws, 1.9 M triangles) at the Overview; low quality holds 120 fps everywhere, including 1,422 draws at the Overview. See [Rendering performance](rendering-performance.md).

Not done in this phase, and why:

- KTX2 textures. No Basis encoder (`toktx`, `basisu`) is installed on this machine and installing one is a system change to confirm first; the fifteen 512-pixel surface PNGs total 5.3 MB and are shared by primitives and the kit, so the win would be GPU memory rather than download size.
- Heat shimmer, flag and cable sway. There are no flags or free cables in the colony, and shimmer needs a screen-space distortion pass on top of the existing composer; both are cheap to add later but were not worth the frame cost now.
- Landmark LODs. Landmarks already swap to silhouettes outside the detail reach; per-module LOD meshes would need a second kit export.
- A device budget beyond this machine. The numbers above come from the embedded development browser at 1024 × 768, not a production build on a laptop panel; profile there before treating them as a guarantee.
