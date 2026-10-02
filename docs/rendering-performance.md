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

## Repeatable review procedure

1. Use the same browser, viewport, display, camera preset, quality, and resident state. Prefer a production build with `npm run build` and `npm run preview` for formal profiling.
2. Let the scene settle, pause the simulator for a stable resident arrangement, and record multiple samples over at least 30 seconds. Environmental motion intentionally continues when the simulator is paused.
3. Compare high and low quality while holding Reduced motion constant. Then separately test reduced motion. Record daylight and evening, overview, Horizon, and café close-up. The wider landscape adds terrain geometry and instanced groves; compare its view separately from a close district view.
4. Check resize, camera travel, repeated detail mounting, and high/low switching. Resource counts should settle rather than grow indefinitely after repeated identical cycles.
5. Test representative integrated graphics and mobile devices before promising frame rates. Use browser performance tools for long tasks, GPU timings, memory bytes, and loading analysis; the overlay cannot replace them.

Prefer instancing/shared geometry for repeated scenery before increasing particle or resident counts. Keep visual effects independent of bridge ingestion and session state. Existing detail layers, capped DPR, reduced shadow resolution, and motion controls remain the available quality controls. The large Three.js dependency chunk remains a separate loading-cost issue.
