# The 3D world

The scene is assembled in [World.tsx](../src/World.tsx), with scenery in [world/Environment.tsx](../src/world/Environment.tsx). It combines procedural scenery with an animated GLB character. It is an eight-seat presentation of agent state with authored navigation between shared destinations; it is not a physics simulation.

## Scene composition

The island is 29.25 × 22.2 world units, 1.5× wider and deeper than the original (2.25× its area). Four explicit zones share layout data in `src/world/layout.ts`. The café has a cutaway roof, framed windows, a fluted espresso counter, bakery display, shared table, terrace tables/chairs, umbrella, planters, pendant lights, and subtle steam. Studio, garden/pergola, and courtyard have expanded floors and landscaping. The courtyard includes a bench and decorative basin.

Reusable primitives construct scenery. Original deterministic canvas textures add wood grain, stone speckling, and plaster variation; signage uses canvas text. Owned textures are disposed on unmount. The environment component is memoized. See [World layout and rendering](world-layout.md) for coordinates, detail levels, and extension boundaries.

Eight fixed seat positions in the shared layout define placement. In live mode, up to eight non-hidden sessions receive stable seat assignments, prioritizing pins then recency; older sessions remain in the list. Each resident's assigned seat also determines its desk; status drives the laptop lid. Working, tool, waiting, and failed residents have open laptops. Parent-child relationships are drawn as decorative raised lines when both agents are visible.

Changing world capacity requires coordinated changes to seat coordinates, desk placement, zone/color assignment, and the visible-resident filter. Increasing the server's 256-agent cap alone does not add visual seats.

## Character model and animation

The bundled [robot.glb](../public/models/robot.glb) is loaded with `useGLTF` and preloaded by the world module. Each resident uses a skeleton-aware clone so its animation mixer can run independently. Materials are cloned and recolored per resident; body geometry is shared. Eight procedural head-accessory styles, trim palettes, and movement preferences are derived from resident identity, independently of seat assignment. Accessories attach to the head bone; their geometry/materials are owned and disposed per resident. Body proportions remain unchanged to preserve desk alignment. Cloned materials are disposed when the resident unmounts.

| State                                 | Behavior                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| Working                               | Walk to the chair, settle, then use an authored alternating typing pose           |
| Tool use                              | Seated review pose with a restrained head glance; blue screen                     |
| Waiting                               | Seated raised-hand gesture, amber screen and attention marker                     |
| Failed                                | Seated head tilt, red screen and attention marker                                 |
| Fresh completion                      | Leave the chair, walk to the resting spot, give one brief thumbs-up, then rest    |
| Idle / completed with fresh telemetry | After a rest, visit a shared destination; return for work                         |
| Disconnected / unknown / stale        | No new outings; unknown residents rest near their desk and stale movement freezes |

`src/world/rig.ts` authors desk clips against the actual bundled skeleton. A one-time CCD solve places the hands over the keyboard for sampled keyframes; no IK runs per frame. The asset contract test samples hand placement throughout typing/review loops. These are generated clips for the existing robot, not new external animation assets. The laptop is moved nearer the seated character, and seating height/root offsets align the body with its chair.

`src/world/motion.ts` holds a reversible path controller. Each seat has an entry point, resting spot, side approach, and desk destination on its own floor. The expanded layout gives all seats the same route offsets, with furniture placed outside those routes. `journey.ts` extends this with cross-zone trips over the authored graph in `navigation.ts`. Destination poses include a seated bench rest, café break, and looking around the garden. Shared destinations and transit corridors are reserved to avoid conflicting trips. See [Resident identity and journeys](resident-journeys.md). Body pose blends over roughly 0.45 seconds; sitting height settles over 0.6 seconds. Work starts and interruptions reverse the same route without jumping directly through furniture. Resting spots have small ground markers.

When a visible session leaves near its desk, its character walks out and fades. Offsite residents fade in place, including while paused, so seat replacement cannot get stuck behind frozen traffic. Its seat admits the latest replacement only after departure, so the scene never mounts more than eight rigs. Rapid changes replace the pending arrival; hidden/departing residents are no longer selectable. Their cosmetic exit does not indicate task completion. Returning to a session before departure finishes cancels its exit.

Completion celebrations last about 1.8 seconds once the character reaches rest, require evidence less than 30 seconds old, and are not restarted by repeated snapshots. Unknown status and restored stale telemetry never trigger them. Demo behavior is explicitly simulated. Ambient gestures do not imply tool actions or task progress.

Reduced motion places characters immediately, uses still destination poses, and disables orbit; it skips walking, fades, and celebrations. Simulation pause and bridge loss freeze ordinary movement and animation. Cosmetic departures may finish while updates are paused so hidden sessions do not remain indefinitely. A snapshot loaded while paused is shown at its destination instead of invisible at an entry point.

Cloned materials and skeleton resources are disposed at unmount; shared model geometry is preserved. Per-frame movement uses mutable scene objects rather than React state updates. Frame deltas are bounded to prevent a long background-tab gap from jumping a character across its route.

Before replacing the rig, check scale, forward axis, floor origin, unique sanitized bone names, required clips, material names, and license. The authoring code currently expects `UpperArmL/R`, `LowerArmL/R`, `Palm1L/R`, `Head`, plus `Sitting`, `Walking`, `Idle`, and `ThumbsUp`. Run the asset contract test for any replacement. Preserve attribution in [the model license file](../public/models/LICENSE.md).

## Labels and interaction

