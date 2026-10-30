# Rendering performance

> The frame-time and scene-counter measurements below describe historical Earth-world builds. They are not performance measurements of the Mars colony. Re-profile the current production build before treating them as a budget. Current rendering architecture is documented in [World layout](world-layout.md).

The colony ships a shared hardware kit GLB of about 7.4 MB (geometry only; its surface textures are the shared PNGs under `public/textures/habitat`), a 1.3 MB resident, and a separate reference habitat of about 6.8 MiB. The 10 MiB hardware test cap and per-module mesh limits are export guardrails, not benchmarks of network loading, GPU memory, or frame time. Material texture sampling and authored detail add rendering work; shared cached geometry/materials and per-material export merging limit duplication. No controlled performance benchmark was run for this rollout. See [World asset upgrade](world-asset-upgrade.md) for implementation and review scope.

Append `?renderStats=1` to the local app URL, for example `http://127.0.0.1:5173/?renderStats=1`. A small overlay reports average interval FPS, the 95th-percentile frame interval, renderer draw calls and triangles, allocated geometry/texture counts, and the current number of full-detail terrain tiles. Remove the query parameter and reload to disable it. Nothing is transmitted or persisted.

## Phase 5 measurements (October 30, 2026)

Embedded development browser inside the Claude desktop app, 1024 × 768 viewport, eight simulated residents, daylight, 120 Hz display. These are settled single samples after the camera arrived, taken after the overlay was fixed to count every pass (see below). The display caps readings at 120 fps.

| Preset               | Quality | fps | p95 ms | draws | triangles |
| -------------------- | ------- | --- | ------ | ----- | --------- |
| Overview             | high    | 66  | 17.5   | 1,973 | 1.94 M    |
| Overview             | low     | 120 | 9.6    | 1,422 | 1.47 M    |
| Northstar Spaceport  | high    | 120 | 10.3   | 655   | 0.83 M    |
| Northstar Spaceport  | low     | 120 | 9.5    | 431   | 0.78 M    |
| Survey Lookout       | high    | 120 | 9.7    | 783   | 0.89 M    |
| Expedition Base      | high    | 118 | 10.3   | 653   | 0.78 M    |
| Deep Sky Array       | high    | 120 | 9.6    | 1,088 | 1.25 M    |
| Basalt Field Station | high    | 120 | 10.2   | 639   | 0.74 M    |
| Southwind Crater     | high    | 120 | 9.1    | 650   | 0.73 M    |
| Dawnlight Biolab     | high    | 88  | 12.3   | 1,873 | 1.84 M    |
| Helios Power Field   | high    | 120 | 10.3   | 719   | 0.93 M    |
| Amber Bluff          | high    | 120 | 9.8    | 585   | 0.64 M    |
| Horizon              | high    | 65  | 21.9   | 2,089 | 2.17 M    |

The Overview, Dawnlight and Horizon carry the colony: eight skinned residents at eleven draws each, four enclosed modules drawn as instanced tile groups per side, and the desks. The Overview's p95 sits just above one 60 Hz frame and the Horizon, which also mounts every landmark it can see, sits at 22 ms; everything else has headroom. Changes in this phase that moved the numbers: the high-quality shadow map is 2048 pixels (was 4096), the kit no longer carries embedded textures (one shared set instead of two), and horizon shots mount detail within 150 m of the focus rather than every landmark. The dust field is one draw; each dust devil is one draw while present.

**Overlay fix.** Before this phase the overlay read the renderer counters after the post-processing composer's final pass, so with post-processing on it reported one draw and one triangle. It now accumulates across the frame and resets once per frame, so draws and triangles include the shadow pass, the ambient-occlusion pass and the composer.

## What the numbers mean

The overlay updates once per second from up to 120 frame intervals. It excludes nonpositive intervals, intervals above 250 ms, and hidden-document samples. It therefore does **not** report long stalls or loading performance. FPS is the reciprocal of mean frame interval; p95 shows the slower end of that sample window. These are browser frame intervals, not GPU execution timings. Draw and triangle counters are the renderer's most recent reported render; they are not a complete GPU-cost accounting of all passes. Geometry and texture values count resources, not bytes.

Camera framing, resident motion, quality, display refresh rate, development tools, browser scheduling, thermal conditions, and other applications all influence results. Do not treat a single reading as a benchmark or a cross-device guarantee. Wait for a camera transition and detail mounting to settle before comparing readings.

## Initial local observations

