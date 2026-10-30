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
  hud-ink: '#f3e7dc'
  hud-ink-dim: '#c7b4a5'
  hud-ink-mute: '#937f73'
  hud-glass: 'rgba(22, 13, 12, 0.6)'
  hud-glass-strong: 'rgba(22, 13, 12, 0.86)'
  hud-solid: '#1d1413'
  hud-line: 'rgba(243, 231, 220, 0.14)'
  hud-line-strong: 'rgba(243, 231, 220, 0.3)'
  attention-amber: '#ecb45c'
  attention-glass: 'rgba(64, 38, 10, 0.8)'
  status-green: '#a9d89b'
  status-red: '#ec8d7c'
typography:
  wordmark:
    fontFamily: 'Manrope, sans-serif'
    fontSize: '10px'
    fontWeight: 800
    letterSpacing: '0.32em'
    textTransform: uppercase
  place:
    fontFamily: 'Manrope, sans-serif'
    fontSize: '22px'
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: '-0.01em'
  label:
    fontFamily: 'Manrope, sans-serif'
    fontSize: '10px'
    fontWeight: 750
    letterSpacing: '0.14em'
    textTransform: uppercase
  body:
    fontFamily: 'DM Sans, sans-serif'
    fontSize: '12px'
    fontWeight: 400
    lineHeight: 1.5
  readout:
    fontFamily: 'ui-monospace, SF Mono, Menlo, monospace'
    fontSize: '11px'
    fontWeight: 600
  dialog-heading:
    fontFamily: 'Manrope, sans-serif'
    fontSize: '18px'
    fontWeight: 800
    letterSpacing: '0.02em'
rounded:
  tag: '4px'
  control: '4px'
  button: '4px'
  row: '4px'
  hud: '6px'
  pane: '6px'
  dialog: '8px'
spacing:
  tight: '4px'
  inline: '8px'
  compact: '12px'
  panel: '16px'
  roomy: '24px'
components:
  hud-overlay:
    backgroundColor: '{colors.hud-glass}'
    borderColor: '{colors.hud-line}'
    rounded: '{rounded.hud}'
    backdropBlur: '10px'
  hud-pane:
    backgroundColor: '{colors.hud-glass-strong}'
    borderColor: '{colors.hud-line}'
    rounded: '{rounded.pane}'
    width: '360px'
    backdropBlur: '16px'
  attention-banner:
    backgroundColor: '{colors.attention-glass}'
    borderColor: '{colors.attention-amber}'
    textColor: '{colors.attention-amber}'
    rounded: '{rounded.hud}'
    typography: '{typography.label}'
  hotbar-slot:
    width: '56px'
    activeColor: '{colors.signal-cyan}'
    typography: '{typography.label}'
  button-primary:
    backgroundColor: '{colors.regolith}'
    textColor: '#fff3e8'
    rounded: '{rounded.button}'
    typography: '{typography.label}'
  button-secondary:
    borderColor: '{colors.hud-line-strong}'
    textColor: '{colors.hud-ink}'
    rounded: '{rounded.button}'
    typography: '{typography.label}'
  field:
    backgroundColor: 'rgba(0, 0, 0, 0.3)'
    borderColor: '{colors.hud-line-strong}'
    textColor: '{colors.hud-ink}'
    rounded: '{rounded.control}'
    padding: '8px 10px'
    typography: '{typography.body}'
  status-tag:
    borderColor: '{colors.hud-line}'
    rounded: '999px'
    padding: '2px 9px 2px 2px'
---

# Design System: Agentarium

## Overview

**Creative North Star: "A Living Mars Colony"**

A warm, mineral world carries the experience: rust terrain, a dusty horizon, pale habitats, dark machinery, and restrained cyan equipment lights. Alien residents make the settlement feel inhabited while compact controls keep task context close. This is a stylized fictional planet, not a scientific Mars simulator.

The world stays visually dominant. The interface is a game HUD on dark glass: overlays anchored to the edges and corners, thin lines, cyan for state, amber only for attention. See `docs/interface.md`. Decorative life and factual task state have separate meanings. Expedition Base's approved Blender reference now establishes the material and authored-detail standard across the active world: colony hardware, scientific facilities, space vehicles, resident equipment, and terrain. This rollout extends the existing Mars colony identity while preserving the interface's tokens and layout.

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
- **HUD ink, glass, and lines:** light text on translucent dark glass with thin edge lines. The glass protects contrast over varying terrain without hiding it; evening tints it blue.
- **Attention amber:** the banner, roster edges, and status glyphs for reported waiting or failure. Nothing else uses it.
- **Status green and red:** completion and reported failure, always beside a text label.

