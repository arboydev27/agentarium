# Spatial scenery chunks

The world is a finite 600 × 600 scene. Splitting optional scenery into chunks and authored regions is a step toward a larger map; it does not make the terrain infinite or stream assets from a server. The broad ground, trails, arrival pads, lake, and distant ridge stay visible while nearby decorative scenery mounts around the camera.

## Ownership boundary

A chunk owns only decorative scene objects such as meadow hummocks, flowers, and rocks. Agent sessions, resident rigs and journeys, route reservations, task attention, and recap history remain outside chunk components. Unmounting a detail chunk cannot change an agent's status or interrupt a trip.

The optional live map follows the same boundary: it reads camera focus and the positions of mounted resident rigs, independently of decorative chunk membership. It cannot infer a resident's task status from whether its surrounding scenery is mounted.

Chunk identity comes from fixed world coordinates, not React mount order or random generation. Placement must be deterministic so a returned chunk looks the same. Shared base terrain and authored routes continue across chunk boundaries without seams.

## Selection contract

The policy divides the square world into 60-unit cells with stable `detail-chunk:column:row` IDs. It selects optional detail near the camera's ground focus and position; the policy also accepts resident positions for later use. A larger exit distance than entry distance avoids flicker as the camera crosses a boundary. Selection runs every 0.2 seconds and caps mounted cells at 24, so moving toward the far horizon cannot mount the whole map at once. Selected cells across the camera-reachable meadow now generate deterministic hummocks, flowers, and stones when mounted, including beyond the three named destinations. Low quality uses fewer instances and no flowers. Unselected cells do not build their instance buffers. Placement uses rendered terrain height and excludes the inhabited floors, trails, landmark arrivals, oak, and ridge face. No network fetch or terrain eviction occurs.

Five authored scenic regions use a second selector: Meadow Lookout shelter, Orchard Commons décor, Cedar Observatory décor, Dawnlight Glasshouse structure and garden, and the scenic-only Slate Reach outcrop. Their fixed bounds and IDs are independent of the meadow cells. Every 0.2 seconds, the selector measures a conservative ground footprint from the orthographic camera, adds a margin for tall scenery, and keeps regions through a wider exit band. The camera position also anchors prefetch. A new preset or map-scout target prefetches its destination immediately, before the camera travels; Horizon mounts all five regions. If the frustum cannot be projected safely, all five remain mounted. Ground, route ribbons, pads, Southwind Mere, and the far ridge never pass through this selector.

These policies control which objects exist in the renderer. Three.js frustum culling still decides which mounted meshes are drawn. Shared meadow geometry and materials are kept while individual chunk instance buffers are released on unmount. Authored regions release their owned instance buffers when they unmount; resources shared by the permanent scene remain. Meadow detail and pine placements exclude the Orchard and Cedar Observatory arrivals and branch corridors so remounting a chunk cannot obstruct their walkable routes.

## Next expansion gates

Before adding several districts, verify camera travel through cell boundaries, repeated mount/unmount cycles, reduced motion, day and evening lighting, high and low quality, and a resident traveling while its scenery cell is absent. Record draw calls, frame intervals, and geometry/texture counts at settled views. The current diagnostic overlay cannot measure GPU memory bytes or loading hitches.

True streaming later needs asynchronous asset loading, prefetch and eviction ownership, terrain level-of-detail transitions, and resource disposal rules. Those systems should build on stable cell IDs without moving task or navigation state into the render chunks.
