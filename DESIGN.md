---
name: 'Agentarium'
description: 'A living alien colony on a Mars-like world, with truthful task context.'
colors:
  regolith: '#b96743'
  sand: '#dda477'
  ridge: '#814d45'
  basalt: '#77433c'
  ironstone: '#935f52'
  ochre: '#e0a46c'
  dust-horizon: '#d9a184'
  habitat-shell: '#e4d4bd'
  machinery-frame: '#393d47'
  machinery-panel: '#667382'
  signal-cyan: '#8de3df'
  navigation-paper: '#fbf0e1'
  navigation-ink: '#514238'
  body-ink: '#443a3b'
  panel-paper: '#fafbf3ec'
  field-paper: '#fffefa'
  field-ink: '#53694a'
  field-border: '#dce3d0'
  action-green: '#365d43'
  action-ink: '#f4f9e9'
  secondary-paper: '#ebf0e1'
  secondary-ink: '#80916c'
  focus-cyan: '#5b9eac'
  status-working-paper: '#e5eddb'
  status-working-ink: '#6b8756'
typography:
  brand:
    fontFamily: 'Manrope, sans-serif'
    fontSize: '23px'
    fontWeight: 800
    letterSpacing: '-1px'
  title:
    fontFamily: 'DM Sans, sans-serif'
    fontSize: '14px'
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: '0'
  body:
    fontFamily: 'DM Sans, sans-serif'
    fontSize: '16px'
    fontWeight: 400
  control:
    fontFamily: 'DM Sans, sans-serif'
    fontSize: '13px'
    fontWeight: 400
  label:
    fontFamily: 'DM Sans, sans-serif'
    fontSize: '11px'
    fontWeight: 400
  dialog-heading:
    fontFamily: 'Georgia, serif'
    fontSize: '28px'
    fontWeight: 400
    letterSpacing: '-0.6px'
rounded:
  tag: '5px'
  control: '8px'
  button: '9px'
  row: '10px'
  navigation: '12px'
  hud: '14px'
  panel: '18px'
  dialog: '22px'
spacing:
  tight: '4px'
  inline: '8px'
  compact: '12px'
  panel: '16px'
  roomy: '24px'
components:
  button-primary:
    backgroundColor: '{colors.action-green}'
    textColor: '{colors.action-ink}'
    rounded: '{rounded.button}'
    padding: '11px 17px'
    typography: '{typography.control}'
  button-secondary:
    backgroundColor: '{colors.secondary-paper}'
    textColor: '{colors.secondary-ink}'
    rounded: '{rounded.button}'
    padding: '11px 17px'
    typography: '{typography.control}'
  field:
    backgroundColor: '{colors.field-paper}'
    textColor: '{colors.field-ink}'
    rounded: '{rounded.control}'
    padding: '10px 12px'
    typography: '{typography.control}'
  camera-navigation:
    backgroundColor: '{colors.navigation-paper}'
    textColor: '{colors.navigation-ink}'
    rounded: '{rounded.navigation}'
    padding: '5px'
  status-working:
    backgroundColor: '{colors.status-working-paper}'
    textColor: '{colors.status-working-ink}'
    rounded: '{rounded.tag}'
    padding: '4px 7px'
  resident-panel:
    backgroundColor: '{colors.panel-paper}'
    rounded: '{rounded.panel}'
    width: '292px'
---

# Design System: Agentarium

## Overview

**Creative North Star: "A Living Mars Colony"**

A warm, mineral world carries the experience: rust terrain, a dusty horizon, pale habitats, dark machinery, and restrained cyan equipment lights. Alien residents make the settlement feel inhabited while compact controls keep task context close. This is a stylized fictional planet, not a scientific Mars simulator.

The world stays visually dominant. Floating paper-like controls provide readable anchors above the scenery; existing sage task surfaces remain part of the implemented interface. Decorative life and factual task state have separate meanings. Expedition Base's approved Blender reference now establishes the material and authored-detail standard across the active world: colony hardware, scientific facilities, space vehicles, resident equipment, and terrain. This rollout extends the existing Mars colony identity while preserving the interface's tokens and layout.

**Key Characteristics:**

- Warm mineral landscape with pale engineered structures.
- Worn materials at a fixed world scale, grounded foundations, and authored equipment detail.
- Small cyan accents identify equipment and navigation beacons.
- World-first composition with compact floating controls.
- Task labels and attention remain grounded in real session state.

## Colors

Warm iron-rich terrain and dusty sand establish the world; pale shells and blue-gray machinery give the settlement a readable engineered silhouette. The frontmatter records source values before scene lighting.

### Primary

