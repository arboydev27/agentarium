import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { renderedTerrainHeight } from '../terrain';
import { useWorld } from '../../state';
import { REFERENCE_HABITAT as SITE } from './referenceHabitatPlacement';

const assetUrl = '/models/habitat/expedition-habitat.glb';
const ignoreRaycast: THREE.Object3D['raycast'] = () => {};

function ReferenceGround() {
  const quality = useWorld((s) => s.quality);
  const originals = useTexture([
    '/textures/habitat/regolith-color.png',
    '/textures/habitat/regolith-normal.png',
    '/textures/habitat/regolith-roughness.png',
  ]);
  const textures = useMemo(
    () =>
      originals.map((source, index) => {
        const t = source.clone();
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = quality === 'high' ? 8 : 2;
        t.colorSpace = index === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.needsUpdate = true;
        return t;
      }),
    [originals, quality],
  );
  const geometry = useMemo(() => {
    const segments = 64;
    const g = new THREE.PlaneGeometry(28, 26, segments, segments);
    g.rotateX(-Math.PI / 2);
    const pos = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    const colors: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i);
      pos.setY(i, renderedTerrainHeight(SITE.x + x, SITE.z + z) + 0.035);
      // Physical texture scale: one 512px tile per three metres, independent of camera zoom.
      uv.setXY(i, (SITE.x + x) / 3, (SITE.z + z) / 3);
      const radius = Math.hypot(x / 14, z / 13);
      const edge = (1 - radius + Math.sin(x * 0.6) * Math.cos(z * 0.7) * 0.035) / 0.3;
      colors.push(1, 1, 1, THREE.MathUtils.smoothstep(edge, 0, 1));
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );
  useEffect(
    () => () => {
      textures.forEach((t) => t.dispose());
    },
    [textures],
  );
  return (
    <mesh geometry={geometry} position={[SITE.x, 0, SITE.z]} receiveShadow raycast={ignoreRaycast}>
      <meshStandardMaterial
        map={textures[0]}
        normalMap={textures[1]}
        roughnessMap={textures[2]}
        normalScale={[0.65, 0.65]}
        roughness={1}
        vertexColors
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

function RoverTracks() {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const o = new THREE.Object3D();
    let index = 0;
    for (let i = 0; i < 58; i++) {
      const t = i / 57;
      for (const side of [-1, 1]) {
        const x = SITE.x + 5 + Math.sin(t * 2) * 0.8 + side * 0.65;
        const z = SITE.z + 9 - t * 11;
        o.position.set(x, renderedTerrainHeight(x, z) + 0.063, z);
        o.rotation.set(0, Math.cos(t * 2) * 0.14, 0);
        o.updateMatrix();
        ref.current.setMatrixAt(index++, o.matrix);
      }
    }
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, []);
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, 116]}
      receiveShadow
      raycast={ignoreRaycast}
    >
      <boxGeometry args={[0.35, 0.008, 0.07]} />
      <meshStandardMaterial
        color="#69422e"
        roughness={1}
        transparent
        opacity={0.34}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

export function ReferenceHabitat() {
  const { scene } = useGLTF(assetUrl);
  const base = useMemo(
    () =>
      Math.max(
        ...[-3.4, 3.4].flatMap((x) =>
          [-2.2, 2.2].map((z) => renderedTerrainHeight(SITE.x + x, SITE.z + z)),
        ),
      ) + 0.08,
    [],
  );
  const model = useMemo(() => {
    const result = scene.clone(true);
    result.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        object.raycast = ignoreRaycast;
      }
    });
    return result;
  }, [scene]);
  return (
    <group name="blender-reference-habitat">
      <ReferenceGround />
      <RoverTracks />
      <primitive object={model} position={[SITE.x, base, SITE.z]} dispose={null} />
      {[-2.8, 2.8].flatMap((x) =>
        [-1.65, 1.65].map((z) => {
          const ground = renderedTerrainHeight(SITE.x + x, SITE.z + z);
          const height = Math.max(0.08, base - ground + 0.1);
          return (
            <mesh
              key={`${x}:${z}`}
              position={[SITE.x + x, ground + height / 2, SITE.z + z]}
              receiveShadow
              castShadow
              raycast={ignoreRaycast}
            >
              <boxGeometry args={[1.24, height, 1.09]} />
              <meshStandardMaterial color="#706457" roughness={0.94} />
            </mesh>
          );
        }),
      )}
    </group>
  );
}
