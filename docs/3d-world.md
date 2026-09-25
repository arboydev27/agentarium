# The 3D world

The scene is implemented in [World.tsx](../src/World.tsx). It combines procedural scenery with an animated GLB character. It is an eight-seat presentation of agent state, not a physical simulation or navigation system.

## Scene composition

The environment contains a café, garden/pergola, studio, courtyard, desks, laptops, plants, trees, lamps, and signage. Reusable box, cylinder, and sphere helpers construct most scenery. Sign text is drawn into canvas textures. The environment component is memoized to reduce unnecessary React work.

Eight fixed seat positions define placement. Each resident's assigned seat also determines its desk; status drives the laptop lid. Working, tool, and waiting residents have open laptops. Parent-child relationships are drawn as decorative raised lines when both agents are visible.

Changing world capacity requires coordinated changes to seat coordinates, desk placement, zone/color assignment, and the visible-resident filter. Increasing the server's 256-agent cap alone does not add visual seats.

## Character model and animation

The bundled [robot.glb](../public/models/robot.glb) is loaded with `useGLTF` and preloaded by the world module. Each resident uses a skeleton-aware clone so its animation mixer can run independently. Materials are cloned and recolored per resident; geometry is shared. Cloned materials are disposed when the resident unmounts.

| State                  | Clip / behavior                                                            |
| ---------------------- | -------------------------------------------------------------------------- |
| Working, tool, waiting | `Sitting`; working/tool also receive a small procedural lower-arm movement |
| Completed              | `Dance`                                                                    |
| Failed                 | `No`                                                                       |
| Idle, disconnected     | `Idle`                                                                     |

Transitions fade over approximately 0.35 seconds. Sitting is clamped after a single playback. Characters shift a short distance between seated and standing positions; this is not walking or pathfinding. Procedural arm adjustments depend on the current rig's bone names.

Reduced motion freezes character animation, uses a stable seated pose where appropriate, accelerates laptop-lid settling, and disables cinematic orbit. Simulation pause stops ordinary character animation. These controls do not turn the entire renderer into an on-demand static scene.

Before replacing the model, check its scale, origin, bone names, clip names, material names, seating alignment, and license. Preserve attribution in [the model license file](../public/models/LICENSE.md).

## Labels and interaction

Resident labels are DOM buttons positioned each frame by projecting a 3D anchor into the viewport. Text is assigned with `textContent`. Labels are hidden when outside the view and can be toggled in settings; selection can keep a label visible. Both world selection and the ordinary resident list update the same store.

The list and inspector provide a text-based way to inspect activity without interpreting character gestures. Clicking empty canvas space clears selection. The application wraps world loading with Suspense and an error boundary.

## Cameras and lighting

The orthographic camera has overview, café, garden, and studio presets. Preset zoom is calculated from viewport dimensions. OrbitControls support manual orbit/zoom with constrained polar angles. Manual control cancels an active preset movement and cinematic rotation.

Preset transitions interpolate in the render loop; reduced motion makes them immediate. Cinematic mode slowly rotates the view. Day/evening settings change lighting and fog colors and enable lamp lighting. The main directional light uses a 2048 shadow map.

## Performance and assets

Low quality uses device pixel ratio 1; high quality uses a range of 1–1.6. The canvas uses antialiasing, shadows, and a high-performance context preference. The world is lazy-loaded, and Vite groups Three.js, React Three Fiber, and Drei in a dedicated chunk.

The 3D dependency chunk currently exceeds Vite's default 500 kB warning threshold. This is a known bundle-size issue, not evidence of a broken build. There is no established device performance budget or measured frame-rate guarantee yet. Profile representative devices before increasing geometry, lights, effects, or resident count.

The robot is a CC0 asset credited to Tomás Laulhé (Quaternius), with changes credited in its license file. Interface icons use Lucide. Fonts are loaded from Google Fonts, so the current app is not completely self-contained for offline use.
