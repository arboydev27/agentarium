import { bakeTerrainLayer, type TerrainLayer } from './terrainBake';

// Bakes one layer off the main thread; buffers are transferred back, not copied.
self.onmessage = (event: MessageEvent<{ layer: TerrainLayer; size: number }>) => {
  const { layer, size } = event.data;
  const baked = bakeTerrainLayer(layer, size);
  (self as unknown as Worker).postMessage({ layer, ...baked }, [
    baked.color.buffer,
    baked.normal.buffer,
    baked.roughness.buffer,
  ]);
};