**The Signal Accent Rule.** Keep cyan concentrated in equipment lights and small navigation cues; the mineral world supplies the dominant color.

## Typography

Manrope is the HUD display face: uppercase labels with wide tracking, the place name, the wordmark, and dialog headings. DM Sans is the reading face inside panes and dialogs. A system monospace stack renders counts, key hints, and timers. No network font beyond the two already loaded is used.

- **Brand:** heavy Manrope with tight tracking; reduces to 21px on narrower layouts.
- **Title:** compact semibold DM Sans for location identity.
- **Body:** the root baseline; most working UI is intentionally smaller.
- **Control:** action and field text. Desktop resident names use 14px; metadata and status tags increase to 12px above 800px.
- **Label:** camera and supporting interface text.
- **Dialog heading:** restrained serif contrast for modal titles.

## Layout

The world fills the viewport edge to edge at every size, with no application frame. Overlays are anchored to the screen edges: the place readout top left, the attention banner top centre, the system cluster top right with the roster strip beneath it, the map toggle bottom left, the viewpoint hotbar bottom centre, and the transport bottom right. A 360px pane slides in from the right edge for a resident, the full list, activity, or recap; while it is open the top and bottom overlays shift left to stay clear of it. The application uses 100dvh with a 480px minimum.

At 1700px and below the orbit hint is hidden; at 1500px the slow-orbit label becomes an icon; at 1240px the hotbar shows icons and key hints only; at 1000px the roster and pane narrow. At 600px and below the top row stacks (place chip and system cluster, then the attention banner on its own full-width row, then a roster chip), the hotbar scrolls, and the pane becomes a bottom sheet that hides the bottom overlays while open. Preserve these content-specific breakpoints rather than forcing a uniform grid.

After four seconds without input the non-essential overlays fade to 18% opacity and return on any input; the attention banner never fades, and nothing fades while a pane or dialog is open. Keep world overlays compact and bounded; their contents must not expand indefinitely over the scene.

## Elevation & Depth

Three-dimensional geometry, terrain relief, lighting, and atmospheric distance carry the primary depth. Overlays sit flat on dark glass with a one-pixel edge line and a 10px blur; the pane and the map use stronger glass with a 16px blur and a soft directional shadow; dialogs are solid. State is shown by colour and an inset line (the active hotbar slot, the selected row, the attention edge), not by elevation. Exact shadows, blur, and motion live in the sidecar because they are outside the frontmatter schema.

### World materials and scene lighting

Five original textured material families carry the world: worn ceramic paint, dusty alloy, cast foundation concrete, eroded ironstone, and regolith. Fine scratches and chips vary painted shells and alloy; pores and grain break up foundations and rocks; subtle ripples distinguish deposited dust. These materials supplement the existing palette; their texture samples are not new flat UI color tokens. Blue reflective glazing, oxidized safety enamel, dark rubber seals, and narrow cyan equipment lights complete the authored hardware.

`assets/blender/build_habitat.py` writes 512 × 512 color, roughness, and tangent-space normal maps. Color uses sRGB and data maps use non-color space. Authored GLB hardware uses these PBR maps. Terrain uses regolith grain, normal, and roughness with continuous world-space coordinates at three metres per tile across both detail levels. `src/world/WorldSurfaceMaterial.tsx` projects grain and roughness across procedural cliffs, crater surfaces, paths, and decks; its grain-derived micro-normal avoids depending on mesh UVs. Concrete uses finer grain and 1.8-metre joints. Resident body parts and accessories use local-space ceramic detail so the finish stays attached during animation; optical surfaces stay smooth.

The Expedition Base terrain patch follows rendered terrain height and blends at its edge. Terrain-supported aprons, foundations, footings, dust, and wheel tracks give the wider kit ground contact while resident routes and arrival areas remain clear. Eroded ridges, continuous irregular strata, and talus give Amber Bluff its geological silhouette. Keep that authored form legible at both close and destination views.

**The Physical Scale Rule.** Keep material grain at a stable world scale; camera zoom must not resize it. Use local coordinates for moving resident parts.

**The Ground Contact Rule.** Support pads and equipment on rendered terrain and preserve route clearance and arrival sightlines when changing geometry or placement.

