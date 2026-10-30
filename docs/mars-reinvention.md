# Mars colony reinvention

Agentarium now presents a living Mars-inspired colony seen from its surface. (The planet and fictional solar-system views that shipped with this reinvention were later removed; see the note at the end.) The implementation retains React, TypeScript, Three.js, session identity, provider integrations, task briefs, attention, and recap.

## Implemented scope

| Requirement              | Implementation                                                                                                        | Verification                                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Desert world and horizon | Warm mineral terrain, crater, basalt formations, permanent distant landforms, matching sky/fog, colony infrastructure | Browser Horizon and destination captures; terrain palette, geometry, and seam tests                                  |
| Alien resident identity  | Eight equipment silhouettes, identity-based palettes/personalities, shared animated rig, survey and sample gestures   | Actual GLTF rig/accessory tests; navigation/journey tests; visible resident travel                                   |
| Continuous scenery       | Fine/coarse terrain cover, instanced geology, spatial detail, persistent distant/loading landmark silhouettes         | Terrain membership/coverage tests; fallback bounds, route-clearance, and arrival-sightline tests; Horizon inspection |
| Useful colony            | Session selection, attention indicators, task briefs, source actions and recap retain existing application state      | Frontend state tests and bridge integration tests                                                                    |
| Space program            | Northstar launchpad, rocket, gantry, cabin, rover; Expedition Base and research destinations                          | Spaceport browser inspection; terrain-supported pad/rover correction; authored route tests                           |

The biolab's original dome placement crossed its approach. Detailed habitats now sit north of the route; their shared placement aligns the distant silhouette. Corridor tests and browser review confirm the clear approach.

## Rendering and activity contract

The surface remains finite: 1,200 × 1,200 terrain, with camera focus constrained to X/Z ±210. Authored routes connect destinations; the wilderness is scenic rather than a generated walkable navmesh. Nearby scenery loads detail while coarse terrain and landmark silhouettes retain geographic continuity.

Resident outings, sample gestures, and the rocket's 90-second flight cycle are decorative. They cannot launch provider work or manufacture status updates. The eight visible residents remain a window into the complete session collection. Telemetry uncertainty and unresolved attention remain explicit.

## Verification record

- Frontend: 225 tests across 39 files pass after the completed world asset rollout.
- Bridge: 17 tests pass, including authenticated transport, lifecycle adapters, discovery, and history behavior.
- Production build passes; the existing large Three.js bundle warning remains.
- Browser checks cover desktop and 390 × 844 layout, daylight/evening, low quality and reduced motion, and surface destinations. Browser task-selection checks use the labeled simulator; provider protocol behavior is covered separately by bridge tests, not a claim of new live-provider end-to-end certification.
- Independent visual review identified navigation contrast. The correction uses dark labels on opaque pale surfaces; the reviewer scored that finding resolved with a **ship** verdict for the fix. That verdict is limited to the reviewed captures and finding.
- The design detector returned no findings. Review captures are recorded under `.impeccable/review/` locally.
- The completed asset rollout extends the approved Expedition Base reference across all active families with fifteen shared Blender modules, physical-scale materials, terrain-supported pads and eroded geology. Final asset review returned **ship** after the scoped findings closed; see [World asset upgrade](world-asset-upgrade.md) for module coverage, captures, cache-reload evidence, and limitations.

## Boundaries

No infinite terrain, general collision/navigation mesh, autonomous provider actions, or representative-device frame-rate guarantee is claimed. The shared character rig is retained; alien identity comes from equipment, palette, gestures, and personality rather than eight bespoke body meshes. Historical route IDs and some persisted home-zone values remain for compatibility.

See [World layout](world-layout.md), [3D implementation](3d-world.md), and [Spatial streaming](spatial-streaming.md) for maintenance details.

## Orbital views removed

The Planet and Solar system scales (`OrbitalWorld.tsx`, `universe.ts`, `UniverseControls.tsx`, and the procedural planet textures) were deleted so the product focuses on the surface world. Zooming out now stops at the surface camera's far limit. The `orbital-relay` module remains in the shared Blender kit GLB but nothing renders it. The Mars identity comes from the surface: sky, horizon, and far landforms. Historical performance measurements are labeled separately from the new colony build.
