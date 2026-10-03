# Spatial scenery chunks

The world is a finite 600 × 600 scene. Splitting optional scenery into chunks is the first step toward a larger map; it does not make the terrain infinite or stream assets from a server. The broad ground, trail, lookout, and distant silhouettes stay visible while close details can mount near the camera and unmount after it moves away.

## Ownership boundary

A chunk owns only decorative scene objects such as meadow hummocks, flowers, and rocks. Agent sessions, resident rigs and journeys, route reservations, task attention, and recap history remain outside chunk components. Unmounting a detail chunk cannot change an agent's status or interrupt a trip.

The optional live map follows the same boundary: it reads camera focus and the positions of mounted resident rigs, independently of decorative chunk membership. It cannot infer a resident's task status from whether its surrounding scenery is mounted.

Chunk identity comes from fixed world coordinates, not React mount order or random generation. Placement must be deterministic so a returned chunk looks the same. Shared base terrain and authored routes continue across chunk boundaries without seams.

## Selection contract

The initial policy divides the square world into 60-unit cells with stable `detail-chunk:column:row` IDs. It selects optional detail near the camera's ground focus and position; the policy also accepts resident positions for later use. A larger exit distance than entry distance avoids flicker as the camera crosses a boundary. Selection runs every 0.2 seconds and caps mounted cells at 24, so moving toward the far horizon cannot mount the whole map at once. High and low quality choose different instance counts within the selected cells. Current chunk content is the meadow's instanced hummocks, flowers, and stones; it is generated deterministically in memory rather than fetched on demand.

This policy is about which details exist in the renderer. Three.js frustum culling still decides which mounted meshes are drawn. The oak, lookout, orchard, trails, and distant groves remain visible base scenery even when their surrounding fine-detail cell is not selected. Shared meadow geometry and materials are kept while individual chunk instance buffers are released on unmount. Meadow detail and pine placements exclude Orchard's arrival, pavilion, and branch corridor so remounting a chunk cannot obstruct its walkable route.

## Next expansion gates

Before adding several districts, verify camera travel through cell boundaries, repeated mount/unmount cycles, reduced motion, day and evening lighting, high and low quality, and a resident traveling while its scenery cell is absent. Record draw calls, frame intervals, and geometry/texture counts at settled views. The current diagnostic overlay cannot measure GPU memory bytes or loading hitches.

True streaming later needs asynchronous asset loading, prefetch and eviction ownership, terrain level-of-detail transitions, and resource disposal rules. Those systems should build on stable cell IDs without moving task or navigation state into the render chunks.