September 28, 2026; development server, Codex in-app browser, 1280 × 720 viewport, eight simulated residents. These are individual settled-view samples from the ambient-life milestone, before resident accessories and cross-zone journeys, not a controlled before/after benchmark. Re-measure the current scene rather than treating these as its performance target. The low-quality reading also enabled reduced motion, so the FPS difference cannot be attributed to quality alone.

| View / settings                    | FPS | p95 interval | Draw calls | Triangles |
| ---------------------------------- | --: | -----------: | ---------: | --------: |
| Overview, daylight, high           |  93 |      11.7 ms |        739 |   180,076 |
| Café, evening, high                |  85 |      12.7 ms |        705 |   150,083 |
| Café, evening, low, reduced motion |  99 |      11.0 ms |        490 |   133,095 |

The hundreds of draw calls indicate that repeated base scenery is a useful future optimization target. The new leaves share one instanced draw; ripple rings add three small meshes, and five evening halos use small sprites. Tree sway adds transforms but no geometry. There is no added full-screen post-processing pass, shadow-casting light, or external texture download.

## Expanded-world spot check

October 2, 2026; development server, Codex in-app browser, 1280 × 720 viewport, eight simulated residents, daylight, high quality. One settled Horizon sample after the meadow detail pass read **60 fps, p95 17.5 ms, 838 draw calls, 268,250 triangles, 705 geometries, and 42 textures**. The browser was display-limited to about 60 fps. Resident poses and statuses differed from earlier observations, so these figures are a current reference point, not a before/after performance claim. The new instanced meadow groups and oak add six scene drawables in high quality and five in low quality; renderer totals still depend heavily on visible residents and zone detail.

In a later 1280 × 720 development-browser spot check with the simulator paused, Horizon read about **847 draws, 268,250 triangles, 705 geometries, and 42 textures** before Orchard Commons and **870 draws, 278,284 triangles, 728 geometries, and 43 textures** after it. Both views stayed near the browser's 60 fps display limit, with p95 intervals around 17 ms. Orchard's own close view read **36 draws / 64,602 triangles** at high quality and **31 draws / 50,186 triangles** at low quality after settling. These are individual scene-counter observations, not controlled frame-time benchmarks; HMR, browser scheduling, and renderer visibility can change them. Recheck a production build and representative devices before setting a performance budget.

With the distant ridge and stone arch added, the same paused Horizon setup showed about **875 draws, 279,464 triangles, 733 geometries, and 43 textures** at 60 fps with p95 around 17.4 ms. Its settled Orchard view showed **38 draws and 65,746 triangles**. These snapshots suggest a modest scene-counter increase over the prior local reading; they do not establish a frame-time improvement or device-wide budget.

On October 3, after meadow detail expanded across camera-reachable cells, a paused Horizon spot check in the 1280 × 720 development browser showed about **912 draws, 284,626 triangles, 757 geometries, and 44 textures** in daylight/high quality (p95 9.3 ms on a 120 Hz display). Returning through Observatory and Orchard to Horizon yielded **918 draws, 285,518 triangles, 757 geometries, and 44 textures**. An evening/low-quality snapshot read **897 draws, 261,866 triangles, 747 geometries, and 44 textures**. Resident poses and both lighting and quality differed, so these are scene-counter and resource-stability observations, not controlled performance comparisons. Repeat with a production build before setting a budget.

## Spatial landmark mounting spot check

October 3; 1280 × 720 development browser, eight paused simulated residents. After spatial mounting was added for five authored scenic regions, settled daylight/high-quality views gave these individual readings. The renderer still frustum-culls offscreen meshes, so the intended gain is fewer resident scene resources near a landmark, not necessarily fewer draw calls in that close view.

| View                 | Draws | Triangles | Geometries | Textures |
| -------------------- | ----: | --------: | ---------: | -------: |
| Overview             |   843 |   263,108 |        692 |       41 |
| Horizon              |   929 |   283,588 |        787 |       45 |
| Dawnlight Glasshouse |    34 |    55,586 |        742 |       43 |
| Orchard Commons      |    40 |    61,230 |        750 |       43 |
| Cedar Observatory    |    52 |    61,026 |        773 |       44 |
| Southwind Mere       |    37 |    53,334 |        724 |       42 |

The first Dawnlight visit after a clean reload showed 702 geometries and 42 textures. A trip through Horizon warmed other shared resources; subsequent Horizon → Dawnlight cycles consistently returned to **787 → 742 geometries** and **45 → 43 textures**, without further growth across two cycles. These values are resource-count evidence, not measured GPU memory bytes or a guaranteed performance improvement. A separate evening/low-quality/reduced-motion sample at Southwind was 31 draws, 42,484 triangles, 716 geometries, and 42 textures; Horizon was 910 draws, 261,484 triangles, 780 geometries, and 45 textures. The ridge, trails, lake, and resident state remained present in both quality tiers.