`src/World.tsx` supplies a warm daylight key with reduced ambient fill so bevels and contact shadows remain visible, plus a cool secondary light. The shadow-casting sun follows the orbit target, carrying shadow coverage to remote districts. A locally generated RoomEnvironment PMREM at intensity 0.28 supplies reflections without an external HDR image. Evening retains cooler lighting; shadow maps use 512 × 512 at low quality and 2048 × 2048 otherwise. These are current scene settings, not a photorealism promise. See `docs/world-asset-upgrade.md` for coverage and review evidence, and `docs/blender-habitat.md` for the editable source/export contract.

## Shapes

Pale habitats use rounded pressure hulls, framed windows, canopies, and cylindrical service equipment. Ribs, gaskets, panel seams, fasteners, cable runs, and trussed supports describe their construction. Mineral formations use uneven ridges, eroded strata, broken edges, and scattered talus. Paths and narrow light strips connect a readable settlement. Keep physical structures clear of navigation routes and arrival areas.

Controls have small, consistent radii (4px controls and rows, 6px overlays and pane, 8px dialogs). Circular status glyphs and rounded portraits supplement labels. Do not transfer terrain irregularity into the shape of factual task controls.

## Components

### Buttons

Primary actions use regolith rust with light text; secondary actions use a line border on glass. Both use the uppercase Manrope label style, 4px corners, a 2px cyan focus outline, and 40% opacity when disabled. Icon buttons are 30px squares on glass with a line border.

### Inputs / Fields

Fields are dark (30% black) with a strong line border, light text, and 4px corners. Label text sits above the field. Validation copy must describe actual input or connection errors.

### Hotbar and transport

The hotbar is a row of 56px slots with an icon, a short uppercase label, and the number key in the corner; the active slot is cyan with an inset bottom line. The transport holds play/pause (cyan), the speed readout in monospace, reset, the rust New task button, and the slow-orbit toggle.

### Roster and status

Roster rows are portrait, name, provider glyph, and a circular status glyph: cyan breathing for working, amber filled for attention, green for completed, muted for a break, dashed for unknown. Rows with attention carry a 2px amber inset edge; the selected row is a cyan line on cyan-dim glass. Status tags in panes pair the same glyph with the factual `STATUS_LABEL` text.

### Attention banner

The banner is the one element that never dims, never hides, and survives watch mode: amber text and line on amber glass, uppercase, with a slow glow pulse that reduced motion disables.

### Pane

The right-edge pane has a header with the uppercase title, pane tabs, and a close button, then a scrolling body. On phones it is a bottom sheet. Nothing in it is a floating card; sections are separated by lines.

### Authored world assets

Expedition Base retains its separate reference habitat: external ribs, framed glazing, an airlock and keypad, steps and handrails, radiators, service vents, coolant lines, tanks, crates, and fasteners. Its finish now extends through the shared world kit. `src/world/scenery/WorldKit.tsx` selects fifteen named modules from one cached GLB: pressure habitats, solar racks, sensor masts, service walls, resource tanks, a survey rover and rocket, launch gantry, control cabin, communications dish, workstations, telescope, orbital relay, survey console, and sample cabinet.

The editable Blender source retains separate named parts; runtime export joins meshes by material within each module. Reuse these modules for established equipment families and keep local titles in runtime labels. Existing lazy scenery boundaries and simplified fallback silhouettes preserve loading behavior. Runtime clones share loader-owned geometry and materials. Preserve each module's placement envelope, terrain contact, resident route clearance, and arrival sightlines when extending the kit.

### Living colony

The surface combines authored habitats and destinations with continuous mineral terrain; there is one scale, and the Mars identity comes from the sky, horizon, and far landforms. Residents, the rocket cycle, survey gestures, and machinery provide decorative life. They must never substitute for factual status labels, task briefs, attention, or source-session actions.

## Do's and Don'ts

### Do:

- Do keep terrain, habitat silhouettes, and residents readable behind the controls.
- Do keep every overlay on dark glass with a thin line, anchored to an edge or corner.
- Do keep the attention banner visible in every state, including idle and watch mode.
- Do use text and state semantics alongside status color.
- Do preserve route clearance and arriving-resident sightlines when extending structures.
- Do maintain fixed material scale and terrain contact across authored and procedural assets.
- Do reuse the shared hardware modules and keep editable Blender parts separate from export optimization.
- Do honor reduced motion for camera travel and the ambient rocket cycle.

### Don't:

- Don't let decorative journeys, equipment, or flight cycles imply provider activity.
- Don't replace unknown task state with invented progress or completion.
- Don't spread emissive cyan across large terrain or interface surfaces; cyan marks state, amber marks attention, nothing else.
- Don't add white cards, drop shadows, or an application header over the world.
- Don't turn the fictional planet into a claim of scientific Mars accuracy.
