# Rendering performance

Append `?renderStats=1` to the local app URL, for example `http://127.0.0.1:5173/?renderStats=1`. A small overlay reports average interval FPS, the 95th-percentile frame interval, renderer draw calls and triangles, and allocated geometry/texture counts. Remove the query parameter and reload to disable it. Nothing is transmitted or persisted.

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

## Repeatable review procedure

1. Use the same browser, viewport, display, camera preset, quality, and resident state. Prefer a production build with `npm run build` and `npm run preview` for formal profiling.
2. Let the scene settle, pause the simulator for a stable resident arrangement, and record multiple samples over at least 30 seconds. Environmental motion intentionally continues when the simulator is paused.
3. Compare high and low quality while holding Reduced motion constant. Then separately test reduced motion. Record daylight and evening, overview, Horizon, and café close-up. The wider landscape adds terrain geometry and instanced groves; compare its view separately from a close district view.
4. Check resize, camera travel, repeated detail mounting, and high/low switching. Resource counts should settle rather than grow indefinitely after repeated identical cycles.
5. Test representative integrated graphics and mobile devices before promising frame rates. Use browser performance tools for long tasks, GPU timings, memory bytes, and loading analysis; the overlay cannot replace them.

Prefer instancing/shared geometry for repeated scenery before increasing particle or resident counts. Keep visual effects independent of bridge ingestion and session state. Existing detail layers, capped DPR, reduced shadow resolution, and motion controls remain the available quality controls. The large Three.js dependency chunk remains a separate loading-cost issue.
