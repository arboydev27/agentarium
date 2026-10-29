import { WorldSurfaceMaterial } from './WorldSurfaceMaterial';
import { ScenicFallback } from './scenery/ScenicFallback';
import { DesertGeology } from './DesertGeology';
import { MeadowChunks } from './scenery/MeadowChunks';
import { Colony } from './Colony';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../state';
import { CAMERA_VIEWS, LOOKOUT } from './layout';
import {
  SCENIC_REGIONS,
  selectScenicRegions,
  type ScenicFrame,
  type ScenicRegionId,
} from './scenicVisibility';
import { measureScenicFrame } from './scenicCamera';
import { TerrainTiles } from './TerrainTiles';
import { ScenicAsset } from './ScenicAsset';
import { preloadScenicAssets } from './scenicAssets';
import { MeadowLookoutGround } from './scenery/LookoutGround';
import { meadowTrailPoint, walkwayHeight } from './terrain';
import { OrchardGround } from './scenery/OrchardGround';
import { FarRidge } from './scenery/FarRidge';
import { DistantLandforms } from './scenery/DistantLandforms';
import { ObservatoryGround } from './scenery/ObservatoryGround';
import { SouthwindMere } from './scenery/SouthwindMere';
import { DawnlightGround } from './scenery/DawnlightGround';
import { WindwardGround } from './scenery/WindwardGround';
import { WoodlandGround } from './scenery/WoodlandGround';
import { NorthstarGround } from './scenery/NorthstarGround';
import { SouthwindTrail } from './scenery/SouthwindTrail';
import { TrailTurnouts } from './scenery/TrailTurnouts';

