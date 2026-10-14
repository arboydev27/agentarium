# Spatial scenery chunks

The world is a finite 1,200 × 1,200 scene. Splitting optional scenery into chunks and authored regions is a step toward a larger map; authored landmark code now loads asynchronously from the app’s static host. The ground keeps continuous coarse coverage while full-detail terrain and nearby decorative scenery follow the camera. Trails, arrival pads, lake, ridge, and rolling outer landforms remain available.

## Ownership boundary

A chunk owns only decorative scene objects such as meadow hummocks, flowers, and rocks. Agent sessions, resident rigs and journeys, route reservations, task attention, and recap history remain outside chunk components. Unmounting a detail chunk cannot change an agent's status or interrupt a trip.

The optional live map follows the same boundary: it reads camera focus and the positions of mounted resident rigs, independently of decorative chunk membership. It cannot infer a resident's task status from whether its surrounding scenery is mounted.

Chunk identity comes from fixed world coordinates, not React mount order or random generation. Placement must be deterministic so a returned chunk looks the same. A continuous biome field defined in `src/world/biomes.ts` gives each world coordinate woodland, highland, and Amber influence. Terrain color, instanced groundcover, and map/HUD wayfinding read that same field; chunk boundaries do not define biome boundaries. Shared base terrain and authored routes continue across chunks without seams.

## Selection contract

### Terrain coverage

The authoritative 254-segment ground grid divides into 256 stable `terrain:column:row` tiles. Most contain 16 × 16 segments; the final row and column contain 14. Full-detail tiles copy the original positions, triangle topology, colors, and global normals. Coarse tiles keep every boundary vertex and use a center fan inside, so neighboring levels meet without cracks.

The renderer selects full detail for tiles intersecting the camera frustum through the shared fog distance, then adds nearby camera/focus coverage and destination or movement prefetch. Ordinary selection samples every 0.2 seconds and uses wider exit than entry radii. A per-frame visibility guard admits newly visible tiles, and preset/map jumps prepare the full destination camera footprint before travel starts. The ordinary working set is capped at 64 tiles; mandatory visible coverage may exceed that cap on very wide or zoomed-out views, up to the finite 256-tile grid. Visible ground keeps the same height as scenery and resident routes.

Selected full-detail tiles merge into one mesh; every remaining tile merges into a second coarse mesh in the same React update. A tile appears in exactly one cover. Changing membership replaces and disposes both owned geometry buffers. One material is shared for the renderer lifetime, and the deterministic reference data stays in CPU arrays. No complete full-detail GPU ground sits beneath the selected tiles. This is local terrain generation and eviction; it does not fetch assets or generate an infinite world.

### Decorative scenery

The policy divides the square world into a 20 × 20 grid of 60-unit cells with stable `detail-chunk:column:row` IDs. It selects optional detail near the camera's ground focus and position; the policy also accepts resident positions for later use. A larger exit distance than entry distance avoids flicker as the camera crosses a boundary. Selection runs every 0.2 seconds and caps mounted cells at 24, so moving toward the far horizon cannot mount the whole map at once. Selected cells across the camera-reachable landscape now generate deterministic hummocks, flowers, and stones when mounted, including beyond the named destinations. The shared biome field varies their density, size, and colors without changing chunk ownership. Low quality uses fewer instances and no flowers. Unselected cells do not build their instance buffers. Placement uses rendered terrain height and excludes the inhabited floors, trails, landmark arrivals, oak, and ridge face. No network fetch or terrain eviction occurs.

Nine authored scenic regions use a second selector: Meadow Lookout shelter, Orchard Commons décor, Cedar Observatory décor, Lantern Hollow shelter, Dawnlight Glasshouse structure and garden, Windward Mill structure and grain yard, Northstar Outpost signal tower, plus the scenic-only Slate Reach and Amber Bluff outcrops. Their fixed bounds and IDs are independent of the meadow cells. Every 0.2 seconds, the selector measures a conservative ground footprint from the orthographic camera, adds a margin for tall scenery, and keeps regions through a wider exit band. The camera position also anchors prefetch. A new preset or map-scout target prefetches its destination immediately, before the camera travels; Horizon mounts all nine regions. If the frustum cannot be projected safely, all nine remain mounted. Ground, route ribbons, pads, Southwind Mere, and the far ridge never pass through this selector.

The Northstar trail, arrival pad, and the opened ridge saddle remain in the permanent scene. Its signal tower and local highland detail belong to the Northstar scenic region. Both meadow groundcover and instanced grove placement clear the trail and tower footprint, so remounting detail cannot block travel.

The outer landscape belt keeps a sparse coarse layer mounted across its occupied world cells. Denser trees and stones partition into deterministic 50-unit groups; at most six nearby groups mount around the camera and its ground focus, with wider exit than entry radii. Shared geometry and materials stay resident while departing groups release their instance buffers. Route and landmark exclusions keep props away from authored travel, and low quality uses fewer instances. The rolling outer landforms are one permanent scenic mesh. None of these visual layers own resident, route, or task state.