- **Regolith, sand, ridge, basalt, ironstone, and ochre:** terrain blending across the surface and geographic regions. Lighting supplies day/night adjustment.
- **Dust horizon:** warm application and loading background that belongs to the surrounding landscape.

### Secondary

- **Signal cyan:** narrow emissive equipment strips; a small amount carries the technical character.
- **Action green and sage status surfaces:** retained task controls, distinct from the terrain palette. These are current implementation colors, not a newly standardized semantic ramp.

### Neutral

- **Habitat shell:** pale pressure structures and canopy surfaces.
- **Machinery frame and panel:** dark supports, tanks, windows, and instrument housings.
- **Navigation paper and ink:** opaque camera controls, orbit hints, and watch controls. Their opacity protects contrast over varying terrain.
- **Panel paper, field paper, and body ink:** quiet factual interface surfaces and text.

**The Signal Accent Rule.** Keep cyan concentrated in equipment lights and small navigation cues; the mineral world supplies the dominant color.

## Typography

DM Sans is the interface voice; Manrope gives the brand its compact, sturdy shape. Georgia remains the dialog-heading face. Use the frontmatter roles as the measured baseline, rather than adding a new display treatment to the world HUD.

- **Brand:** heavy Manrope with tight tracking; reduces to 21px on narrower layouts.
- **Title:** compact semibold DM Sans for location identity.
- **Body:** the root baseline; most working UI is intentionally smaller.
- **Control:** action and field text. Desktop resident names use 14px; metadata and status tags increase to 12px above 800px.
- **Label:** camera and supporting interface text.
- **Dialog heading:** restrained serif contrast for modal titles.

## Layout

The scene fills the application at every scale, underneath floating controls. The final full-inset canvas rule takes precedence over older reserved-viewport rules. The application uses 100dvh, with an implemented minimum height of 640px, reduced to 580px at 800px and below.

On desktop, the header is 80px high; the resident panel starts at the upper right with a 292px baseline width. Location context sits at the upper left. Camera destinations occupy a horizontally scrollable lower strip.

At 1100px and below, the resident panel narrows and peripheral header content is hidden. At 800px and below, the header is 66px and floating controls compact. At 600px and below, location and resident entry points collapse into compact controls; expanded content remains scrollable. At 1600px and above, the resident panel grows to 315px. Short desktop viewports use denser placement. Preserve these content-specific breakpoints rather than forcing a uniform grid.

The spacing tokens are recurring measured increments, not an enforced global spacing algorithm. Keep world overlays compact and bounded; their contents must not expand indefinitely over the scene.

## Elevation & Depth

Three-dimensional geometry, terrain relief, lighting, and atmospheric distance carry the primary depth. UI panels use a restrained hybrid of pale tonal surfaces, thin light borders, translucent backgrounds, blur, and soft shadows. Camera navigation and orbit hints specifically use opaque paper after the contrast correction.

Panel shadows are broad and low-opacity; modal shadows are stronger to separate a focused task. Exact shadows, blur, and motion live in the sidecar because they are outside the frontmatter schema.

### World materials and scene lighting

Five original textured material families carry the world: worn ceramic paint, dusty alloy, cast foundation concrete, eroded ironstone, and regolith. Fine scratches and chips vary painted shells and alloy; pores and grain break up foundations and rocks; subtle ripples distinguish deposited dust. These materials supplement the existing palette; their texture samples are not new flat UI color tokens. Blue reflective glazing, oxidized safety enamel, dark rubber seals, and narrow cyan equipment lights complete the authored hardware.

`assets/blender/build_habitat.py` writes 512 × 512 color, roughness, and tangent-space normal maps. Color uses sRGB and data maps use non-color space. Authored GLB hardware uses these PBR maps. Terrain uses regolith grain, normal, and roughness with continuous world-space coordinates at three metres per tile across both detail levels. `src/world/WorldSurfaceMaterial.tsx` projects grain and roughness across procedural cliffs, crater surfaces, paths, and decks; its grain-derived micro-normal avoids depending on mesh UVs. Concrete uses finer grain and 1.8-metre joints. Resident body parts and accessories use local-space ceramic detail so the finish stays attached during animation; optical surfaces stay smooth.

The Expedition Base terrain patch follows rendered terrain height and blends at its edge. Terrain-supported aprons, foundations, footings, dust, and wheel tracks give the wider kit ground contact while resident routes and arrival areas remain clear. Eroded ridges, continuous irregular strata, and talus give Amber Bluff its geological silhouette. Keep that authored form legible at both close and destination views.

**The Physical Scale Rule.** Keep material grain at a stable world scale; camera zoom must not resize it. Use local coordinates for moving resident parts.

