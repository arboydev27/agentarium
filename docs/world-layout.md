# World layout and rendering

Agentarium is a Mars-inspired alien colony surrounded by finite desert terrain. The inhabited district is **29.25 × 22.2 world units**; continuous **1,200 × 1,200** terrain surrounds it. Eight visible residents represent a window into the full session collection. Simulation and live mode share the same scenery and seating.

## Districts and destinations

Stable internal IDs preserve saved views, seating, and navigation while the displayed destinations use the colony theme.

| Internal view | Destination          | Character                                                            |
| ------------- | -------------------- | -------------------------------------------------------------------- |
| café          | Habitat Commons      | Open service spine, canopy, shared workstations                      |
| garden        | Resource Lab         | Processing tanks and sample equipment                                |
| studio        | Research Array       | Raised research deck and service wall                                |
| courtyard     | Comms Court          | Communications dish and illuminated paths                            |
| lookout       | Survey Lookout       | Sensor masts and survey console                                      |
| orchard       | Expedition Base      | Blender-authored reference habitat, textured ground, solar equipment |
| observatory   | Deep Sky Array       | Telescope terrace and antenna fringe                                 |
| northstar     | Northstar Spaceport  | Rocket, launchpad, gantry, control cabin, rover                      |
| hollow        | Basalt Field Station | Remote habitat and instrumentation                                   |
| dawnlight     | Dawnlight Biolab     | Two pressure habitats north of the approach                          |
| windward      | Helios Power Field   | Habitat, solar racks, tall sensor mast                               |
| mere          | Southwind Crater     | Mineral basin and sampling station                                   |
| amber         | Amber Bluff          | Scenic stratified rock formation                                     |

Slate Reach and Amber Bluff are scenic formations, not resident destinations. Authored trails connect the other outer destinations and two trail rests. Procedural rocks fill the wilderness while respecting route exclusions. Residents do not freely traverse every terrain triangle.

## Layout contract

`src/world/layout.ts` owns the district footprint, floor bounds, seats, and camera presets. X is left/right, Y is elevation, and Z is depth. Floor coordinates specify the top surface.

| Zone            | Floor center (X, Y, Z) | Width × depth | Seats |
| --------------- | ---------------------- | ------------- | ----- |
| Habitat Commons | −7, 0.68, −4.5         | 12 × 10       | 0, 1  |
| Resource Lab    | 7, 0.55, 5             | 10 × 8.4      | 2, 3  |
| Research Array  | 7, 1.1, −5             | 9.6 × 7.6     | 4, 5  |
| Comms Court     | −6, 0.49, 5.5          | 11 × 7        | 6, 7  |

Each deck is enclosed by a pressurized module (`src/world/habitat/habitatLayout.ts`). Walls stand on the deck edge except where a shared route runs within a body radius of it: the Habitat Commons south wall steps 0.8 m in from the concourse lane, the Resource Lab's north wall 0.9 m and its south wall 3.0 m (the Dawnlight trail crosses the deck's southern strip, which stays an open sampling terrace with the resource-lab rest spots), the Comms Court east wall 0.3 m from the promenade, and the Research Array's south wall stands 0.6 m outside its deck over a floored apron. Every door node keeps its airlock; the Southwind trail leaves Comms Court through a wider gate; ramps follow the walked chords.

Seats anchor desks, laptops, chairs, and reversible local routes. Residents join an authored waypoint graph from their resting spots. Stair nodes encode floor changes; there is no generated collision mesh. Keep structures clear of routes, arrival pads, and the camera's view of arriving residents. See [Resident identity and journeys](resident-journeys.md).

`terrain.ts` supplies smooth design heights and exact triangle-interpolated heights on the authoritative 254-segment grid. Most outer routes sit above the higher surface. The Basalt Field Station spur uses rendered triangle heights directly. Scenery uses terrain heights independently; broad structures such as the launchpad must account for their entire footprint, not only their center.

## Surface exploration

Overview and destination presets use viewport-aware orthographic framing. Horizon uses a perspective camera. Drag/orbit, keyboard arrows, map scouting, resident following, and watch mode provide different ways to explore. Shift increases keyboard pan distance. Camera focus stays within X/Z ±210, well inside the finite terrain boundary.

Map scouting moves the camera without moving residents. North is negative Z. Manual camera adjustment clears preset highlighting. Focus labels describe the current location independently of the selected preset. Basalt Flats, Iron Highlands, and Amber Foothills provide broader geographic context.

## One scale: the surface

The world has one scale. The surface Canvas is the only scene; zooming out stops at `SURFACE_MAX_DISTANCE` (`src/world/perspective.ts`) so the colony stays in view against its sky, horizon, and far landforms. The former Planet and Solar system views, their procedural planet textures, and the scale selector were removed so the product focuses on the surface world.

## Detail and visibility

Terrain maintains a merged full-detail cover near the camera and coarse cover elsewhere, with shared boundary vertices. Distant landforms and instanced desert geology provide persistent silhouettes. Nearby mineral details use spatial selection. Nine authored scenic regions load detailed modules near the camera, prefetch on destination requests, and use unload hysteresis. Inactive, loading, or failed regions retain inexpensive fallback silhouettes; failures expose retry controls.

Routes and arrival ground remain mounted independently of scenery loading. Detailed scenery must agree with fallback placement and remain within its visibility bounds. `scenicFallbackPlan.test.ts` checks fallback bounds, route clearance, and arrival sightlines.

Low surface quality uses DPR 1 and 512-pixel shadows; high quality allows DPR up to 1.6 and 2048-pixel shadows. A local diagnostic overlay is available with `?renderStats=1`. No representative-device frame-rate guarantee has been established. See [Rendering performance](rendering-performance.md) and [Spatial streaming](spatial-streaming.md) for the underlying infrastructure; older names in code refer to stable region identities.

## Factual activity and decorative life

Resident equipment and personalities persist across task states. Survey and sample-inspection gestures, travel, the spaceport's flight cycle, and satellite motion are decorative. They never fabricate task progress, launch provider jobs, or imply completion. Task briefs, attention, recap, and source-session actions continue to use actual session state. Unknown activity remains unknown.

Zooming away does not disconnect the bridge or remove sessions from the task list. The latest-eight/pinned seating policy remains independent of the world renderer.

## Extending and verifying

Update layout and navigation before placing new structures. Preserve route clearance, terrain contact, arrival visibility, and simplified distant representations. Keep frame animation on mutable Three.js objects and dispose component-owned GPU resources. Profile draw calls, shadow cost, and memory before expanding further. This is a finite explorable world, not an infinite terrain generator.

Run `npm test` and `npm run build`. Review surface presets, camera limits, high/low quality, evening light, reduced motion, narrow viewports, and scenic loading failure/retry. Track remaining reinvention work in [Mars reinvention](mars-reinvention.md).
