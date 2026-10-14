import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { TERRAIN_TILES } from './terrainTileGeometry';
import { visibleTerrainTileIds } from './terrainTileVisibility';

describe('visible terrain coverage', () => {
  it('includes lateral ground visible beyond a circular camera radius', () => {
    const camera = new THREE.OrthographicCamera(-300, 300, 100, -100, 0.1, 360);
    camera.position.set(0, 80, 0);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    const selected = new Set(visibleTerrainTileIds(camera));
    const lateral = TERRAIN_TILES.find(
      (tile) => tile.minX < 270 && tile.maxX > 270 && tile.minZ <= 0 && tile.maxZ >= 0,
    )!;
    expect(selected.has(lateral.id)).toBe(true);
    expect(Math.min(Math.abs(lateral.minX), Math.abs(lateral.maxX))).toBeGreaterThan(165);
  });

  it('keeps the perspective view bounded by the same fog depth as rendering', () => {
    const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 420);
    camera.position.set(0, 12, 35);
    camera.lookAt(0, 2, -22);
    const selected = new Set(visibleTerrainTileIds(camera));
    expect(selected.size).toBeGreaterThan(0);
    const far = TERRAIN_TILES.filter((tile) => tile.maxZ < -220);
    expect(far.every((tile) => !selected.has(tile.id))).toBe(true);
    expect(new Set(visibleTerrainTileIds(camera))).toEqual(selected);
  });

  it('scouts remote terrain without retaining the original ground footprint', () => {
    const camera = new THREE.OrthographicCamera(-20, 20, 16, -16, 0.1, 360);
    camera.position.set(230, 30, 230);
    camera.lookAt(210, 0, 210);
    const selected = new Set(visibleTerrainTileIds(camera));
    const destination = TERRAIN_TILES.find(
      (tile) => tile.minX <= 210 && tile.maxX >= 210 && tile.minZ <= 210 && tile.maxZ >= 210,
    )!;
    expect(selected.has(destination.id)).toBe(true);
    expect(
      TERRAIN_TILES.filter((tile) => tile.maxX < -100 && tile.maxZ < -100).every(
        (tile) => !selected.has(tile.id),
      ),
    ).toBe(true);
  });

  it('prefetches the translated camera footprint without changing the active camera', () => {
    const camera = new THREE.OrthographicCamera(-192, 192, 108, -108, 0.1, 360);
    camera.position.set(27, 26, 35);
    camera.lookAt(0, 2.8, 0);
    camera.updateProjectionMatrix();
    const original = camera.position.clone();
    const translated = camera.clone();
    translated.position.add(new THREE.Vector3(380, 0, 380));
    translated.updateMatrixWorld();
    expect(visibleTerrainTileIds(camera, { x: 380, y: 0, z: 380 })).toEqual(
      visibleTerrainTileIds(translated),
    );
    expect(camera.position.equals(original)).toBe(true);
  });
});
