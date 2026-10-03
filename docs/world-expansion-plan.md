# Toward an explorable Agentarium world

Agentarium's inhabited district contains the café, studio, garden, courtyard, eight resident seats, and authored paths between them. Routes now leave that district for Meadow Lookout, Orchard Commons, Cedar Observatory, and two side rests along the meadow trail. Most surrounding terrain and distant groves remain visual scenery, not a general navigation surface. This distinction matters to users and to future navigation code.

## Experience target

A user should be able to pan from the original district toward a visible horizon, discover other distinct places, and still find work that needs attention. Residents remain tied to real sessions; crossing a map boundary never changes their task status. The world can grow substantially without requiring every distant tree, prop, resident, and animation to stay mounted at once.

The spatial model should have three layers:

| Layer           | Purpose                                                        | Current state                                                 |
| --------------- | -------------------------------------------------------------- | ------------------------------------------------------------- |
| Active district | Desks, routes, destinations, interactive selection             | Four-zone island implemented                                  |
| Near landscape  | Connected paths and landmarks that can become future districts | Three landmarks, two trail rests, and their authored branches |
| Far horizon     | Silhouette and atmosphere without unnecessary detail           | Perspective view, terrain, ridge, arch, and fog               |

## Milestones

### 1. Establish the horizon and camera language

Extend the visible ground well beyond the current island, keep the existing desk/navigation geometry clear, and give users an explicit horizon view. Use inexpensive geometry and instance repeated trees. Match fog to the terrain edge so zooming or panning does not expose an abrupt empty border. Test day/night, low/high quality, reduced motion, watch/follow, and different window sizes.

The current implementation uses a finite 600 × 600 landscape. A raised plateau blends the original district into meadow, with a winding trail, clustered groves, meadow groundcover, a distinctive amber oak, and a northern rise. A low-poly ridge and ruined arch add depth behind the orchard. Slate Reach adds a northern rock silhouette, while Southwind Mere adds a scenic basin and lake in the southern camera-travel area. Horizon uses perspective to show a lower skyline and far land. Terrain and placement are deterministic; selected meadow-detail cells generate locally on mount, while the base terrain and distant silhouettes remain continuously mounted. No background asset loading or terrain streaming runs yet. Authored routes along the trail carry residents to the lookout, Orchard Commons, Cedar Observatory, and two trail rests. Route nodes and visible ribbons share a height rule checked against the actual rendered terrain triangles.

### 2. Make the first outside area truly traversable

Choose one neighboring district with a purpose and clear silhouette, then author its floor, route connections, destination slots, sightlines, and camera bookmark. Move from an isolated floating island toward continuous paths. Preserve a path back to every current seat and a way to distinguish the home district from a resident's current destination. Add collision/clearance checks for every new prop, not only the old eight seats.

Meadow Lookout is the first outside area, with an open-sided shelter, an authored branch from the trail, a terminal destination, terrain-aligned route samples, and a camera bookmark. Orchard Commons extends the same trail farther north to a second terminal destination. Cedar Observatory branches west from the trail into a wooded terrace. Each landmark has a terminal destination and camera bookmark. The two smaller trail rests branch to opposite sides of the main trail, with a bench to the west and a wayfinder to the east. Their IDs are district-qualified and their routes are covered by grade, clearance, and interruption tests. The current global graph can serve these small areas, but its conservative corridor reservations can make long trips wait; the rests do not yet provide passing or convoy control. Further expansion needs more route capacity and passing behavior. Keep visual availability separate from provider activity: an offscreen resident must not become idle merely because its scenery unmounts.

### 3. Add spatial streaming before multiplying districts

Partition the world into bounded chunks with explicit ownership of terrain, props, lights, animations, and optional detail. Keep a small neighborhood mounted around the camera and any visible resident. Prefetch ahead of camera movement; unload objects and their owned GPU resources after they leave a hysteresis margin. Distant land uses coarse meshes or impostors so the horizon remains continuous. Task/session state, navigation identity, attention, and recaps stay outside chunk components.

A chunk is an implementation boundary, not an agent-session boundary. A traveling resident must keep route and reservation state even if the camera moves away. Plan transitions so roads and elevations meet at chunk edges. Provide deterministic placement and stable IDs so a remount does not move landmarks.

Optional meadow hummocks, flowers, and stones now generate per selected 60-unit cell across the camera-reachable landscape. At most 24 cells mount near the camera with hysteresis; each returns with the same placement after unloading. The terrain, trails, landmarks, groves, and resident state remain outside those cells. This is local detail generation and spatial mounting, not asynchronous asset streaming or terrain eviction.

### 4. Broaden navigation and camera controls

When more than eight residents or multiple active districts are visible, revisit seat allocation and traffic priorities. The optional map jumps among Overview, Lookout, Orchard, Observatory, and Horizon, locates the camera focus and currently visible residents, and scouts any point within bounded camera travel. Focused arrow-key panning also provides bounded travel. Add region search, map zoom, and a fuller spatial model as new districts arrive. Keep a list-based route to every task needing attention. Add local avoidance or passing lanes where authored paths become busy; do not assume visual terrain alone is traversable. Same-direction meadow convoys remain deferred until a safe off-trail turnaround rule and headway control are implemented; simply relaxing corridor leases would risk head-on conflicts after an interruption.

### 5. Set a performance budget and ship gates

Measure on representative laptops at overview, horizon, a dense district, and during several resident journeys. Capture median and slow frame times, draw calls, triangles, GPU memory where available, and loading hitches. Set explicit budgets from those measurements before raising resident/prop counts. Test renderer quality tiers and long sessions for leaked materials, geometry, textures, or event listeners.

A release of a larger district should meet these gates: no resident clips through new scenery, known tasks remain reachable offscreen, old and new paths are continuous, camera travel does not stall task ingestion, unloading does not lose agent state, and the horizon does not visibly terminate at normal camera limits.

## Current constraints

The finite authored node graph, eight seated residents, and single-scene renderer are good for the original district, three outside landmarks, and two trail rests. They are not an infinite-world engine. Orthographic views serve close places and the perspective Horizon serves the vista. Most wide terrain is still visual context; expansion should proceed in measured districts rather than treating distant decorative geometry as completed world scale.

See [World layout and rendering](world-layout.md), [Resident identity and journeys](resident-journeys.md), and [Rendering performance](rendering-performance.md) for the current contracts and measurement method.
