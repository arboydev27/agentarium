import { useSurfaceTextures } from './surfaceTextures';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../state';
import { CAMERA_VIEWS } from './layout';
import { presetCamera } from './perspective';
import {
  TERRAIN_TILES,
  mergeFineTerrainTiles,
  mergeCoarseTerrainTiles,
  type TerrainTile,
} from './terrainTileGeometry';
import { selectTerrainTiles } from './terrainTileSelection';
import { visibleTerrainTileIds } from './terrainTileVisibility';
import { renderedTerrainHeight } from './terrain';

type GroundPoint = Readonly<{ x: number; z: number }>;
type TerrainFrame = Readonly<{
  focus: GroundPoint;
  camera: GroundPoint;
  visibleIds: readonly string[];
}>;

const TerrainCover = memo(function TerrainCover({
  tiles,
  level,
  material,
}: {
  tiles: readonly TerrainTile[];
  level: 'fine' | 'coarse';
  material: THREE.Material;
}) {
  const geometry = useMemo(
    () => (level === 'fine' ? mergeFineTerrainTiles(tiles) : mergeCoarseTerrainTiles(tiles)),
    [tiles, level],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      name={`terrain-${level}-cover`}
      geometry={geometry}
      material={material}
      receiveShadow
      dispose={null}
    />
  );
});

// Tile lifetimes own render geometry only. The authoritative terrain samples,
// resident journeys, route reservations, and provider state stay elsewhere.
export function TerrainTiles() {
  const view = useWorld((state) => state.camera);
  const customized = useWorld((state) => state.cameraCustomized);
  const cameraJump = useWorld((state) => state.cameraJump);
  const cameraVersion = useWorld((state) => state.cameraVersion);
  const renderCamera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as unknown as {
    target?: THREE.Vector3;
  } | null;
  const size = useThree((state) => state.size);
  const preset = CAMERA_VIEWS[view];
  const [initialFrame] = useState<TerrainFrame>(() => ({
    focus: { x: preset.look[0], z: preset.look[2] },
    camera: { x: preset.pos[0], z: preset.pos[2] },
    visibleIds: visibleTerrainTileIds(renderCamera),
  }));
  const frame = useRef<TerrainFrame>(initialFrame);
  const [fine, setFine] = useState(() => selectTerrainTiles(initialFrame));
  const [completedJump, setCompletedJump] = useState<number | null>(null);
  const elapsed = useRef(0.2);
  const direction = useRef(new THREE.Vector3());
  const maps = useSurfaceTextures('regolith');
  const material = useMemo(() => {
    const result = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: maps[0],
      normalMap: maps[1],
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughnessMap: maps[2],
      roughness: 1,
      side: THREE.DoubleSide,
    });
    // Preserve biome colors: the source texture contributes grain, not a second red tint.
    result.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          vec4 grain = texture2D(map, vMapUv);
          float variation = clamp(grain.r * 1.6 + 0.48, 0.72, 1.22);
          diffuseColor.rgb *= variation;
        #endif`,
      );
    };
    result.customProgramCacheKey = () => 'regolith-biome-grain-v1';
    return result;
  }, [maps]);
  useEffect(() => () => material.dispose(), [material]);

  const destination: GroundPoint | undefined =
    customized && cameraJump && cameraJump.sequence !== completedJump
      ? { x: cameraJump.x, z: cameraJump.z }
      : !customized
        ? { x: preset.look[0], z: preset.look[2] }
        : undefined;
  const destinationCoverage = useMemo(() => {
    if (customized) {
      if (!cameraJump || cameraJump.sequence === completedJump) return [];
      const target = controls?.target;
      return visibleTerrainTileIds(renderCamera, {
        x: cameraJump.x - (target?.x ?? frame.current.focus.x),
        y: renderedTerrainHeight(cameraJump.x, cameraJump.z) + 1 - (target?.y ?? 1),
        z: cameraJump.z - (target?.z ?? frame.current.focus.z),
      });
    }
    return visibleTerrainTileIds(presetCamera(view, size.width / size.height));
  }, [
    view,
    cameraVersion,
    customized,
    cameraJump,
    completedJump,
    renderCamera,
    controls,
    size.width,
    size.height,
  ]);
  // Prefetch the requested destination in the render that starts camera travel.
  const prefetched = destination
    ? selectTerrainTiles(
        {
          ...frame.current,
          visibleIds: [...frame.current.visibleIds, ...destinationCoverage],
          prefetch: destination,
        },
        fine.map((tile) => tile.id),
      )
    : fine;
  const key = prefetched.map((tile) => tile.id).join('|');
  // Membership alone controls geometry lifetimes; sampling and order changes
  // cannot rebuild the merged cover while the same tiles remain selected.
  const active = useMemo(() => prefetched, [key]);
  const activeIds = useMemo(() => new Set(active.map((tile) => tile.id)), [active]);
  const coarse = useMemo(() => {
    const selected = new Set(active.map((tile) => tile.id));
    return TERRAIN_TILES.filter((tile) => !selected.has(tile.id));
  }, [active]);

  useFrame(({ camera, controls }, delta) => {
    elapsed.current += delta;
    const visibleIds = visibleTerrainTileIds(camera);
    if (elapsed.current < 0.2 && visibleIds.every((id) => activeIds.has(id))) return;
    elapsed.current = 0;
    const orbitTarget = (controls as unknown as { target?: THREE.Vector3 } | null)?.target;
    let focus: GroundPoint;
    if (orbitTarget) focus = { x: orbitTarget.x, z: orbitTarget.z };
    else {
      camera.getWorldDirection(direction.current);
      const descent = -direction.current.y;
      const distance = descent > 0.05 ? Math.max(0, (camera.position.y - 1) / descent) : 0;
      focus = {
        x: camera.position.x + direction.current.x * distance,
        z: camera.position.z + direction.current.z * distance,
      };
    }
    const previous = frame.current.focus;
    const dx = (focus.x - previous.x) * 3;
    const dz = (focus.z - previous.z) * 3;
    const scale = Math.min(1, 32 / Math.max(1, Math.hypot(dx, dz)));
    const lead = { x: focus.x + dx * scale, z: focus.z + dz * scale };
    frame.current = {
      focus,
      camera: { x: camera.position.x, z: camera.position.z },
      visibleIds,
    };
    if (
      cameraJump &&
      cameraJump.sequence !== completedJump &&
      Math.hypot(focus.x - cameraJump.x, focus.z - cameraJump.z) < 6
    )
      setCompletedJump(cameraJump.sequence);
    const next = selectTerrainTiles(
      {
        ...frame.current,
        visibleIds: [...visibleIds, ...destinationCoverage],
        prefetch: destination ?? lead,
      },
      active.map((tile) => tile.id),
    );
    setFine((current) =>
      current.length === next.length && current.every((tile, index) => tile.id === next[index].id)
        ? current
        : next,
    );
  });
  return (
    <group
      name="spatial-terrain"
      userData={{ fineCount: active.length, totalTiles: TERRAIN_TILES.length }}
    >
      <TerrainCover tiles={coarse} level="coarse" material={material} />
      <TerrainCover tiles={active} level="fine" material={material} />
    </group>
  );
}
