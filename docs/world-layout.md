# World layout and rendering

The inhabited district is **29.25 × 22.2 world units**. The original footprint was 19.5 × 14.8, so this is 1.5× on each horizontal axis and 2.25× the area. A continuous 600 × 600 scenic terrain now surrounds it. Capacity remains eight residents: two in each zone. Both the simulator and live mode use the same scenery and seat geometry.

## Layout contract

`src/world/layout.ts` owns the walkable district footprint, rectangular floor bounds, eight seat origins, and six camera presets. X is left/right, Y is elevation, and Z is depth. The grass surface is Y = 0.4. Floor coordinates specify the top surface rather than the center of a mesh. The surrounding terrain in `Environment.tsx` is scenic only; it is not part of these floors or the resident navigation graph.

| Zone      | Floor center (X, Y, Z) | Width × depth | Seat indices |
| --------- | ---------------------- | ------------- | ------------ |
| Café      | −7, 0.68, −4.5         | 12 × 10       | 0, 1         |
| Garden    | 7, 0.55, 5             | 10 × 8.4      | 2, 3         |
| Studio    | 7, 1.1, −5             | 9.6 × 7.6     | 4, 5         |
| Courtyard | −6, 0.49, 5.5          | 11 × 7        | 6, 7         |

The café occupies the back left, studio the back right, courtyard the front left, and garden the front right. Crossing paths connect the spaces visually. Café steps and studio stairs connect their raised floor edges. An authored waypoint network connects resident routes to shared destinations across the diorama. Stair nodes encode elevation changes; there is no generated collision mesh.

Each seat anchors its desk, laptop, chair, and a reversible local character route. The route enters 1.1 units to the right and 2.1 behind the seat, pauses at a resting spot, then approaches the chair from the side. Preserve body clearance around the entire route when placing furniture. Residents can continue from their resting spots onto the cross-zone graph. See [Resident identity and journeys](resident-journeys.md) for destination reservations and interruption behavior. Tests check route/body margins and desk bounds against each floor; visual review is still needed for furniture intersections.

## Art and camera direction

The café is the main landmark: warm plaster, sage trim, subtle wood grain, a shallow cutaway roof, communal table, espresso counter, bakery display, menu boards, and terrace seating. Additional chairs and tables are scenery, not extra agent slots. Evening mode adds warm pendant light and window color. Steam is decorative and independent of task activity; reduced motion hides it.

The studio retains its warmer roof and raised deck. The garden has a larger pergola, string bulbs, vine detail, and lower planting beds. The courtyard adds a resting bench, planting, paving, and a decorative basin with animated ripples. Trees sway slightly and twelve instanced leaves drift along the perimeter at high quality. Reduced motion keeps the world still. A broad terrain plateau meets the district floors and slopes into a meadow. A winding scenic trail, northern rise, and clustered instanced groves extend the view; these new features are not part of resident routes.

Overview frames the whole district. Café, Garden, Studio, and Courtyard presets use viewport-aware orthographic zoom. Horizon frames the inhabited district against the surrounding land and distant groves. Its camera rises in narrow viewports so the full vertical frame still intersects the ground. Follow resident still tracks the moving character. Watch mode provides an unobstructed scene. Camera movement respects reduced motion. Large roofs are intentionally shallow so users can see working residents and the interior.

## How detail selection works

`DetailLayer.tsx` evaluates each zone every 0.2 seconds:

1. Test a conservative zone bounding sphere against the camera frustum.
2. Estimate screen size. For the orthographic camera, zoom is CSS pixels per world unit; moving the camera farther away alone does not shrink objects.
3. On high quality, mount fine detail at 26 pixels/unit. Keep it until scale falls below 22, preventing flicker near the threshold.
4. Unmount it when offscreen or when low quality is selected.

Fine layers include floor seams, counter fluting, espresso/bakery props, small signs, books, vines, flowers, and steam. Their scene objects and frame callbacks unmount with the layer. Base architecture, major furniture, trees, desks, and residents remain mounted. Three.js additionally skips drawing individual meshes outside the view. Shared surface textures remain loaded for the base scene; this is not whole-zone memory eviction.

Low quality also uses DPR 1 and 512-pixel shadows; high quality allows DPR up to 1.6 and 2048-pixel shadows. A local diagnostic overlay is available with `?renderStats=1`; see [Rendering performance](rendering-performance.md). No device frame-rate guarantee has been established. Screen-space detail selection reduces optional geometry but does not eliminate the costs of the base scene, resident animation, shadows, or the existing Three.js bundle.

## Agent state is independent

Fine-detail selection never wraps bridge connections, Zustand state, resident assignment, or resident animation. Zooming away does not mark a session idle, hide it from the list, or stop receiving events. The latest-eight/pinned seating policy is unchanged. No provider jobs are launched by entering a zone.

## Extending the world

Change layout coordinates first, then update navigation nodes/edges and destination clearances, place scenery around the routes, and retune camera spans. Keep useful silhouettes in the base layer and optional decoration in a fine layer. Keep per-frame animation on mutable Three.js objects, avoid React state on every frame, and dispose textures/materials owned by a component.

Before adding many more districts, profile frame time, draw calls, shadow cost, and memory on representative devices. Consider shared/instanced geometry for repeated props. Actual chunk streaming would additionally need spatial chunk ownership, asynchronous asset loading, prefetch/eviction boundaries, and a persistent state layer independent of mounted scenes. Those systems—and infinite procedural terrain—are future work. See the [world expansion plan](world-expansion-plan.md) for the staged path from this decorative landscape to traversable districts.

Validation: `npm test`, `npm run build`, then inspect overview and each zone, high/low quality, evening, reduced motion, follow/watch, and narrow viewports. Automated layout/detail tests live in `src/world/layout.test.ts`.