function LandscapePath() {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= 34; i++) {
      const [center, , z] = meadowTrailPoint(i);
      const previous = meadowTrailPoint(i - 1)[0];
      const next = meadowTrailPoint(i + 1)[0];
      const lateral = (next - previous) / 4.7;
      for (const side of [-1, 1]) {
        const x = center + side * 1.15;
        const edgeZ = z + side * lateral * 1.15;
        positions.push(x, walkwayHeight(x, edgeZ, 0.045), edgeZ);
      }
      if (i) {
        const a = (i - 1) * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const path = new THREE.BufferGeometry();
    path.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    path.setIndex(indices);
    path.computeVertexNormals();
    return path;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="decorative-meadow-trail" geometry={geometry} receiveShadow>
      <WorldSurfaceMaterial
        family="cast-foundation"
        color="#c6bc94"
        roughness={1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function LookoutBranch() {
  const geometry = useMemo(() => {
    const [startX, , startZ] = meadowTrailPoint(12);
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const x = THREE.MathUtils.lerp(startX, LOOKOUT.x, t);
      const z = THREE.MathUtils.lerp(startZ, LOOKOUT.z, t);
      for (const side of [-1, 1]) {
        const edgeZ = z + side * 0.78;
        positions.push(x, walkwayHeight(x, edgeZ, 0.05 + t * 0.05), edgeZ);
      }
      if (i) {
        const a = (i - 1) * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const branch = new THREE.BufferGeometry();
    branch.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    branch.setIndex(indices);
    branch.computeVertexNormals();
    return branch;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="lookout-branch" geometry={geometry} receiveShadow>
      <WorldSurfaceMaterial
        family="cast-foundation"
        color="#c6bc94"
        roughness={1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function ScenicMounts() {
  const view = useWorld((state) => state.camera);
  const customized = useWorld((state) => state.cameraCustomized);
  const cameraJump = useWorld((state) => state.cameraJump);
  const quality = useWorld((state) => state.quality);
  const size = useThree((state) => state.size);
  const renderCamera = useThree((state) => state.camera);
  const allIds = useMemo(() => new Set(SCENIC_REGIONS.map((region) => region.id)), []);
  const [visible, setVisible] = useState<ReadonlySet<ScenicRegionId>>(() => {
    if (view === 'horizon' || !(renderCamera instanceof THREE.OrthographicCamera)) return allIds;
    return new Set(
      selectScenicRegions({ mode: 'orthographic', ...measureScenicFrame(renderCamera) }).map(
        (region) => region.id,
      ),
    );
  });
  const selected = useRef<ReadonlySet<ScenicRegionId>>(visible);
  const [completedJump, setCompletedJump] = useState<number | null>(null);
  const elapsed = useRef(0.2);
  const lastRadius = useRef(60);
  const presetCamera = useMemo(() => new THREE.OrthographicCamera(), []);
  const presetTarget = useMemo<ScenicFrame | undefined>(() => {
    if (view === 'horizon' || customized || !size.width || !size.height) return undefined;
    const preset = CAMERA_VIEWS[view];
    presetCamera.left = -size.width / 2;
    presetCamera.right = size.width / 2;
    presetCamera.top = size.height / 2;
    presetCamera.bottom = -size.height / 2;
    presetCamera.near = 0.1;
    presetCamera.far = 360;
    presetCamera.zoom = Math.min(size.width / preset.span[0], size.height / preset.span[1]);
    presetCamera.position.fromArray(preset.pos);
    presetCamera.lookAt(new THREE.Vector3(...preset.look));
    presetCamera.updateProjectionMatrix();
    return measureScenicFrame(presetCamera);
  }, [view, customized, size.width, size.height, presetCamera]);
  const jumpActive = Boolean(customized && cameraJump && cameraJump.sequence !== completedJump);
  const jumpTarget: ScenicFrame | undefined =
    jumpActive && cameraJump
      ? {
          focus: { x: cameraJump.x, z: cameraJump.z },
          camera: { x: cameraJump.x, z: cameraJump.z },
          visibleGroundRadius: Math.max(45, lastRadius.current),
        }
      : undefined;
  const target = jumpTarget ?? presetTarget;
  // This union renders the destination in the same React update that requests
  // a preset or map jump, before the camera begins its animated travel.
  const prefetched = target
    ? selectScenicRegions({ mode: 'orthographic', ...target }).map((region) => region.id)
    : [];
  const prefetchKey = prefetched.join(',');
  useEffect(() => {
    if (prefetchKey) void preloadScenicAssets(prefetchKey.split(',') as ScenicRegionId[]);
  }, [prefetchKey]);
  useFrame(({ camera }, delta) => {
    elapsed.current += delta;
    if (elapsed.current < 0.2) return;
    elapsed.current = 0;
    const next =
      view === 'horizon' || !(camera instanceof THREE.OrthographicCamera)
        ? [...SCENIC_REGIONS]
        : (() => {
            const current = measureScenicFrame(camera);
            if (Number.isFinite(current.visibleGroundRadius))
              lastRadius.current = current.visibleGroundRadius;
            if (
              jumpActive &&
              cameraJump &&
              Math.hypot(current.focus.x - cameraJump.x, current.focus.z - cameraJump.z) < 6
            )
              setCompletedJump(cameraJump.sequence);
            return selectScenicRegions(
              { mode: 'orthographic', ...current, target },
              selected.current,
            );
          })();
    const ids = new Set(next.map((region) => region.id));
    if (ids.size === selected.current.size && [...ids].every((id) => selected.current.has(id)))
      return;
    selected.current = ids;
    setVisible(ids);
  });
  const active = view === 'horizon' ? allIds : new Set([...visible, ...prefetched]);
  return (
    <group name="spatial-scenic-landmarks">
      {SCENIC_REGIONS.map((region) =>
        active.has(region.id) ? (
          <ScenicAsset key={`${region.id}-${quality}`} id={region.id} />
        ) : (
          <ScenicFallback key={`${region.id}-distant`} id={region.id} state="distant" />
        ),
      )}
    </group>
  );
}

function Landscape() {
  return (
    <group name="distant-landscape">
      <TerrainTiles />
      <LandscapePath />
      <TrailTurnouts />
      <LookoutBranch />
      <MeadowLookoutGround />
      <OrchardGround />
      <ObservatoryGround />
      <WoodlandGround />
      <NorthstarGround />
      <SouthwindTrail />
      <SouthwindMere />
      <DawnlightGround />
      <WindwardGround />
      <FarRidge />
      <DistantLandforms />
      <DesertGeology />
      <MeadowChunks />
      <ScenicMounts />
    </group>
  );
}

export const Environment = memo(function Environment() {
  return (
    <group>
      <Landscape />
      <Colony />
    </group>
  );
});
