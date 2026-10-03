# Resident identity and journeys

Residents now have distinct looks and can visit destinations beyond their assigned desk. The system still displays up to eight live sessions and does not launch or direct real provider work.

## Identity and appearance

`personality.ts` derives a stable profile from resident identity, not seat index. The eight demo residents intentionally cover all eight styles: headphones, cap, antennae, glasses, beret, ear fins, flower, and visor. Live identities deterministically select a style; different sessions can share one. Accent/trim palettes, pace (1.08–1.32 world units/second), rest time (10–18 seconds), destination preference, and visit duration (7–13 seconds) vary with the profile.

Accessories are original procedural geometry attached to the bundled robot's animated head. The existing body rig and proportions are preserved for reliable keyboard contact and chair alignment. This milestone does not add eight new body meshes or human characters. Accessories remain visible at low quality and under reduced motion. Owned geometry/materials are disposed when residents leave; the shared GLB geometry is retained.

The shared rig's standing rest, bench rest, café break, and garden look loops now include small head, torso, and arm gestures. Their feet and hips remain anchored to the original floor or seat pose, and the desk-hand alignment remains separate. These are cosmetic movements; they do not represent provider activity.

## Destinations and routes

Eleven destination slots are available:

| Destination         | Visual activity          |
| ------------------- | ------------------------ |
| Café counter        | Standing café-break pose |
| Café window         | Looking around           |
| Garden west terrace | Looking around           |
| Garden east terrace | Relaxing                 |
| Courtyard bench     | Seated rest              |
| Courtyard basin     | Looking at the water     |
| Studio terrace      | Relaxing                 |
| Tree-lined path     | Looking around           |
| Meadow Lookout      | Looking around           |
| Orchard Commons     | Looking around           |
| Cedar Observatory   | Looking around           |

The navigation graph connects each desk's existing resting point to authored clear lanes, central paths, stairs, and destination branches. Shortest-path planning uses geometric edge distance. Routes include floor heights, studio stair elevations, and terrain-aligned trail samples leading to Meadow Lookout, Orchard Commons, and west to Cedar Observatory. Destinations are terminal branches so a resting resident does not occupy a through-route. This is pathfinding over authored waypoints, not a generated navmesh, physics engine, or arbitrary obstacle avoidance.

A resident first finishes its local desk transition and any eligible completion reaction. After its profile's rest interval, it attempts an outing. It tries preferred destinations in a rotating order, visits an available one, rests, and returns home. If no route is available, it waits near its desk and retries after roughly one second.

## Shared-space coordination

Each destination has an exclusive lease. A traveling resident atomically reserves its route ahead, including named nodes, edges, and grid cells covering overlapping physical lanes even when their waypoint names differ. Nodes and lane cells are released after the resident clears them by 0.95 units, allowing a new trip into a cleared branch without waiting for the first resident to reach its destination. The destination remains reserved until the resident returns. A return reclaims the complete path before reversing and has priority over new outings. Leases are released on return, removal, reduced-motion placement, and unmount.

This deliberately conservative scheme prevents head-on meetings and partial-lock deadlocks. It can make a resident wait longer than local steering would because the path ahead remains reserved. Orchard Commons is roughly 100 route units from the central path, so a complete return can take over 90 seconds at the slowest resident pace even without contention. A paused or stale traveler keeps its corridor so other residents do not walk through it. If an interrupted resident cannot reclaim its route for eight seconds of active travel, it fades out offsite, releases all leases once invisible, and fades in at its home rest point. A routine post-visit return has a 25-second allowance. These timeouts pause with travel, but a fade already underway finishes during a pause so it can release its leases. The resident remains invisible at home until playback resumes. The fallback changes only the cosmetic journey. Two routes at different elevations may also block each other if their ground-plane footprints overlap. It does not reroute around arbitrary newly placed props. Before expanding capacity, consider passing lanes and a crowd-steering layer.

## Work takes priority

Only idle or completed residents with non-stale telemetry start outings. Working, tool, waiting, and failed states initiate a return; unknown/disconnected states do not start new trips. An interrupted outbound trip reverses continuously along the same route when the corridor is available. An agent already at a destination first acquires a return corridor and stands up if seated. Once home, the original chair/keyboard transition takes over.

The agent's actual status, attention indicators, and laptop update immediately. Walking back is cosmetic and does not delay provider execution or acknowledgement. Journey animation never writes a task status, completion event, or provider action. Parent-child lines remain between home desks.

The **Resident outings** setting is on by default. Turning it off returns residents home when movement is running and prevents new outings. **Reduced motion** cancels trips and immediately places residents at their desk/rest destination with still poses. Pausing simulation or losing live transport freezes ordinary travel. Low quality retains travel because it communicates the same world behavior while removing optional scenery.

When a session is removed near its desk, the existing walk-out/fade remains. When removed offsite, it fades in place in roughly one-third of a second, even if paused. This prevents a frozen corridor from blocking the next occupant of its seat. The world still mounts at most eight rigs.

## Seeing what a resident is doing

Select a resident to see its cosmetic activity in its world label—for example, Walking to café counter, Resting at courtyard bench, or Returning to desk. All resident-label tooltips expose that activity. The inspector identifies the assigned zone as **Home**, which remains stable while the resident travels. Follow resident tracks actual moving position; camera presets, including WebMCP view changes, cancel follow. The raised follow angle reduces foreground obstruction but does not guarantee an unobstructed view from every direction.

Demo automatic ticks leave idle residents alone for at least 60 seconds while outings are enabled so visits can be seen. One demo resident now prefers Meadow Lookout on its first outing, making the distant route observable during ordinary simulation; other destinations remain in rotation. Manual task/status controls remain immediate, and live telemetry has no such delay. Simulation speed controls event scheduling; walking pace remains measured in real seconds. Outing preferences and positions are temporary, not saved journeys.

## Expanding safely

1. Add or move floors/props in the layout and scenery modules.
2. Add navigation nodes, connections, height transitions, and terminal destinations in `navigation.ts`. Keep branches clear of desk/resting positions and existing scenery.
3. Keep new destinations outside decorative detail layers; a path must not disappear with camera zoom.
4. Add destination poses in `rig.ts` and verify the shared skeleton contract. Keep accessory geometry independent of body animation tracks.
5. Run layout, navigation, traffic, interruption, pause/removal, and asset tests. Inspect the new route in the browser, including reduced motion and follow mode.

Tests cover all 88 home-to-destination routes, reverse paths, desk/chair and selected major-prop clearance, lookout, orchard, and observatory trail grade and clearance, atomic leases, returning priority, overlapping lanes with different waypoint names, interrupted travel, and multi-resident simulations without body overlaps. These authored-footprint checks do not replace visual inspection or constitute a general collision solver.