Resident labels are DOM buttons positioned each frame by projecting a 3D anchor into the viewport. Text is assigned with `textContent`. A selected resident’s label shows cosmetic location/activity; tooltips expose it for all residents. The inspector labels the assigned zone as Home, since a resident may be visiting somewhere else. Labels are hidden when outside the view and can be toggled in settings; selection can keep a label visible. Both world selection and the ordinary resident list update the same store.

The list and inspector provide a text-based way to inspect activity without interpreting character gestures. Clicking empty canvas space clears selection. The application wraps world loading with Suspense and an error boundary.

## Cameras and lighting

The orthographic camera has overview, café, garden, studio, courtyard, and horizon presets. Preset targets and framing spans come from the shared layout; zoom is calculated from viewport dimensions. OrbitControls support manual orbit/zoom with constrained polar angles. Manual control cancels an active preset movement, following, and cinematic rotation. The horizon scene is decorative terrain around the first walkable district, not a second navigation area.

Preset transitions interpolate in the render loop; reduced motion makes them immediate. Cinematic mode slowly rotates the view. Day/evening settings change lighting and fog colors and enable lamp lighting. The main directional light uses a 2048 shadow map at high quality and 512 at low quality.

## Follow and watch modes

Select a resident occupying a seat and choose **Follow resident**. The camera follows the actual moving character, including trips across the island. The follow angle is raised to reduce foreground obstruction. Dragging or choosing a preset stops following. A session leaving the visible eight releases the follow camera. **Stop following** returns to the selected preset.

The eye button in the header enters **Watch mode**: the world fills the viewport, panels are hidden, and only the selected resident retains its label. A compact overlay keeps simulation/live connection context, attention access, and an exit button visible. Watching does not automatically start camera orbit or follow an agent. It respects the existing camera choice. Escape exits watch mode; outside watch mode it stops following, then clears selection. Dialogs retain their own Escape handling.

Watch and follow choices are temporary. Reduced motion makes camera placement immediate, and low quality lowers resolution/shadow cost and removes fine decorative layers. No frame-rate claim is made without device profiling.

## Performance and assets

Low quality uses device pixel ratio 1; high quality uses a range of 1–1.6. The canvas uses antialiasing, shadows, and a high-performance context preference. Each zone has a fine-detail layer. High quality admits it when the zone intersects the camera frustum and the orthographic zoom reaches 26 CSS pixels per world unit; it remains until zoom falls below 22. Visibility is sampled every 0.2 seconds and React state only changes at a detail boundary. Low quality omits these layers. Core buildings, furniture, all eight residents, and tracking remain active. Reduced motion hides café steam. This is detail selection within one loaded island, not chunk streaming.

The world is lazy-loaded, and Vite groups Three.js, React Three Fiber, and Drei in a dedicated chunk.

The 3D dependency chunk currently exceeds Vite's default 500 kB warning threshold. This is a known bundle-size issue, not evidence of a broken build. There is no established device performance budget or measured frame-rate guarantee yet. Profile representative devices before increasing geometry, lights, effects, or resident count.

The robot is a CC0 asset credited to Tomás Laulhé (Quaternius), with changes credited in its license file. Interface icons use Lucide. Fonts are loaded from Google Fonts, so the current app is not completely self-contained for offline use.

## Ambient life and visual finish

`src/world/Ambience.tsx` adds gentle tree sway, twelve instanced falling leaves along the planted perimeter, three expanding water rings in the courtyard basin, and small evening halos around existing lamps and café pendants. Leaves shrink to zero at the cycle boundary rather than visibly jumping back to the top. The water surface remains visible without animation. These effects are decorative: they neither read nor change agent activity.

High quality enables these effects. Low quality returns trees to their neutral pose and removes leaves, water rings, and halos. Reduced motion also returns trees to neutral and removes leaves/rings; steady lighting and static water remain. The existing café steam disappears under reduced motion or when its detail layer is absent. Simulation pause stops resident activity but does not stop environmental ambience; use Reduced motion for a still world. Ambient deltas are capped at 50 ms after a suspended tab. The wider landscape uses one terrain mesh, one scenic trail mesh, and instanced distant trees. The 600 × 600 ground blends the constructed district into meadow and a northern rise; the trail remains decorative. Low quality halves distant tree instances. This scenery has no task-driven animations.

Daylight uses a more restrained ambient/key-light balance; evening retains enough sky fill to read residents and status colors. Wood grain extends onto the studio floor, and subtle stone texture distinguishes paths and garden paving. Water uses a smoother material than stone or wood. Halos are small depth-tested sprites, not full-screen bloom; this pass adds no extra point lights or shadow maps. Canvas textures are original, local, and disposed with their owners.

See [Rendering performance](rendering-performance.md) for the opt-in diagnostic overlay and the limits of the measurements.

## Compact world HUD

The large introductory headline has been replaced with a compact location/status panel. Its district selector moves the camera to a named area. The label follows the camera focus point using the authored zone bounds, including while following a moving resident; focus between zones reads Overview and focus beyond the district reads Horizon. This describes the focused area, not everything visible in the viewport.

Working, needs-attention, completed, and unknown buttons open matching tasks across the known collection, including hidden and unseated tasks. “Here” selects residents assigned to the eight world seats, regardless of camera visibility. Counts refer to task records, including subagents, rather than claiming that every saved chat is a visible resident. Attention can overlap unknown activity. Bridge disconnection or stale telemetry moves activity into the unknown count while preserving unresolved attention. No status is rewritten by these filters.

Watch mode retains only the location chip and an attention button when needed. Selecting that button exits watch mode and opens attention. List filters can be cleared without changing seating, pins, or hiding. The minimap remains deferred until further spatial expansion.