These policies control which objects exist in the renderer. Three.js frustum culling still decides which mounted meshes are drawn. Shared meadow geometry and materials are kept while individual chunk instance buffers are released on unmount. Authored regions release their owned instance buffers when they unmount; resources shared by the permanent scene remain. Meadow detail and pine placements exclude the Orchard and Cedar Observatory arrivals and branch corridors, while forest placement also clears the Lantern Hollow trail, arrival, shelter, and sightline. Remounting detail cannot obstruct these walkable routes.

## Asynchronous authored landmarks

`src/world/scenicAssets.ts` defines nine literal dynamic imports. Importing the registry is inert. The initial orthographic footprint requests nearby regions, rather than first mounting all nine; a wide or unsafe footprint deliberately admits all regions. The current camera and incoming preset/map target share the visibility selector. Destination preloads run concurrently and deduplicate with visible loads. Horizon requests all nine.

Each `ScenicAsset` has its own Suspense and error boundary. A stable ID-keyed cache exposes idle, loading, ready, and failed states without changing provider status. Failed promises stay failed until explicit retry. Retry creates a fresh cache/React.lazy generation, deduplicates repeated requests, and ignores stale completions. A failed region cannot stop another region loading or tear down residents and permanent routes. A compact **Scenery loading** card keeps recovery accessible after moving away; the failed landmark also offers a local retry button.

Browser module loading has an additional cache outside React. Some browsers retain a failed dynamic-import request and reject retries without another network fetch. After an unsuccessful import retry, the recovery card offers an explicit page reload. Reload reinitializes the page and its module map; live users must reconnect the bridge afterward. It is not an automatic refresh loop. Missing or outdated deployed chunks may still require fixing the static host. Render failures are also isolated, but a reproducible rendering bug needs a code fix rather than repeated reloads.

`ScenicFallback` uses nine lightweight silhouettes at authored landmark coordinates, with three shared geometries and six world-lit materials. They contain no arrival floors, walls across routes, task signs, animation, or resident interaction targets. Route-clearance and destination sightline tests cover their placement. These bounded resources stay shared for the renderer lifetime. Full décor replaces them when ready. Authored instancing initializes matrices, colors, and bounds in layout effects before the first render or shadow pass; passive initialization exposed black cedar foliage on a cold asynchronous mount. A real R3F first-frame test covers the corrected ordering and disposal.

Permanent surface modules (`*Ground.tsx`) never import their corresponding decorative module. They retain trails, arrival pads, and Dawnlight’s conservatory floor while the structure loads or unmounts. The build manifest (`dist/.vite/manifest.json`) records every decorative file as a dynamic entry; the static import closure of `src/World.tsx` excludes those entries. Serve the complete `dist/` directory, including hashed chunks, and retain assets needed by existing pages during a deployment.

Loaded JavaScript modules and reusable components remain cached for the page lifetime. Leaving a region retires mounted meshes and owned GPU buffers, not the browser’s imported code. This is asynchronous code loading for procedural landmarks, not streaming GLB districts, worker generation, or an infinite terrain system.

## Production verification

October 13, 2026: the production manifest emitted nine independent authored-scenery entries, with none in the static import closure of `src/World.tsx`. A cold desktop Overview fetched seven nearby scenic modules; Amber Bluff and Northstar remained unrequested until navigation or Horizon admitted them. These are request observations, not a measured startup-speed improvement.

A temporary loopback server returned HTTP 503 for the Northstar chunk. Its silhouette, permanent route, arrival pad, and resident UI remained usable; recovery stayed available after navigating away. The tested in-app browser retained the failed import URL after the server recovered. An explicit retry exposed **Reload world**, and clicking it enabled a fresh successful Northstar download. The recovery card and restored landmark were checked at 390 × 844. Daylight/high-quality destinations, evening/low-quality/reduced-motion Windward, and Horizon rendered without browser warnings after recovery. Unit tests cover independent loads, stale attempts, recovery history, silhouette route clearance, and camera sightlines. Representative-device loading and memory profiling remains a separate expansion gate.

## Next expansion gates

Before adding several districts, verify camera travel through cell boundaries, repeated mount/unmount cycles, reduced motion, day and evening lighting, high and low quality, and a resident traveling while its scenery cell is absent. Record draw calls, frame intervals, and geometry/texture counts at settled views. The current diagnostic overlay cannot measure GPU memory bytes or loading hitches.

Further streaming needs profiling of loading and generation, worker generation where CPU costs justify it, and larger-world resource budgets. Terrain levels now have matching boundaries and explicit buffer disposal; future systems should build on stable IDs without moving task or navigation state into render chunks.
