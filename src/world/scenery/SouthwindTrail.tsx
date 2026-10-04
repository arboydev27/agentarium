import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useWorld } from '../../state';
import { renderedTerrainHeight, walkwayHeight } from '../terrain';
import { clearOfSouthwindTrail, SOUTHWIND_TRAIL_XZ } from './southwindTrailPlacement';
import { clearOfSouthwindMere } from './merePlacement';

// The same authored centerline drives navigation and this visible walking surface.
// Short subsegments keep the ribbon above the coarse Landscape triangles.
function trailSamples() {
  const samples: [number, number][] = [];
  for (let index = 1; index < SOUTHWIND_TRAIL_XZ.length; index++) {
    const [ax, az] = SOUTHWIND_TRAIL_XZ[index - 1];
    const [bx, bz] = SOUTHWIND_TRAIL_XZ[index];
    const subdivisions = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.65));
    for (let step = index === 1 ? 0 : 1; step <= subdivisions; step++) {
      const t = step / subdivisions;
      samples.push([THREE.MathUtils.lerp(ax, bx, t), THREE.MathUtils.lerp(az, bz, t)]);
    }
  }
  return samples;
}

function TrailRibbon() {
  const geometry = useMemo(() => {
    const samples = trailSamples();
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const edge = new THREE.Color('#b9ad88');
    const worn = new THREE.Color('#d0c29b');
    for (let index = 0; index < samples.length; index++) {
      const [x, z] = samples[index];
      const [px, pz] = samples[Math.max(0, index - 1)];
      const [nx, nz] = samples[Math.min(samples.length - 1, index + 1)];
      const length = Math.hypot(nx - px, nz - pz) || 1;
      const sidewaysX = -(nz - pz) / length;
      const sidewaysZ = (nx - px) / length;
      for (const [offset, color] of [
        [-0.9, edge],
        [0, worn],
        [0.9, edge],
      ] as const) {
        const sx = x + sidewaysX * offset;
        const sz = z + sidewaysZ * offset;
        positions.push(sx, walkwayHeight(sx, sz, 0.08), sz);
        colors.push(color.r, color.g, color.b);
      }
      if (index > 0) {
        const a = (index - 1) * 3;
        const b = index * 3;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
        indices.push(a + 1, a + 2, b + 1, a + 2, b + 2, b + 1);
      }
    }
    const ribbon = new THREE.BufferGeometry();
    ribbon.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    ribbon.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    ribbon.setIndex(indices);
    ribbon.computeVertexNormals();
    return ribbon;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="southwind-walking-trail" geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

function TrailVerge() {
  const quality = useWorld((state) => state.quality);
  const grasses = useRef<THREE.InstancedMesh>(null);
  const markers = useRef<THREE.InstancedMesh>(null);
  const markerCaps = useRef<THREE.InstancedMesh>(null);
  const sites = useMemo(() => {
    const grass: { x: number; z: number; height: number }[] = [];
    const count = quality === 'high' ? 56 : 22;
    for (let index = 0; index < count; index++) {
      const segment = 2 + ((index * 7) % 14);
      const [ax, az] = SOUTHWIND_TRAIL_XZ[segment];
      const [bx, bz] = SOUTHWIND_TRAIL_XZ[segment + 1];
      const t = ((index * 37) % 97) / 97;
      const tangent = Math.hypot(bx - ax, bz - az) || 1;
      const side = index % 2 ? 1 : -1;
      const offset = side * (3.1 + ((index * 11) % 9) * 0.23);
      const x = THREE.MathUtils.lerp(ax, bx, t) - ((bz - az) / tangent) * offset;
      const z = THREE.MathUtils.lerp(az, bz, t) + ((bx - ax) / tangent) * offset;
      if (clearOfSouthwindTrail(x, z) && clearOfSouthwindMere(x, z, 0.2))
        grass.push({ x, z, height: 0.55 + ((index * 13) % 8) * 0.085 });
    }
    const marker = [3, 6, 9, 12, 15]
      .map((index, order) => {
        const [ax, az] = SOUTHWIND_TRAIL_XZ[index];
        const [bx, bz] = SOUTHWIND_TRAIL_XZ[index + 1];
        const tangent = Math.hypot(bx - ax, bz - az) || 1;
        const side = order % 2 ? 1 : -1;
        return {
          x: ax - ((bz - az) / tangent) * 2.95 * side,
          z: az + ((bx - ax) / tangent) * 2.95 * side,
        };
      })
      .filter(({ x, z }) => clearOfSouthwindTrail(x, z) && clearOfSouthwindMere(x, z));
    return { grass, marker };
  }, [quality]);
  useEffect(() => {
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    if (grasses.current) {
      const shades = ['#779164', '#8a9f73', '#a6aa77'].map((color) => new THREE.Color(color));
      sites.grass.forEach(({ x, z, height }, index) => {
        matrix.compose(
          position.set(x, renderedTerrainHeight(x, z) + height * 0.48, z),
          rotation,
          scale.set(0.24, height, 0.24),
        );
        grasses.current!.setMatrixAt(index, matrix);
        grasses.current!.setColorAt(index, shades[index % shades.length]);
      });
      grasses.current.instanceMatrix.needsUpdate = true;
      if (grasses.current.instanceColor) grasses.current.instanceColor.needsUpdate = true;
      grasses.current.computeBoundingSphere();
    }
    if (markers.current) {
      sites.marker.forEach(({ x, z }, index) => {
        matrix.compose(
          position.set(x, renderedTerrainHeight(x, z) + 0.75, z),
          rotation,
          scale.set(1, 1.5, 1),
        );
        markers.current!.setMatrixAt(index, matrix);
        markers.current!.setColorAt(index, new THREE.Color(index % 2 ? '#9a835f' : '#b3a077'));
      });
      markers.current.instanceMatrix.needsUpdate = true;
      if (markers.current.instanceColor) markers.current.instanceColor.needsUpdate = true;
      markers.current.computeBoundingSphere();
    }
    if (markerCaps.current) {
      sites.marker.forEach(({ x, z }, index) => {
        matrix.compose(
          position.set(x, renderedTerrainHeight(x, z) + 1.48, z),
          rotation,
          scale.set(0.29, 0.17, 0.29),
        );
        markerCaps.current!.setMatrixAt(index, matrix);
      });
      markerCaps.current.instanceMatrix.needsUpdate = true;
      markerCaps.current.computeBoundingSphere();
    }
    const instances = [grasses.current, markers.current, markerCaps.current].filter(
      (mesh): mesh is THREE.InstancedMesh => mesh !== null,
    );
    return () => instances.forEach((mesh) => mesh.dispose());
  }, [sites]);
  return (
    <group key={quality} name="southwind-trail-verge">
      <instancedMesh ref={grasses} args={[undefined, undefined, sites.grass.length]}>
        <coneGeometry args={[0.75, 1, 5]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={markers} args={[undefined, undefined, sites.marker.length]} castShadow>
        <cylinderGeometry args={[0.035, 0.12, 1, 5]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={markerCaps} args={[undefined, undefined, sites.marker.length]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#e3d6ad" roughness={1} />
      </instancedMesh>
    </group>
  );
}

export function SouthwindTrail() {
  return (
    <group name="southwind-trail-scenery">
      <TrailRibbon />
      <TrailVerge />
    </group>
  );
}
