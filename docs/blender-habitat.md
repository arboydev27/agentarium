# Blender reference habitat

**Expedition Base** is the approved material and asset reference area. Use the viewpoint selector to visit it. Its authored finish now extends across the active world through a separate fifteen-module shared hardware kit, textured procedural scenery, and resident equipment. This document describes the reference habitat; [World asset upgrade](world-asset-upgrade.md) records the completed wider rollout.

## Source and export

- `assets/blender/expedition-habitat.blend`: editable, named habitat and kit pieces, with packed textures.
- `assets/blender/build_habitat.py`: deterministic authoring and export script, created for this project.
- `public/models/habitat/expedition-habitat.glb`: browser-ready asset, approximately 6.8 MiB, nine material-group meshes.
- `public/models/habitat/manifest.json`: coordinate convention, material names, source and generator paths.
- `public/textures/habitat/`: original procedural color, roughness, and normal maps. No third-party texture licenses or runtime CDN are involved.

The kit contains the pressure hull, external ribs, airlock, access keypad, glazing, steps, handrails, radiator panels, service vents, coolant lines, oxygen tanks, equipment crates, fasteners, foundations, eroded rocks, and wind-deposited dust. The Blender file retains 131 separate authoring objects. Export copies are joined by material to reduce draw calls; joining does not flatten the source file.

Built with **Blender 4.5.8 LTS** and regenerated with **Blender 5.2.2 LTS** (Homebrew cask `blender@lts`), Apple Silicon. Regenerate from the repository root with an installed Blender executable:

```sh
blender --background --factory-startup --python assets/blender/build_habitat.py
```

On macOS, the executable is commonly `/Applications/Blender.app/Contents/MacOS/Blender`. The development run used the official Blender disk image rather than installing an application globally.

Running the generator overwrites its generated `.blend`, `.glb`, manifest, and texture files. Save manual Blender changes separately or incorporate them into the script before regeneration. The shared generator `assets/blender/build_world_kit.py` runs this reference generator first, so rebuilding the world kit also overwrites these reference outputs. `assets/blender/world-kit.blend` and `public/models/world-kit/colony-hardware.glb` are separate shared-kit artifacts; see the [module pipeline](world-asset-upgrade.md#shared-hardware-pipeline). The shared kit also carries the twelve `hab-*` habitat tiles and props that enclose the colony decks (Phase 3 of the [visual rebuild plan](visual-rebuild-plan.md)). The runtime GLB remains usable without Blender. Removing an asset from the scene does not require deleting its source; deleting the GLB requires removing or replacing the React reference.

## Material and terrain contract

Five textured material families cover worn ceramic paint, dusty alloy, cast foundation concrete, eroded ironstone, and regolith. Color maps use sRGB; roughness and tangent-space normal data remain non-color. Blender's image color space is set **before** writing pixels, because changing it afterward can invalidate the generated buffer. Export checks reject blank color images.

Textures use 512 × 512 images with mipmaps. The ground repeats at three world metres per tile; camera zoom does not change that scale. The reference ground patch follows authoritative rendered terrain heights, fades across a three-metre boundary, and remains below route ribbons. Across the wider world, terrain uses the same regolith family; procedural paths, decks, cliffs and crater surfaces use `WorldSurfaceMaterial`, and terrain-supported pads use `TerrainApron`. Twin wheel tracks use one instanced mesh. Terrain-height supports close gaps under the structural footings. Procedural monoliths are excluded from the reference area's foreground.

The local asset's X/Z placement is shared by the detailed model, fallback silhouette, terrain patch, and route tests. Coordinates use metres, Blender Z-up and glTF Y-up. The airlock faces local +Z in the browser. Placement does not change the resident navigation graph or arrival destination.

## Lighting

The directional shadow camera now follows the orbit target so outlying districts receive shadows. Reduced ambient fill gives bevels and contact areas stronger definition. A locally generated PMREM environment supplies material reflections without a downloaded HDR image. Day/evening settings and quality-dependent shadow resolution remain available. The environment target is disposed when the scene unmounts.

## Loading and ownership

The asset loads only with Expedition Base's existing lazy scenic module. Its Suspense/error boundary retains a simplified silhouette while the model or textures load. The GLTF cache owns shared model geometry/materials; mounted clones use `dispose={null}` to avoid breaking a later revisit. The terrain patch owns and disposes its geometry and cloned repeating textures.

## Verification

`referenceHabitat.test.ts` validates the actual exported GLB: size and mesh limits, PBR texture bindings, nonblank decoded PNG pixels, and clearance from every resident route. Existing fallback bounds/sightline tests cover the updated distant silhouette. Run:

```sh
npx vitest run src
npm run build
npm run format:check
```

For visual review, visit Expedition Base, inspect close and wide views, switch evening/low quality, and return after visiting another district. Confirm that texture detail remains legible, support feet contact the terrain, doors and tracks read clearly, and session interactions still work. This reference demonstrates an authored asset pipeline; it does not claim photorealism or a device-independent frame-rate guarantee.

The reference milestone passed 224 frontend tests, the production build, and repository formatting. Its browser checks covered 1280 × 800, 808 × 987, and 390 × 844; daylight, evening, low rendering quality, reduced motion, and leaving/revisiting Expedition Base. The completed wider rollout subsequently passed 225 frontend tests across 39 files, 17 bridge tests, and a final production build. The final reviewer returned **ship** for the scoped asset findings. See [World asset upgrade](world-asset-upgrade.md#verification-and-review-scope) for final captures, formatting and browser-log scope. Vite still reports the existing large Three.js chunk warning; no frame-rate benchmark is claimed.
