import { WorldKit } from './WorldKit';
import * as THREE from 'three';
import { useWorld } from '../../state';
import { OBSERVATORY } from '../layout';
import { terrainHeight } from '../terrain';
import { Cylinder, Sign } from '../primitives';

const CEDAR_SITES: [number, number, number][] = [
  [-40, -56, 1.1],
  [-36, -61, 1.35],
  [-26, -60, 1.2],
  [-21, -57, 1.05],
  [-41, -49, 0.9],
  [-23, -44, 0.95],
];

function CedarFringe() {
  const quality = useWorld((state) => state.quality);
  return (
    <group name="deep-sky-sensor-network">
      {CEDAR_SITES.slice(0, quality === 'high' ? 6 : 4).map(([x, z, size]) => (
        <group key={`${x}:${z}`} position={[x, terrainHeight(x, z), z]} scale={size * 0.85}>
          <WorldKit module="sensor-mast" />
        </group>
      ))}
    </group>
  );
}

function BrassTelescope() {
  return (
    <group name="deep-sky-telescope" position={[-1.25, 0, -1.55]}>
      <WorldKit module="telescope" />
    </group>
  );
}

function ObservatoryTerrace() {
  const ground = terrainHeight(OBSERVATORY.x, OBSERVATORY.z);
  const night = useWorld((state) => state.night);
  const quality = useWorld((state) => state.quality);
  const lanterns: [number, number][] = [
    [-2.55, 1.4],
    [2.55, 1.4],
    [-2.35, -1.75],
    [2.35, -1.75],
  ];
  return (
    <group name="cedar-observatory-arrival" position={[OBSERVATORY.x, ground, OBSERVATORY.z]}>
      <group position={[-1.25, 0, -1.55]}>
        <mesh position={[0, 1.75, 0]} castShadow>
          <torusGeometry args={[2.05, 0.1, 6, 28, Math.PI]} />
          <meshStandardMaterial color="#667b72" metalness={0.18} roughness={0.7} />
        </mesh>
        <Cylinder finish="dusty-alloy" pos={[-2.05, 0.88, 0]} r={0.11} h={1.75} color="#647b71" />
        <Cylinder finish="dusty-alloy" pos={[2.05, 0.88, 0]} r={0.11} h={1.75} color="#647b71" />
      </group>
      <BrassTelescope />
      <Sign
        text="DEEP SKY ARRAY"
        pos={[0, 1.1, -3.0]}
        size={[2.85, 0.49]}
        color="#f2e8c8"
        background="#355b51"
      />
      {lanterns.slice(0, quality === 'high' ? 4 : 2).map(([x, z], index) => (
        <group key={index} position={[x, 0, z]}>
          <Cylinder finish="dusty-alloy" pos={[0, 0.64, 0]} r={0.07} h={1.28} color="#515b6d" />
          <mesh position={[0, 1.29, 0]}>
            <octahedronGeometry args={[0.19, 0]} />
            <meshStandardMaterial
              color="#f4dda2"
              emissive="#e7b86e"
              emissiveIntensity={night ? 1.5 : 0.12}
              roughness={0.55}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function CedarObservatory() {
  return (
    <group name="cedar-observatory">
      <ObservatoryTerrace />
      <CedarFringe />
    </group>
  );
}
