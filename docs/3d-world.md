# The 3D world

The scene is implemented in [World.tsx](../src/World.tsx). It combines procedural scenery with an animated GLB character. It is an eight-seat presentation of agent state, not a physical simulation or navigation system.

## Scene composition

The environment contains a café, garden/pergola, studio, courtyard, desks, laptops, plants, trees, lamps, and signage. Reusable box, cylinder, and sphere helpers construct most scenery. Sign text is drawn into canvas textures. The environment component is memoized to reduce unnecessary React work.

Eight fixed seat positions define placement. In live mode, up to eight non-hidden sessions receive stable seat assignments, prioritizing pins then recency; older sessions remain in the list. Each resident's assigned seat also determines its desk; status drives the laptop lid. Working, tool, and waiting residents have open laptops. Parent-child relationships are drawn as decorative raised lines when both agents are visible.

Changing world capacity requires coordinated changes to seat coordinates, desk placement, zone/color assignment, and the visible-resident filter. Increasing the server's 256-agent cap alone does not add visual seats.

## Character model and animation

The bundled [robot.glb](../public/models/robot.glb) is loaded with `useGLTF` and preloaded by the world module. Each resident uses a skeleton-aware clone so its animation mixer can run independently. Materials are cloned and recolored per resident; geometry is shared. Cloned materials are disposed when the resident unmounts.

| State                       | Behavior                                                                       |
| --------------------------- | ------------------------------------------------------------------------------ |
| Working                     | Walk to the chair, settle, then use an authored alternating typing pose        |
| Tool use                    | Seated review pose with a restrained head glance; blue screen                  |
| Waiting                     | Seated raised-hand gesture, amber screen and attention marker                  |
| Failed                      | Seated head tilt, red screen and attention marker                              |
| Fresh completion            | Leave the chair, walk to the resting spot, give one brief thumbs-up, then rest |
| Idle, disconnected, unknown | Rest nearby, with a gentle glance/stretch loop; no invented success signal     |

`src/world/rig.ts` authors desk clips against the actual bundled skeleton. A one-time CCD solve places the hands over the keyboard for sampled keyframes; no IK runs per frame. The asset contract test samples hand placement throughout typing/review loops. These are generated clips for the existing robot, not new external animation assets. The laptop is moved nearer the seated character, and seating height/root offsets align the body with its chair.

`src/world/motion.ts` holds a reversible path controller. Each seat has an entry point, resting spot, side approach, and desk destination on its own floor. The right studio route is shortened to clear the bookcase. This is local authored routing, not island-wide navigation or collision avoidance. Body pose blends over roughly 0.45 seconds; sitting height settles over 0.6 seconds. Work starts and interruptions reverse the same route without jumping directly through furniture. Resting spots have small ground markers.

When a visible session leaves, its character walks out and fades. Its seat admits the latest replacement only after departure, so the scene never mounts more than eight rigs. Rapid changes replace the pending arrival; hidden/departing residents are no longer selectable. Their cosmetic exit does not indicate task completion. Returning to a session before departure finishes cancels its exit.

Completion celebrations last about 1.8 seconds once the character reaches rest, require evidence less than 30 seconds old, and are not restarted by repeated snapshots. Unknown status and restored stale telemetry never trigger them. Demo behavior is explicitly simulated. Ambient gestures do not imply tool actions or task progress.

Reduced motion places characters immediately, uses still destination poses, and disables orbit; it skips walking, fades, and celebrations. Simulation pause and bridge loss freeze ordinary movement and animation. Cosmetic departures may finish while updates are paused so hidden sessions do not remain indefinitely. A snapshot loaded while paused is shown at its destination instead of invisible at an entry point.

Cloned materials and skeleton resources are disposed at unmount; shared model geometry is preserved. Per-frame movement uses mutable scene objects rather than React state updates. Frame deltas are bounded to prevent a long background-tab gap from jumping a character across its route.

Before replacing the rig, check scale, forward axis, floor origin, unique sanitized bone names, required clips, material names, and license. The authoring code currently expects `UpperArmL/R`, `LowerArmL/R`, `Palm1L/R`, `Head`, plus `Sitting`, `Walking`, `Idle`, and `ThumbsUp`. Run the asset contract test for any replacement. Preserve attribution in [the model license file](../public/models/LICENSE.md).

## Labels and interaction

Resident labels are DOM buttons positioned each frame by projecting a 3D anchor into the viewport. Text is assigned with `textContent`. Labels are hidden when outside the view and can be toggled in settings; selection can keep a label visible. Both world selection and the ordinary resident list update the same store.

The list and inspector provide a text-based way to inspect activity without interpreting character gestures. Clicking empty canvas space clears selection. The application wraps world loading with Suspense and an error boundary.

## Cameras and lighting

The orthographic camera has overview, café, garden, and studio presets. Preset zoom is calculated from viewport dimensions. OrbitControls support manual orbit/zoom with constrained polar angles. Manual control cancels an active preset movement, following, and cinematic rotation.

Preset transitions interpolate in the render loop; reduced motion makes them immediate. Cinematic mode slowly rotates the view. Day/evening settings change lighting and fog colors and enable lamp lighting. The main directional light uses a 2048 shadow map at high quality and 512 at low quality.

## Follow and watch modes

Select a resident occupying a seat and choose **Follow resident**. The camera follows the actual moving character, including its walk to rest. Dragging or choosing a preset stops following. A session leaving the visible eight releases the follow camera. **Stop following** returns to the selected preset.

The eye button in the header enters **Watch mode**: the world fills the viewport, panels are hidden, and only the selected resident retains its label. A compact overlay keeps simulation/live connection context, attention access, and an exit button visible. Watching does not automatically start camera orbit or follow an agent. It respects the existing camera choice. Escape exits watch mode; outside watch mode it stops following, then clears selection. Dialogs retain their own Escape handling.

Watch and follow choices are temporary. Reduced motion makes camera placement immediate, and low quality lowers resolution/shadow cost. No frame-rate claim is made without device profiling.

## Performance and assets

Low quality uses device pixel ratio 1; high quality uses a range of 1–1.6. The canvas uses antialiasing, shadows, and a high-performance context preference. The world is lazy-loaded, and Vite groups Three.js, React Three Fiber, and Drei in a dedicated chunk.

The 3D dependency chunk currently exceeds Vite's default 500 kB warning threshold. This is a known bundle-size issue, not evidence of a broken build. There is no established device performance budget or measured frame-rate guarantee yet. Profile representative devices before increasing geometry, lights, effects, or resident count.

The robot is a CC0 asset credited to Tomás Laulhé (Quaternius), with changes credited in its license file. Interface icons use Lucide. Fonts are loaded from Google Fonts, so the current app is not completely self-contained for offline use.