**The Ground Contact Rule.** Support pads and equipment on rendered terrain and preserve route clearance and arrival sightlines when changing geometry or placement.

`src/World.tsx` supplies a warm daylight key with reduced ambient fill so bevels and contact shadows remain visible, plus a cool secondary light. The shadow-casting sun follows the orbit target, carrying shadow coverage to remote districts. A locally generated RoomEnvironment PMREM at intensity 0.28 supplies reflections without an external HDR image. Evening retains cooler lighting; shadow maps use 512 × 512 at low quality and 2048 × 2048 otherwise. These are current scene settings, not a photorealism promise. See `docs/world-asset-upgrade.md` for coverage and review evidence, and `docs/blender-habitat.md` for the editable source/export contract.

## Shapes

Pale habitats use rounded pressure hulls, framed windows, canopies, and cylindrical service equipment. Ribs, gaskets, panel seams, fasteners, cable runs, and trussed supports describe their construction. Mineral formations use uneven ridges, eroded strata, broken edges, and scattered talus. Paths and narrow light strips connect a readable settlement. Keep physical structures clear of navigation routes and arrival areas.

Controls have gently rounded corners: small tags, comfortable buttons, larger floating panels, and the largest dialog corners. Circular status dots and avatars supplement labels. Do not transfer terrain irregularity into the shape of factual task controls.

## Components

### Buttons

Primary and secondary actions share compact padding, moderate rounding, and DM Sans. Their color assignments are captured in the frontmatter. All buttons use the shared visible cyan focus outline (3px, offset 3px); disabled buttons reduce opacity to 0.4 and show a not-allowed cursor. The base primary/secondary variants have no additional authored hover treatment; do not document one as already implemented.

### Inputs / Fields

Fields use a near-white fill, a fine sage border, compact padding, and rounded corners. They inherit the shared focus outline. Label text sits above the field. Validation copy must describe actual input or connection errors.

### Navigation

Camera navigation uses opaque warm paper and dark brown labels, with a soft sage hover and active fill. Its destination strip scrolls horizontally. Scene animation must not change the meaning of task state.

### Chips

Task tags are small rounded text labels. Working/tool, waiting, failed, disconnected, and completed have distinct source styles. Preserve their existing state mapping and accompanying text; the sidecar renders the working variant as a representative sample.

### Cards / Containers

The resident panel is a floating, clipped, scrollable container with a pale translucent surface, light border, soft shadow, and backdrop blur (16px). Resident rows have a subtle hover fill and a bordered selected state. Narrow-screen collapse retains entry points for task information.

### Authored world assets

Expedition Base retains its separate reference habitat: external ribs, framed glazing, an airlock and keypad, steps and handrails, radiators, service vents, coolant lines, tanks, crates, and fasteners. Its finish now extends through the shared world kit. `src/world/scenery/WorldKit.tsx` selects fifteen named modules from one cached GLB: pressure habitats, solar racks, sensor masts, service walls, resource tanks, a survey rover and rocket, launch gantry, control cabin, communications dish, workstations, telescope, orbital relay, survey console, and sample cabinet.

The editable Blender source retains separate named parts; runtime export joins meshes by material within each module. Reuse these modules for established equipment families and keep local titles in runtime labels. Existing lazy scenery boundaries and simplified fallback silhouettes preserve loading behavior. Runtime clones share loader-owned geometry and materials. Preserve each module's placement envelope, terrain contact, resident route clearance, and arrival sightlines when extending the kit.

### Living colony

The surface combines authored habitats and destinations with continuous mineral terrain; there is one scale, and the Mars identity comes from the sky, horizon, and far landforms. Residents, the rocket cycle, survey gestures, and machinery provide decorative life. They must never substitute for factual status labels, task briefs, attention, or source-session actions.

## Do's and Don'ts

### Do:

- Do keep terrain, habitat silhouettes, and residents readable behind the controls.
- Do preserve opaque paper behind camera navigation and its dark brown labels.
- Do use text and state semantics alongside status color.
- Do preserve route clearance and arriving-resident sightlines when extending structures.
- Do maintain fixed material scale and terrain contact across authored and procedural assets.
- Do reuse the shared hardware modules and keep editable Blender parts separate from export optimization.
- Do honor reduced motion for camera travel and the ambient rocket cycle.

### Don't:

- Don't let decorative journeys, equipment, or flight cycles imply provider activity.
- Don't replace unknown task state with invented progress or completion.
- Don't spread emissive cyan across large terrain or interface surfaces.
- Don't turn the fictional planet into a claim of scientific Mars accuracy.
