import { BasinWater, DriftingLeaves, WarmGlow } from './Ambience';
import { memo, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../state';
import { Box, Cylinder, Sphere, Sign, Tree, Pot, Lamp } from './primitives';
import { LOOKOUT, ZONES, type ZoneName } from './layout';
import { DetailLayer } from './DetailLayer';
import { useSurfaceTextures } from './surfaces';
import {
  LANDSCAPE_SEGMENTS,
  LANDSCAPE_SIZE,
  meadowTrailPoint,
  terrainHeight,
  walkwayHeight,
} from './terrain';
import { MeadowScenery } from './scenery/Meadow';
import { OrchardCommons } from './scenery/Orchard';
import { clearOfOrchard, clearOfOrchardView } from './scenery/orchardPlacement';
import { clearOfObservatory, clearOfObservatoryView } from './scenery/observatoryPlacement';
import { FarRidge } from './scenery/FarRidge';
import { CedarObservatory } from './scenery/Observatory';
import { SlateReach } from './scenery/SlateReach';
import { clearOfSlateReach } from './scenery/slatePlacement';
import { SouthwindMere } from './scenery/SouthwindMere';
import { clearOfSouthwindMere } from './scenery/merePlacement';
import { TrailTurnouts } from './scenery/TrailTurnouts';
import { clearOfTurnouts } from './scenery/turnoutPlacement';

const wood = '#b98b60';
const green = '#365d4a';

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
      <meshStandardMaterial color="#c6bc94" roughness={1} side={THREE.DoubleSide} />
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
      <meshStandardMaterial color="#c6bc94" roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

function LookoutCanopy() {
  const geometry = useMemo(() => {
    // The southeast face is open toward the lookout camera and the arriving
    // resident. The raised rear roof still reads as a landmark from the meadow.
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= 6; i++) {
      const angle = (3 * Math.PI) / 4 + (i / 6) * Math.PI;
      positions.push(Math.cos(angle) * 3.6, 3.03, Math.sin(angle) * 3.6);
      positions.push(Math.cos(angle) * 0.95, 3.62, Math.sin(angle) * 0.95);
      if (i) {
        const a = (i - 1) * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const roof = new THREE.BufferGeometry();
    roof.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    roof.setIndex(indices);
    roof.computeVertexNormals();
    return roof;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color="#3f6c58" roughness={0.85} flatShading side={THREE.DoubleSide} />
    </mesh>
  );
}

function MeadowLookout() {
  const ground = terrainHeight(LOOKOUT.x, LOOKOUT.z);
  return (
    <group name="meadow-lookout" position={[LOOKOUT.x, ground, LOOKOUT.z]}>
      <Cylinder pos={[0, 0, 0]} r={LOOKOUT.clearingRadius} h={0.2} color="#bfb391" />
      <mesh position={[0, 0.112, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.9, 3.12, 32]} />
        <meshStandardMaterial color="#d8cca7" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      {[-2.35, 2.35].flatMap((x) =>
        [-2.2, 2.2].map((z) => (
          <group key={`${x},${z}`}>
            <Cylinder pos={[x, 1.4, z]} r={0.105} h={2.6} color="#82674c" />
            <Cylinder pos={[x, 0.17, z]} r={0.24} h={0.14} color="#d4c7a4" />
          </group>
        )),
      )}
      {[-2.2, 2.2].map((z) => (
        <Box key={z} pos={[0, 2.69, z]} size={[5.15, 0.15, 0.17]} color="#82674c" />
      ))}
      <LookoutCanopy />
      <Sign
        text="MEADOW LOOKOUT"
        pos={[0, 2.44, 2.33]}
        size={[2.9, 0.34]}
        color="#eee5ce"
        background="#476c58"
      />
      <Box pos={[2.7, 0.62, 0]} size={[0.12, 0.62, 2.15]} color="#8c7456" />
      <Box pos={[0, 0.62, -2.55]} size={[2.4, 0.62, 0.12]} color="#8c7456" />
      {[
        [4.4, -1.9],
        [4.7, 1.6],
        [1.5, -4.7],
        [-1.6, -4.6],
        [1.2, 4.6],
      ].map(([x, z], i) => (
        <group key={i}>
          <Sphere
            pos={[x, terrainHeight(LOOKOUT.x + x, LOOKOUT.z + z) - ground + 0.18, z]}
            scale={[0.66, 0.31, 0.6]}
            color={i % 2 ? '#74905f' : '#8ca573'}
          />
          <Sphere
            pos={[x + 0.32, terrainHeight(LOOKOUT.x + x, LOOKOUT.z + z) - ground + 0.39, z]}
            scale={[0.17, 0.13, 0.17]}
            color={i % 2 ? '#e5c890' : '#d3988a'}
          />
        </group>
      ))}
    </group>
  );
}

function Landscape() {
  const geometry = useMemo(() => {
    // Put the mesh boundary well beyond the fog so no rectangular edge enters view.
    const ground = new THREE.PlaneGeometry(
      LANDSCAPE_SIZE,
      LANDSCAPE_SIZE,
      LANDSCAPE_SEGMENTS,
      LANDSCAPE_SEGMENTS,
    );
    ground.rotateX(-Math.PI / 2);
    const positions = ground.getAttribute('position');
    const colors = new Float32Array(positions.count * 3);
    const meadow = new THREE.Color('#82a171');
    const field = new THREE.Color('#acb78d');
    const ridge = new THREE.Color('#90a397');
    const color = new THREE.Color();
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const y = terrainHeight(x, z);
      positions.setY(i, y);
      const fieldPatch =
        (Math.sin(x * 0.082 + Math.sin(z * 0.04)) * Math.cos(z * 0.11 - x * 0.025) + 1) * 0.5;
      color
        .copy(meadow)
        .lerp(field, fieldPatch * 0.42)
        .lerp(ridge, THREE.MathUtils.clamp((y - 2.5) / 12, 0, 0.85));
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    ground.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    ground.computeVertexNormals();
    return ground;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group name="distant-landscape">
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <LandscapePath />
      <TrailTurnouts />
      <LookoutBranch />
      <MeadowLookout />
      <LandscapeGroves />
      <MeadowScenery />
      <OrchardCommons />
      <CedarObservatory />
      <SlateReach />
      <SouthwindMere />
      <FarRidge />
    </group>
  );
}

function LandscapeGroves() {
  const quality = useWorld((s) => s.quality);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);
  const tips = useRef<THREE.InstancedMesh>(null);
  const understory = useRef<THREE.InstancedMesh>(null);
  const placements = useMemo(() => {
    const count = quality === 'high' ? 168 : 84;
    const clusters: [number, number][] = [
      [-43, -30],
      [-29, -49],
      [-46, -68],
      [39, -29],
      [31, -52],
      [45, -72],
      [-31, 29],
      [29, 31],
      [-51, 49],
      [51, 47],
      [-18, -78],
      [35, -84],
    ];
    return Array.from({ length: count }, (_, i) => {
      const [cx, cz] = clusters[i % clusters.length];
      const ring = Math.floor(i / clusters.length);
      const spread = Math.sqrt((ring + 0.5) / (count / clusters.length)) * 13;
      const angle = i * 2.399963;
      const x = cx + Math.cos(angle) * spread;
      const z = cz + Math.sin(angle) * spread;
      const size = 1.15 + ((i * 13) % 17) * 0.1;
      return { x, y: terrainHeight(x, z), z, size, shade: i % 3 };
    }).filter(
      ({ x, z }) =>
        clearOfOrchard(x, z, 1.8) &&
        clearOfOrchardView(x, z) &&
        clearOfObservatory(x, z, 1.8) &&
        clearOfObservatoryView(x, z) &&
        clearOfSlateReach(x, z, 2) &&
        clearOfSouthwindMere(x, z, 1.5) &&
        clearOfTurnouts(x, z, 1.5),
    );
  }, [quality]);
  useEffect(() => {
    if (!trunks.current || !crowns.current || !tips.current || !understory.current) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const greens = ['#5a7656', '#6e895f', '#78936c'].map((shade) => new THREE.Color(shade));
    placements.forEach(({ x, y, z, size, shade }, i) => {
      matrix.compose(
        position.set(x, y + size * 0.62, z),
        rotation,
        scale.set(size, size * 1.25, size),
      );
      trunks.current!.setMatrixAt(i, matrix);
      matrix.compose(position.set(x, y + size * 1.7, z), rotation, scale.setScalar(size));
      crowns.current!.setMatrixAt(i, matrix);
      crowns.current!.setColorAt(i, greens[shade]);
      matrix.compose(position.set(x, y + size * 2.25, z), rotation, scale.setScalar(size * 0.73));
      tips.current!.setMatrixAt(i, matrix);
      tips.current!.setColorAt(i, greens[(shade + 1) % greens.length]);
      matrix.compose(
        position.set(x, y + size * 0.12, z),
        rotation,
        scale.set(size * 0.8, size * 0.24, size * 0.85),
      );
      understory.current!.setMatrixAt(i, matrix);
      understory.current!.setColorAt(i, greens[(shade + 2) % greens.length]);
    });
    for (const mesh of [trunks.current, crowns.current, tips.current, understory.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [placements]);
  return (
    <group name="distant-groves">
      <instancedMesh ref={trunks} args={[undefined, undefined, placements.length]}>
        <cylinderGeometry args={[0.09, 0.15, 1, 5]} />
        <meshStandardMaterial color="#786d55" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, placements.length]}>
        <coneGeometry args={[0.8, 1.7, 6]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={tips} args={[undefined, undefined, placements.length]}>
        <coneGeometry args={[0.57, 1.35, 6]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={understory} args={[undefined, undefined, placements.length]}>
        <sphereGeometry args={[1, 6, 4]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}

function Floor({ zone, color, map }: { zone: ZoneName; color: string; map?: THREE.Texture }) {
  const {
    center: [x, y, z],
    size: [w, d],
  } = ZONES[zone];
  return (
    <Box pos={[x, (y + 0.4) / 2, z]} size={[w, y - 0.4, d]} color={color} map={map} radius={0.04} />
  );
}

function Chair({ x, z, turn = 0 }: { x: number; z: number; turn?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, turn, 0]}>
      <Cylinder pos={[0, 0.48, 0]} r={0.32} h={0.09} color="#c8996a" />
      <Box pos={[0, 0.83, -0.28]} size={[0.63, 0.46, 0.08]} color={green} />
      {[-0.22, 0.22].flatMap((x) =>
        [-0.22, 0.22].map((z) => (
          <Cylinder key={`${x},${z}`} pos={[x, 0.23, z]} r={0.035} h={0.46} color={green} />
        )),
      )}
    </group>
  );
}

function TerraceTable({ x, z, umbrella = false }: { x: number; z: number; umbrella?: boolean }) {
  return (
    <group position={[x, 0.68, z]}>
      <Cylinder pos={[0, 0.92, 0]} r={0.66} h={0.1} color="#dac49a" />
      <Cylinder pos={[0, 0.46, 0]} r={0.06} h={0.92} color={green} />
      <Cylinder pos={[0, 0.06, 0]} r={0.32} h={0.07} color={green} />
      <Chair x={0} z={-0.95} />
      <Chair x={0} z={0.95} turn={Math.PI} />
      {umbrella && (
        <>
          <Cylinder pos={[0, 1.9, 0]} r={0.035} h={3.8} color={wood} />
          <mesh position={[0, 3.35, 0]} castShadow>
            <coneGeometry args={[1.48, 0.55, 8, 1, true]} />
            <meshStandardMaterial color="#ecdab1" side={THREE.DoubleSide} roughness={0.85} />
          </mesh>
          <Sphere pos={[0, 3.67, 0]} scale={[0.08, 0.08, 0.08]} color={wood} />
        </>
      )}
    </group>
  );
}

function Cup({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      <Cylinder pos={[0, 0.015, 0]} r={0.15} h={0.03} color="#f4e9d0" />
      <Cylinder pos={[0, 0.11, 0]} r={0.075} top={0.1} h={0.17} color="#eee0bd" />
      <Cylinder pos={[0, 0.198, 0]} r={0.083} h={0.006} color="#644d39" />
      <mesh position={[0.11, 0.12, 0]}>
        <torusGeometry args={[0.045, 0.017, 5, 10]} />
        <meshStandardMaterial color="#eee0bd" />
      </mesh>
    </group>
  );
}

function Steam() {
  const group = useRef<THREE.Group>(null);
  const reduced = useWorld((s) => s.reducedMotion);
  const time = useRef(0);
  useFrame((_, delta) => {
    if (!group.current || reduced) return;
    time.current += Math.min(delta, 0.05);
    group.current.children.forEach((child, i) => {
      const t = (time.current * 0.35 + i / 3) % 1;
      child.position.set(Math.sin(t * 4 + i) * 0.07, t * 0.65, 0);
      child.scale.setScalar(0.7 + t);
      ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity =
        Math.sin(t * Math.PI) * 0.22;
    });
  });
  if (reduced) return null;
  return (
    <group ref={group} position={[-11.5, 2.65, -6.2]}>
      {[0, 1, 2].map((i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.07, 6, 6]} />
          <meshBasicMaterial color="#fff4df" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function CafeDetails() {
  return (
    <>
      {/* Fine boards and counter fluting are geometry only at useful screen sizes. */}
      {Array.from({ length: 31 }, (_, i) => (
        <Box
          key={`floor${i}`}
          pos={[-12.8 + i * 0.38, 0.685, -4.5]}
          size={[0.012, 0.008, 9.6]}
          radius={0}
          color="#9e7e59"
        />
      ))}
      {Array.from({ length: 17 }, (_, i) => (
        <Box
          key={`flute${i}`}
          pos={[-12.18 + i * 0.09, 1.26, -5.84]}
          size={[0.03, 0.94, 0.04]}
          radius={0}
          color="#668169"
        />
      ))}
      <Box pos={[-11.45, 2.25, -6.55]} size={[1.02, 0.61, 0.69]} color="#dfddcc" radius={0.09} />
      <Box pos={[-11.45, 2.21, -6.185]} size={[0.84, 0.27, 0.04]} color="#354c47" />
      {[-11.7, -11.25].map((x) => (
        <group key={x}>
          <Cylinder pos={[x, 2.13, -6.04]} r={0.03} h={0.2} color="#d2c8af" />
          <Cup pos={[x, 1.96, -6.07]} />
        </group>
      ))}
      <Cylinder pos={[-11.45, 2.67, -6.55]} r={0.18} h={0.22} color="#76604a" />
      <Steam />
      <Box pos={[-11.4, 2.04, -7.72]} size={[1.14, 0.13, 0.78]} color="#e2d5b4" />
      {[0, 1, 2].map((i) => (
        <Sphere
          key={i}
          pos={[-11.7 + i * 0.3, 2.18, -7.72]}
          scale={[0.13, 0.1, 0.2]}
          color={i % 2 ? '#c49150' : '#e0b774'}
        />
      ))}
      <mesh position={[-11.4, 2.29, -7.72]}>
        <boxGeometry args={[1.2, 0.45, 0.82]} />
        <meshStandardMaterial
          color="#dce8df"
          transparent
          opacity={0.2}
          roughness={0.15}
          depthWrite={false}
        />
      </mesh>
      {[-8.6, -6.4, -4.2].map((x, i) => (
        <group key={x}>
          <Box pos={[x, 1.73, -8.92]} size={[1.8, 0.2, 0.38]} color={wood} />
          {[0, 1, 2].map((j) => (
            <Pot key={j} pos={[x - 0.55 + j * 0.55, 1.84, -8.88]} scale={0.5} />
          ))}
          <Cup pos={[-11.3, 1.67, -3.6 + i * 0.13]} />
        </group>
      ))}
      <Sign
        text="COFFEE · BAKES · GOOD IDEAS"
        pos={[-6.9, 3.96, -9.045]}
        size={[4.6, 0.32]}
        color="#59715a"
        background="#eadfc5"
      />
      <Box pos={[-2.2, 2.57, -9]} size={[1.15, 1.8, 0.12]} color={wood} />
      <Sign text="slow brew" pos={[-2.2, 2.95, -8.925]} size={[1.03, 0.35]} />
      {['espresso', 'cappuccino', 'tea & cake'].map((text, i) => (
        <Sign key={text} text={text} pos={[-2.2, 2.58 - i * 0.27, -8.925]} size={[1.03, 0.24]} />
      ))}
      <Cup pos={[-11.65, 1.65, -0.7]} />
      <Box pos={[-11, 1.66, -0.7]} size={[0.3, 0.02, 0.4]} color="#a97455" />
      <Pot pos={[-1.6, 0.68, -0.15]} scale={1.6} />
      <Pot pos={[-12.4, 0.68, -4.9]} scale={1.3} />
    </>
  );
}

function Cafe({ surfaces }: { surfaces: ReturnType<typeof useSurfaceTextures> }) {
  const night = useWorld((s) => s.night);
  return (
    <group name="café">
      <Floor zone="café" color="#c6a575" map={surfaces.wood} />
      <Box pos={[-7, 2.63, -9.2]} size={[12, 3.9, 0.22]} color="#eadfc5" map={surfaces.plaster} />
      <Box
        pos={[-12.9, 2.6, -6.8]}
        size={[0.2, 3.85, 4.8]}
        color="#e2d3b6"
        map={surfaces.plaster}
      />
      <Box pos={[-7, 1.14, -9.04]} size={[11.8, 0.9, 0.1]} color={green} />
      {[-8.6, -6.4, -4.2].map((x) => (
        <group key={x}>
          <Box pos={[x, 2.8, -9.02]} size={[1.9, 2, 0.13]} color={green} />
          <Box
            pos={[x, 2.8, -8.94]}
            size={[1.66, 1.76, 0.06]}
            color={night ? '#dbbd79' : '#abc7b2'}
          />
          <Box pos={[x, 2.8, -8.895]} size={[0.065, 1.8, 0.035]} color="#f1e0bb" />
          <Box pos={[x, 2.8, -8.895]} size={[1.7, 0.065, 0.035]} color="#f1e0bb" />
        </group>
      ))}
      {/* An open front keeps the workstations readable from the main camera. */}
      <Box pos={[-7, 4.67, -8.6]} size={[12.6, 0.25, 1.6]} color={green} radius={0.1} />
      {Array.from({ length: 21 }, (_, i) => (
        <Box
          key={i}
          pos={[-13 + i * 0.6, 4.83, -8.6]}
          size={[0.07, 0.08, 1.55]}
          color="#507860"
          radius={0.02}
        />
      ))}
      <Box pos={[-7, 4.38, -7.74]} size={[12.5, 0.52, 0.16]} color={green} />
      <Sign text="the little café" pos={[-6.8, 4.39, -7.649]} size={[4.1, 0.49]} />
      {[-12.75, -1.25].map((x) => (
        <group key={x}>
          <Box pos={[x, 2.65, -7.78]} size={[0.18, 3.95, 0.18]} color={wood} />
          <Box pos={[x, 0.84, -7.78]} size={[0.32, 0.3, 0.32]} color="#e1d6b8" />
        </group>
      ))}
      <Box pos={[-11.45, 1.3, -7.12]} size={[1.65, 1.24, 2.65]} color={green} />
      <Box
        pos={[-11.45, 1.96, -7.12]}
        size={[1.83, 0.12, 2.85]}
        color="#e5d2ac"
        map={surfaces.wood}
      />
      <group position={[-6.5, 0.68, -6.5]}>
        <Box pos={[0, 1.03, 0]} size={[4.5, 0.13, 1]} color="#d7b488" map={surfaces.wood} />
        {[-1.8, 1.8].map((x) => (
          <Box key={x} pos={[x, 0.5, 0]} size={[0.12, 1, 0.75]} color={green} />
        ))}
        {[-1.35, 0, 1.35].map((x) => (
          <Chair key={x} x={x} z={-0.95} />
        ))}
        <Pot pos={[1.7, 1.1, 0]} scale={0.5} />
      </group>
      <TerraceTable x={-11.3} z={-1.1} umbrella />
      <TerraceTable x={-11.3} z={-3.7} />
      <Box pos={[-7, 0.55, 0.65]} size={[5.3, 0.17, 0.65]} color="#b19370" />
      {[-9.9, -3.2].map((x) => (
        <group key={x}>
          <Box pos={[x, 0.88, 0.23]} size={[2, 0.4, 0.42]} color="#d8c5a0" />
          <Sphere pos={[x, 1.17, 0.23]} scale={[0.85, 0.27, 0.3]} color="#77945a" />
        </group>
      ))}
      {[-9.4, -4.3].map((x) => (
        <group key={x}>
          <Cylinder pos={[x, 4.09, -6.3]} r={0.015} h={0.75} color="#554b37" />
          <Cylinder pos={[x, 3.7, -6.3]} r={0.22} top={0.08} h={0.2} color="#d0a46d" />
          <WarmGlow position={[x, 3.57, -6.3]} size={0.5} />
          <mesh position={[x, 3.57, -6.3]}>
            <sphereGeometry args={[0.09, 8, 6]} />
            <meshStandardMaterial
              color="#ffe8af"
              emissive="#ffcf75"
              emissiveIntensity={night ? 2 : 0.4}
            />
          </mesh>
        </group>
      ))}
      {night && (
        <pointLight
          position={[-7, 3.5, -5.8]}
          intensity={14}
          distance={10}
          color="#ffd696"
          decay={2}
        />
      )}
      <DetailLayer zone="café">
        <CafeDetails />
      </DetailLayer>
    </group>
  );
}

function Studio({ woodMap }: { woodMap: THREE.Texture }) {
  return (
    <group name="studio">
      <Floor zone="studio" color="#cfb38b" map={woodMap} />
      <Box pos={[7, 2.65, -8.65]} size={[9.6, 3.1, 0.2]} color="#608573" />
      <Box pos={[11.7, 2.65, -6.65]} size={[0.2, 3.1, 4]} color="#608573" />
      <Box pos={[6.5, 2.9, -8.49]} size={[5.1, 1.8, 0.12]} color="#f0e5cc" />
      <Box pos={[6.5, 2.9, -8.41]} size={[4.85, 1.55, 0.05]} color="#adc8bc" />
      {[-1.6, 0, 1.6].map((x) => (
        <Box key={x} pos={[6.5 + x, 2.9, -8.36]} size={[0.08, 1.6, 0.06]} color="#f0e5cc" />
      ))}
      <Box pos={[7, 4.35, -7.35]} size={[10, 0.26, 3]} color="#ba8662" />
      <Sign text="THE STUDIO" pos={[7, 4.08, -5.835]} size={[3, 0.38]} background="#ba8662" />
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          pos={[6.8, 0.51 + i * 0.18, -0.35 - i * 0.36]}
          size={[3, 0.19, 0.4]}
          color="#b49a76"
        />
      ))}
      <Pot pos={[2.7, 1.1, -7.8]} scale={1.6} />
      <DetailLayer zone="studio">
        {Array.from({ length: 23 }, (_, i) => (
          <Box
            key={i}
            pos={[2.5 + i * 0.4, 1.105, -5]}
            size={[0.012, 0.007, 7.3]}
            radius={0}
            color="#b69973"
          />
        ))}
        <Box pos={[10.25, 1.75, -8]} size={[1.8, 1.3, 0.7]} color={wood} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Box
            key={i}
            pos={[9.55 + i * 0.27, 2, -7.62]}
            size={[0.2, 0.65 - (i % 2) * 0.1, 0.28]}
            color={['#63816c', '#c48361', '#efd5a2'][i % 3]}
          />
        ))}
        <Sign
          text="make something good"
          pos={[3.1, 3.5, -8.51]}
          size={[1.35, 0.35]}
          background="#608573"
        />
      </DetailLayer>
    </group>
  );
}

function Garden({ stoneMap }: { stoneMap: THREE.Texture }) {
  const night = useWorld((s) => s.night);
  return (
    <group name="garden">
      <Floor zone="garden" color="#bfb88f" map={stoneMap} />
      {/* The pale spine follows the authored aisle without adding a collision obstacle. */}
      {Array.from({ length: 8 }, (_, i) => (
        <Box
          key={`spine-${i}`}
          pos={[6.8, 0.557, 2.05 + i * 0.65]}
          size={[1.12, 0.012, 0.49]}
          color={i % 2 ? '#d6ccaa' : '#ded4b3'}
          radius={0.025}
        />
      ))}
      {[2.22, 11.78].map((x) => (
        <group key={`bed-${x}`}>
          <Box pos={[x, 0.7, 5.05]} size={[0.4, 0.3, 4.9]} color="#b78361" radius={0.04} />
          <Box pos={[x, 0.855, 5.05]} size={[0.32, 0.018, 4.75]} color="#574f39" radius={0} />
          {[3.25, 4.7, 6.25].map((z, i) => (
            <Sphere
              key={`${x}-${z}`}
              pos={[x, 0.94, z]}
              scale={[0.29, 0.2, 0.41]}
              color={i % 2 ? '#6d8b57' : '#809967'}
            />
          ))}
        </group>
      ))}
      {[2.5, 11.5].flatMap((x) =>
        [1.4, 8.6].map((z) => (
          <Cylinder key={`${x},${z}`} pos={[x, 2.6, z]} r={0.095} h={4.1} color="#9e855f" />
        )),
      )}
      {[1.4, 8.6].map((z) => (
        <Box key={z} pos={[7, 4.67, z]} size={[9.5, 0.18, 0.22]} color="#a58e64" />
      ))}
      {Array.from({ length: 11 }, (_, i) => (
        <Box key={i} pos={[2.5 + i * 0.9, 4.82, 5]} size={[0.16, 0.16, 7.8]} color="#b49c72" />
      ))}
      {[2.5, 11.5].map((x) => (
        <group key={x}>
          <Cylinder
            pos={[x, 4.48, 5]}
            r={0.015}
            h={7.2}
            rotation={[Math.PI / 2, 0, 0]}
            color="#667450"
          />
          {[2, 3.5, 5, 6.5, 8].map((z) => (
            <mesh key={z} position={[x, 4.35, z]}>
              <sphereGeometry args={[0.065, 8, 6]} />
              <meshStandardMaterial
                color="#fff0bb"
                emissive="#ffda88"
                emissiveIntensity={night ? 2 : 0.5}
              />
            </mesh>
          ))}
        </group>
      ))}
      <Pot pos={[2.8, 0.55, 8.2]} scale={1.7} />
      <Pot pos={[11.1, 0.55, 8.2]} scale={1.7} />
      <DetailLayer zone="garden">
        {[2.22, 11.78].flatMap((x) =>
          Array.from({ length: 9 }, (_, i) => (
            <group key={`flower-${x}-${i}`} position={[x, 0.91, 2.95 + i * 0.52]}>
              <Cylinder pos={[0, 0.16, 0]} r={0.014} h={0.32} color="#627d4e" />
              <Sphere
                pos={[0, 0.32, 0]}
                scale={[0.085, 0.07, 0.085]}
                color={i % 3 === 0 ? '#e8c991' : i % 2 ? '#f1dfbd' : '#cf9d85'}
              />
            </group>
          )),
        )}
        {[2.5, 11.5].flatMap((x) =>
          Array.from({ length: 8 }, (_, i) => (
            <Sphere
              key={`${x},${i}`}
              pos={[x + Math.sin(i) * 0.12, 4.48, 1.7 + i * 0.95]}
              scale={[0.22, 0.12, 0.38]}
              color={i % 2 ? '#6f8e56' : '#91a36a'}
            />
          )),
        )}
        {Array.from({ length: 9 }, (_, i) => (
          <Box
            key={i}
            pos={[2.6 + i, 0.556, 5]}
            size={[0.012, 0.007, 8]}
            radius={0}
            color="#a5a27d"
          />
        ))}
      </DetailLayer>
    </group>
  );
}

function Courtyard() {
  return (
    <group name="courtyard">
      <Floor zone="courtyard" color="#b8c395" />
      {/* Ground ribbons describe the branch toward the bench and the basin. */}
      {Array.from({ length: 7 }, (_, i) => (
        <Box
          key={`court-path-${i}`}
          pos={[-6.2, 0.496, 3.45 + i * 0.68]}
          size={[0.94, 0.012, 0.51]}
          color={i % 2 ? '#d9d0ad' : '#e2d8b8'}
          radius={0.045}
        />
      ))}
      <Box pos={[-8.17, 0.496, 3.4]} size={[2.65, 0.012, 0.7]} color="#ddd2b1" radius={0.045} />
      <Box pos={[-4.9, 0.496, 7.7]} size={[2.5, 0.012, 0.7]} color="#ddd2b1" radius={0.045} />
      <Box pos={[-6.8, 0.62, 8.67]} size={[8.1, 0.26, 0.48]} color="#beaa82" radius={0.045} />
      <Box pos={[-6.8, 0.755, 8.67]} size={[7.95, 0.012, 0.37]} color="#5f6845" radius={0} />
      {[-11.12, -0.9].map((x) => (
        <group key={`court-border-${x}`}>
          <Box pos={[x, 0.64, 5.53]} size={[0.34, 0.3, 4.45]} color="#b4a47f" radius={0.04} />
          <Box pos={[x, 0.796, 5.53]} size={[0.25, 0.012, 4.3]} color="#526543" radius={0} />
          {[4.2, 5.45, 6.7].map((z, i) => (
            <Sphere
              key={`${x}-${z}`}
              pos={[x, 0.88, z]}
              scale={[0.28, 0.17, 0.42]}
              color={i % 2 ? '#749059' : '#648252'}
            />
          ))}
        </group>
      ))}
      <group position={[-10.6, 0.49, 3.4]} rotation={[0, Math.PI / 2, 0]}>
        <Box pos={[0, 0.55, 0]} size={[2.1, 0.15, 0.6]} color={wood} />
        <Box pos={[0, 0.91, -0.3]} size={[2.1, 0.6, 0.1]} color={wood} />
        {[-0.8, 0.8].map((x) => (
          <Box key={x} pos={[x, 0.27, 0]} size={[0.12, 0.55, 0.55]} color={green} />
        ))}
      </group>
      <Cylinder pos={[-2.2, 0.65, 8]} r={0.92} h={0.3} color="#c5c4a7" />
      <BasinWater />
      <Cylinder pos={[-2.2, 1.1, 8]} r={0.18} h={0.6} color="#b7bda0" />
      <Cylinder pos={[-2.2, 1.41, 8]} r={0.4} h={0.08} color="#d5d3b6" />
      <DetailLayer zone="courtyard">
        {[-11.12, -0.9].flatMap((x) =>
          Array.from({ length: 7 }, (_, i) => (
            <group key={`court-flower-${x}-${i}`} position={[x, 0.8, 3.9 + i * 0.55]}>
              <Cylinder pos={[0, 0.14, 0]} r={0.014} h={0.28} color="#68804e" />
              <Sphere
                pos={[0, 0.29, 0]}
                scale={[0.075, 0.065, 0.075]}
                color={i % 2 ? '#efd5a0' : '#d59389'}
              />
            </group>
          )),
        )}
        {Array.from({ length: 13 }, (_, i) => (
          <group key={i} position={[-10.5 + i * 0.62, 0.49, 8.6]}>
            <Cylinder pos={[0, 0.16, 0]} r={0.02} h={0.32} color="#71894e" />
            <Sphere
              pos={[0, 0.34, 0]}
              scale={[0.12, 0.08, 0.12]}
              color={i % 2 ? '#e1bb73' : '#d99183'}
            />
          </group>
        ))}
      </DetailLayer>
    </group>
  );
}

export const Environment = memo(function Environment() {
  const surfaces = useSurfaceTextures();
  return (
    <group>
      <Landscape />
      <Box
        pos={[0, 0.43, 0.85]}
        size={[27.4, 0.06, 1.7]}
        color="#e0d2b0"
        map={surfaces.stone}
        roughness={0.95}
        radius={0.025}
      />
      <Box
        pos={[0.1, 0.43, 0]}
        size={[1.8, 0.06, 20.5]}
        color="#e0d2b0"
        map={surfaces.stone}
        roughness={0.95}
        radius={0.025}
      />
      {Array.from({ length: 18 }, (_, i) => (
        <Box
          key={i}
          pos={[-12.8 + i * 1.5, 0.465, 0.85]}
          size={[0.025, 0.006, 1.6]}
          color="#c5ba99"
          radius={0}
        />
      ))}
      <Cafe surfaces={surfaces} />
      <Studio woodMap={surfaces.wood} />
      <Garden stoneMap={surfaces.stone} />
      <Courtyard />
      <DriftingLeaves />
      {[
        [-13.6, 0.4, -8.5],
        [-13.7, 0.4, 2.5],
        [-12.7, 0.4, 8.8],
        [13.2, 0.4, -8.5],
        [13.3, 0.4, -3.5],
        [13.3, 0.4, 8.5],
        [-0.1, 0.4, -10],
        [0.1, 0.4, 9.5],
        [7, 0.4, 10.2],
      ].map((p, i) => (
        <Tree
          key={i}
          position={p as [number, number, number]}
          scale={i === 7 ? 0.65 : 0.85 + (i % 2) * 0.15}
          variant={i % 2}
        />
      ))}
      {[-11, -7, -3, 3, 9, 12].map((x, i) => (
        <group key={x}>
          <Sphere
            pos={[x, 0.7, 10.3]}
            scale={[0.85, 0.4, 0.45]}
            color={i % 2 ? '#80995e' : '#5f8251'}
          />
          <Sphere pos={[x + 0.6, 0.6, 10.2]} scale={[0.5, 0.25, 0.35]} color="#90a66b" />
        </group>
      ))}
      <Lamp pos={[-0.9, 0.4, 1.2]} />
      <Lamp pos={[-12.5, 0.4, 1.2]} />
      <Lamp pos={[12.5, 0.4, 0.8]} />
    </group>
  );
});