## Windward Mill spot check

October 3; 1280 × 720 development browser, eight paused simulated residents, daylight/high quality. The settled Windward view showed **68 draws, 59,332 triangles, 795 geometries, and 44 textures** after the shared scene resources had warmed. Horizon showed **930 draws, 283,808 triangles, 820 geometries, and 45 textures**; a second Horizon → Windward cycle returned to the same 820 → 795 geometry and 45 → 44 texture counts. A separate evening/low-quality/reduced-motion look at Windward rendered without browser warnings. These are individual development-browser observations, not a device performance budget.

## Expanded terrain and Amber Bluff spot check

October 3; 1280 × 720 development browser, eight paused simulated residents, daylight/high quality. After the ground grew from 600 × 600 at 128 segments to 1,020 × 1,020 at 216 segments, a settled Horizon view showed about **925 draws, 353,608 triangles, 797 geometries, and 45 textures** (p95 9.1 ms on this 120 Hz display). The settled Amber Bluff view showed **30 draws, 123,634 triangles, 728 geometries, and 42 textures** after shared resources warmed. Evening/low-quality/reduced-motion Amber rendered at **29 draws and 123,394 triangles** with no browser warning. Ground geometry alone grows from 32,768 to 93,312 triangles, so these snapshots do not establish a cross-device frame-rate budget or a controlled before/after improvement.

## Wider travel-area spot check

October 3; 1280 × 720 development browser, simulated residents. After camera travel expanded to X/Z ±210 and the outer scenery gained nearby spatial groups, an eastern scout view around X ≈ 175, Z ≈ 0 read **37 draws, 179,702 triangles, 760 geometries, and 42 textures** in daylight/high quality, with p95 frame intervals around 9.2 ms on a 120 Hz display. A separate evening/low-quality reading there was **25 draws, 152,326 triangles, 710 geometries, and 41 textures**. The camera framing, resident state, lighting, and quality differed; these are scene-resource spot checks, not a controlled comparison or device budget. Browser console warnings were absent in those views. The finite ground now uses 254 segments and 129,032 triangles, up from 93,312 for the previous 216-segment mesh.

## Terrain detail by camera area

October 13; production preview, 1280 × 720 in-app browser, eight paused simulated residents. A settled daylight/high-quality Horizon view after visiting the remote landmarks read **969 draws, 305,212 triangles, 849 geometries, 47 textures, and 29 full-detail terrain tiles**, with p95 intervals around 8.5 ms on a 120 Hz display. An earlier settled Northstar view read **64 draws, 73,328 triangles, and 25 full-detail tiles**. A separate evening/low-quality Southwind check rendered the lake and route without browser warnings. These are individual local observations; quality, framing, and warmed scenic resources differ between them.

Ground now renders in two merged covers. Full coarse coverage contains 16,256 triangles, while the original full-detail ground contains 129,032. With 29 interior tiles in full detail, ground uses 29,248 triangles. This is a geometry-count reduction, not a measured GPU-time or cross-device frame-rate guarantee. The diagnostic tile count makes selection and retirement visible during camera travel; CPU reference arrays stay cached while replaced GPU buffers are disposed.

## Repeatable review procedure

1. Use the same browser, viewport, display, camera preset, quality, and resident state. Prefer a production build with `npm run build` and `npm run preview` for formal profiling.
2. Let the scene settle, pause the simulator for a stable resident arrangement, and record multiple samples over at least 30 seconds. Environmental motion intentionally continues when the simulator is paused.
3. Compare high and low quality while holding Reduced motion constant. Then separately test reduced motion. Record daylight and evening, overview, Horizon, and café close-up. The wider landscape adds terrain geometry and instanced groves; compare its view separately from a close district view.
4. Check resize, camera travel, repeated detail mounting, and high/low switching. Resource counts should settle rather than grow indefinitely after repeated identical cycles.
5. Test representative integrated graphics and mobile devices before promising frame rates. Use browser performance tools for long tasks, GPU timings, memory bytes, and loading analysis; the overlay cannot replace them.

Prefer instancing/shared geometry for repeated scenery before increasing particle or resident counts. Keep visual effects independent of bridge ingestion and session state. Existing detail layers, capped DPR, reduced shadow resolution, and motion controls remain the available quality controls. The large Three.js dependency chunk remains a separate loading-cost issue.
