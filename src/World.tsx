import { districtAt } from './world/hud';
import { ResidentJourney } from './world/journey';
import { NavigationTraffic } from './world/navigation';
import { residentStyle } from './world/personality';
import { dressResident } from './world/appearance';
import { RenderStats } from './world/RenderStats';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Line } from '@react-three/drei';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import type { ComponentRef } from 'react';
type OrbitControlsImpl = ComponentRef<typeof OrbitControls>;
import { useWorld } from './state';
import type { Agent, Status } from './state';
import { SEATS, routeForSeat } from './world/motion';
import { createCharacterClips, ROBOT_SCALE } from './world/rig';
import { Box, Cylinder, Pot } from './world/primitives';
import { Environment } from './world/Environment';
import { CAMERA_VIEWS } from './world/layout';
export { SEATS } from './world/motion';
const statusColors = {
  idle: '#98aaa0',
  working: '#73ad69',
  tool: '#75a6c4',
  waiting: '#e9ae54',
  completed: '#82b76a',
  failed: '#d66c65',
  disconnected: '#9f9ca7',
  unknown: '#8a9784',
};
function Laptop({ status }: { status?: Status }) {
  const active = !!status && ['working', 'tool', 'waiting', 'failed'].includes(status);
  const screenColor =
    status === 'waiting'
      ? '#f0cb78'
      : status === 'failed'
        ? '#e79a85'
        : status === 'tool'
          ? '#b2d4ea'
          : '#b6e6b0';
  const lid = useRef<THREE.Group>(null);
  const reduce = useWorld((s) => s.reducedMotion);
  useFrame((_, d) => {
    if (lid.current)
      lid.current.rotation.x = THREE.MathUtils.damp(
        lid.current.rotation.x,
        active ? -0.16 : -1.48,
        reduce ? 100 : 5,
        d,
      );
  });
  return (
    <group position={[0, 1.02, -0.08]}>
      <Box size={[0.73, 0.035, 0.5]} color="#475854" radius={0.02} />
      <Box pos={[0, 0.022, -0.02]} size={[0.57, 0.009, 0.25]} color="#2d3d37" radius={0.01} />
      {[0, 1, 2, 3].map((i) => (
        <Box
          key={i}
          pos={[0, 0.029, -0.105 + i * 0.055]}
          size={[0.51, 0.005, 0.008]}
          color="#7b9186"
          radius={0.001}
        />
      ))}
      <group ref={lid} position={[0, 0.01, 0.24]} rotation={[-0.16, 0, 0]}>
        <Box pos={[0, 0.23, 0]} size={[0.73, 0.46, 0.035]} color="#526862" radius={0.025} />
        <mesh position={[0, 0.23, -0.022]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.64, 0.37]} />
          <meshStandardMaterial
            color={active ? screenColor : '#334940'}
            emissive={active ? '#74c99a' : '#000000'}
            emissiveIntensity={0.25}
          />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => (
          <Box
            key={i}
            pos={[-0.05 + Math.sin(i) * 0.05, 0.35 - i * 0.058, -0.025]}
            size={[0.32 + (i % 2) * 0.13, 0.012, 0.002]}
            color={active ? '#416f60' : '#334940'}
            radius={0}
          />
        ))}
      </group>
    </group>
  );
}
function Desk({ seat, status }: { seat: number; status?: Status }) {
  return (
    <group position={SEATS[seat % 8]}>
      <Box pos={[0, 0.96, 0.2]} size={[1.6, 0.13, 1]} color="#c99b68" radius={0.09} />
      {[-0.63, 0.63].map((x) => (
        <group key={x}>
          <Cylinder pos={[x, 0.48, 0.52]} r={0.045} h={0.9} color="#475447" />
          <Cylinder pos={[x, 0.48, -0.13]} r={0.045} h={0.9} color="#475447" />
        </group>
      ))}
      <Laptop status={status} />
      <Cylinder pos={[0.56, 1.095, 0.11]} r={0.1} h={0.19} color="#f2e7ca" />
      <Cylinder pos={[0.56, 1.2, 0.11]} r={0.085} h={0.008} color="#694931" />
      <Pot pos={[-0.61, 1.04, 0.5]} scale={0.42} />
      <Box pos={[0, 0.5, -0.69]} size={[0.73, 0.12, 0.66]} color="#738671" radius={0.1} />
      <Box pos={[0, 0.83, -0.98]} size={[0.73, 0.55, 0.1]} color="#738671" radius={0.09} />
      {[-0.27, 0.27].map((x) => (
        <group key={x}>
          <Cylinder pos={[x, 0.24, -0.89]} r={0.035} h={0.5} />
          <Cylinder pos={[x, 0.24, -0.45]} r={0.035} h={0.5} />
        </group>
      ))}
    </group>
  );
}
type Positions = Map<string, THREE.Vector3>;
function Resident({
  agent,
  leaving,
  onExit,
  clips,
  positions,
  traffic,
}: {
  agent: Agent;
  leaving: boolean;
  onExit: () => void;
  clips: THREE.AnimationClip[];
  positions: Positions;
  traffic: NavigationTraffic;
}) {
  const { scene } = useGLTF('/models/robot.glb');
  const style = useMemo(() => residentStyle(agent.id), [agent.id]);
  const dressed = useMemo(() => {
    const copy = clone(scene);
    copy.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        const cloned = materials.map((m) => {
          const mat = m.clone() as THREE.MeshStandardMaterial;
          if (mat.name === 'Main') mat.color.set(agent.color);
          if (mat.name === 'Grey') mat.color.set(style.trim);
          if (mat.name === 'Black') mat.color.set('#253c36');
          mat.roughness = 0.62;
          mat.transparent = true;
          return mat;
        });
        o.material = Array.isArray(o.material) ? cloned : cloned[0];
      }
    });
    const wardrobe = dressResident(copy, style);
    return { copy, wardrobe };
  }, [scene, agent.color, style]);
  const model = dressed.copy;
  const materials = useMemo(() => {
    const all: THREE.Material[] = [];
    model.traverse((o) => {
      if (o instanceof THREE.Mesh)
        all.push(...(Array.isArray(o.material) ? o.material : [o.material]));
    });
    return [...new Set(all)];
  }, [model]);
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  const active = useRef<THREE.AnimationAction | null>(null);
  const currentClip = useRef('');
  const motion = useMemo(
    () => new ResidentJourney(agent.seat, agent.id, traffic),
    [agent.seat, agent.id, traffic],
  );
  useEffect(() => () => motion.dispose(), [motion]);
  const outings = useWorld((s) => s.residentOutings);
  const root = useRef<THREE.Group>(null);
  const worldPosition = useMemo(() => new THREE.Vector3(), []);
  const exited = useRef(false);
  const selected = useWorld((s) => s.selected === agent.id);
  const select = useWorld((s) => s.select);
  const labels = useWorld((s) => s.labels);
  const watch = useWorld((s) => s.watchMode);
  const reduced = useWorld((s) => s.reducedMotion);
  const playback = useWorld((s) =>
    s.mode === 'live' ? s.bridgeStatus === 'connected' : s.playing,
  );
  const playing = playback && !agent.telemetryStale;
  useEffect(() => {
    active.current = null;
    currentClip.current = '';
    return () => {
      positions.delete(agent.id);
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      materials.forEach((m) => {
        if (!m.userData.wardrobe) m.dispose();
      });
      dressed.wardrobe.dispose();
      const skeletons = new Set<THREE.Skeleton>();
      model.traverse((o) => {
        if (o instanceof THREE.SkinnedMesh) skeletons.add(o.skeleton);
      });
      skeletons.forEach((skeleton) => skeleton.dispose());
    };
  }, [agent.id, materials, mixer, model, positions, dressed]);
  useFrame((_, delta) => {
    if (!root.current) return;
    motion.update(agent, delta, { reduced, playing, leaving, now: Date.now(), outings });
    root.current.position.fromArray(motion.position);
    root.current.rotation.y = motion.facing;
    positions.set(agent.id, worldPosition.copy(root.current.position));
    for (const material of materials) material.opacity = motion.opacity;
    const name = motion.clip(agent);
    if (name !== currentClip.current) {
      const clip = clips.find((c) => c.name === name)!;
      active.current?.fadeOut(reduced ? 0 : 0.45);
      const next = mixer.clipAction(clip);
      next
        .reset()
        .setLoop(THREE.LoopRepeat, Infinity)
        .fadeIn(reduced ? 0 : 0.45)
        .play();
      active.current = next;
      currentClip.current = name;
      if (reduced) mixer.update(0);
    }
    if (active.current) active.current.timeScale = name === 'Walking' ? style.pace / 1.05 : 1;
    mixer.update(reduced || (!playing && !leaving) ? 0 : Math.min(delta, 0.05));
    if (motion.exited && !exited.current) {
      exited.current = true;
      onExit();
    }
    if (!leaving) exited.current = false;
  });
  return (
    <group
      ref={root}
      position={motion.position}
      onClick={(e) => {
        e.stopPropagation();
        if (!leaving) select(agent.id);
      }}
      onPointerOver={() => {
        document.body.style.cursor = leaving ? 'auto' : 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
      }}
    >
      <primitive object={model} scale={ROBOT_SCALE} dispose={null} />
      {selected && !leaving && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
          <ringGeometry args={[0.63, 0.69, 48]} />
          <meshBasicMaterial color="#f8d888" transparent opacity={0.95} />
        </mesh>
      )}
      {!leaving && ((labels && !watch) || selected) && (
        <WorldLabel agent={agent} selected={selected} height={2.05} motion={motion} />
      )}
    </group>
  );
}
// A seat hands over only after its previous character departs: at most eight rigs, even during churn.
function ResidentSlot({
  desired,
  clips,
  positions,
  traffic,
}: {
  desired?: Agent;
  clips: THREE.AnimationClip[];
  positions: Positions;
  traffic: NavigationTraffic;
}) {
  const [occupant, setOccupant] = useState(desired);
  const latest = useRef(desired);
  latest.current = desired;
  const lastAgent = useRef(occupant);
  if (desired?.id === occupant?.id) lastAgent.current = desired;
  const leaving = !!occupant && occupant.id !== desired?.id;
  useEffect(() => {
    if (!occupant && desired) setOccupant(desired);
  }, [occupant, desired]);
  if (!occupant) return null;
  return (
    <Resident
      key={occupant.id}
      agent={leaving ? lastAgent.current! : desired!}
      leaving={leaving}
      onExit={() => setOccupant(latest.current)}
      clips={clips}
      positions={positions}
      traffic={traffic}
    />
  );
}
function WorldLabel({
  agent,
  selected,
  height,
  motion,
}: {
  agent: Agent;
  selected: boolean;
  height: number;
  motion: ResidentJourney;
}) {
  const anchor = useRef<THREE.Group>(null);
  const element = useRef<HTMLButtonElement | null>(null);
  const point = useMemo(() => new THREE.Vector3(), []);
  const { gl, camera, size } = useThree();
  useEffect(() => {
    const button = document.createElement('button');
    button.style.position = 'absolute';
    button.style.left = '0';
    button.style.top = '0';
    button.style.zIndex = '20';
    button.style.pointerEvents = 'auto';
    button.style.visibility = 'hidden';
    const click = (e: MouseEvent) => {
      e.stopPropagation();
      useWorld.getState().select(agent.id);
    };
    button.addEventListener('click', click);
    gl.domElement.parentElement?.appendChild(button);
    element.current = button;
    return () => {
      button.removeEventListener('click', click);
      button.remove();
    };
  }, [gl, agent.id]);
  useEffect(() => {
    const button = element.current;
    if (!button) return;
    button.className = 'world-label ' + (selected ? 'is-selected' : '');
    button.title = agent.name;
    button.replaceChildren();
    const dot = document.createElement('i');
    dot.style.background = statusColors[agent.status];
    button.append(dot, document.createTextNode(agent.name));
    if (selected) {
      const activity = document.createElement('small');
      activity.className = 'resident-location';
      button.append(activity);
    }
    if (agent.status === 'waiting' || agent.status === 'failed') {
      const alert = document.createElement('span');
      alert.textContent = '!';
      button.append(alert);
    }
  }, [agent.name, agent.status, selected]);
  useFrame(() => {
    if (!anchor.current || !element.current) return;
    element.current.dataset.behavior = motion.moving ? 'walking' : motion.clip(agent);
    element.current.dataset.seat = String(agent.seat);
    element.current.dataset.destination = motion.activity;
    const detail = element.current.querySelector('small');
    if (detail && detail.textContent !== motion.activity) detail.textContent = motion.activity;
    element.current.title = `${agent.name} — ${motion.activity} (visual activity)`;
    anchor.current.updateWorldMatrix(true, false);
    point.setFromMatrixPosition(anchor.current.matrixWorld).project(camera);
    element.current.style.visibility =
      Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && point.z < 1 ? 'visible' : 'hidden';
    element.current.style.transform = `translate(${((point.x + 1) * size.width) / 2}px,${((1 - point.y) * size.height) / 2}px) translate(-50%,-50%)`;
  });
  return <group ref={anchor} position={[0, height, 0]} />;
}
function Residents({ positions }: { positions: Positions }) {
  const { scene, animations } = useGLTF('/models/robot.glb');
  const clips = useMemo(() => createCharacterClips(scene, animations), [scene, animations]);
  const agents = useWorld((s) => s.agents);
  const traffic = useMemo(() => new NavigationTraffic(), []);
  return (
    <>
      {Array.from({ length: 8 }, (_, i) => (
        <Desk key={i} seat={i} status={agents.find((a) => a.seat === i)?.status} />
      ))}
      {SEATS.map((_, seat) => (
        <ResidentSlot
          key={seat}
          desired={agents.find((a) => a.seat === seat)}
          clips={clips}
          positions={positions}
          traffic={traffic}
        />
      ))}
      {SEATS.map((_, seat) => {
        const p = routeForSeat(seat)[1];
        return (
          <mesh
            key={`rest-${seat}`}
            position={[p[0], p[1] + 0.006, p[2]]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <circleGeometry args={[0.47, 24]} />
            <meshStandardMaterial color="#c8c29f" roughness={1} />
          </mesh>
        );
      })}
      {agents
        .filter((a) => a.parentId && a.seat < 8)
        .map((a) => {
          const parent = agents.find((p) => p.id === a.parentId);
          if (!parent || parent.seat >= 8) return null;
          const p = SEATS[parent.seat],
            q = SEATS[a.seat];
          return (
            <Line
              key={a.id + 'link'}
              points={[
                [p[0], p[1] + 0.12, p[2] - 0.7],
                [(p[0] + q[0]) / 2, 2.4, (p[2] + q[2]) / 2],
                [q[0], q[1] + 0.12, q[2] - 0.7],
              ]}
              color="#e3c774"
              lineWidth={1.5}
              dashed
              dashSize={0.2}
              gapSize={0.15}
              transparent
              opacity={0.7}
            />
          );
        })}
    </>
  );
}
function Camera({ positions }: { positions: Positions }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const view = useWorld((s) => s.camera);
  const version = useWorld((s) => s.cameraVersion);
  const cinematic = useWorld((s) => s.cinematic);
  const follow = useWorld((s) => s.followAgent);
  const followVisible = useWorld(
    (s) => !!s.followAgent && s.agents.some((a) => a.id === s.followAgent && a.seat < 8),
  );
  useEffect(() => {
    if (follow && !followVisible) useWorld.setState({ followAgent: null });
  }, [follow, followVisible]);
  const reduced = useWorld((s) => s.reducedMotion);
  const { camera, size, set } = useThree();
  // Canvas owns this orthographic camera for its whole lifetime. Only Horizon
  // swaps the active camera; the Canvas, residents, and scenery stay mounted.
  const orthographic = useRef(camera as THREE.OrthographicCamera);
  const perspective = useMemo(() => new THREE.PerspectiveCamera(48, 1, 0.1, 420), []);
  const activeCamera = view === 'horizon' ? perspective : orthographic.current;
  const orthographicLook = useRef(new THREE.Vector3());
  const switchingCamera = useRef(false);
  const moving = useRef(true);
  const targetPos = useRef(new THREE.Vector3());
  const targetLook = useRef(new THREE.Vector3());
  const zoom = useRef(30);
  useLayoutEffect(() => {
    // Fiber resizes only its active camera. Keep the parked orthographic
    // projection current too, so returning from Horizon after a resize works.
    const ortho = orthographic.current;
    ortho.left = -size.width / 2;
    ortho.right = size.width / 2;
    ortho.top = size.height / 2;
    ortho.bottom = -size.height / 2;
    ortho.updateProjectionMatrix();
    perspective.aspect = size.width / size.height;
    perspective.updateProjectionMatrix();
  }, [perspective, size.width, size.height]);
  useLayoutEffect(() => {
    if (camera === activeCamera) return;
    if (view === 'horizon') {
      perspective.position.fromArray(CAMERA_VIEWS.horizon.pos);
      perspective.lookAt(new THREE.Vector3(...CAMERA_VIEWS.horizon.look));
    }
    switchingCamera.current = true;
    set({ camera: activeCamera });
  }, [activeCamera, camera, perspective, set, view]);
  useLayoutEffect(() => {
    if (!switchingCamera.current || camera !== activeCamera || !controls.current) return;
    controls.current.target.copy(
      view === 'horizon'
        ? new THREE.Vector3(...CAMERA_VIEWS.horizon.look)
        : orthographicLook.current,
    );
    controls.current.update();
    switchingCamera.current = false;
  }, [activeCamera, camera, view]);
  useEffect(() => {
    const preset = CAMERA_VIEWS[view];
    zoom.current = Math.min(size.width / preset.span[0], size.height / preset.span[1]);
    targetPos.current.fromArray(preset.pos);
    targetLook.current.fromArray(preset.look);
    moving.current = true;
  }, [view, version]);
  useEffect(() => {
    if (view === 'horizon' || useWorld.getState().followAgent) return;
    const preset = CAMERA_VIEWS[view];
    zoom.current = Math.min(size.width / preset.span[0], size.height / preset.span[1]);
    moving.current = true;
  }, [view, size.width, size.height]);
  useFrame((_, d) => {
    const point = follow && followVisible ? positions.get(follow) : null;
    if (point) {
      targetLook.current.set(point.x, point.y + 1, point.z);
      targetPos.current.set(point.x + 5, point.y + 8.5, point.z + 7);
      zoom.current = Math.min(size.width / 10, size.height / 8);
      moving.current = true;
    }
    if (moving.current && controls.current) {
      const alpha = reduced ? 1 : 1 - Math.exp(-4 * d);
      camera.position.lerp(targetPos.current, alpha);
      controls.current.target.lerp(targetLook.current, alpha);
      if (camera instanceof THREE.OrthographicCamera)
        camera.zoom = THREE.MathUtils.lerp(camera.zoom, zoom.current, alpha);
      camera.updateProjectionMatrix();
      controls.current.update();
      if (
        camera.position.distanceTo(targetPos.current) < 0.02 &&
        controls.current.target.distanceTo(targetLook.current) < 0.02 &&
        (!(camera instanceof THREE.OrthographicCamera) ||
          Math.abs(camera.zoom - zoom.current) < 0.02)
      )
        moving.current = false;
    }
    if (controls.current) {
      if (camera === orthographic.current) orthographicLook.current.copy(controls.current.target);
      const location = districtAt(controls.current.target.x, controls.current.target.z);
      if (useWorld.getState().worldLocation !== location)
        useWorld.setState({ worldLocation: location });
    }
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.07}
      maxPolarAngle={view === 'horizon' ? Math.PI / 2 + 0.13 : Math.PI / 2.12}
      minPolarAngle={0.2}
      minZoom={5}
      maxZoom={150}
      minDistance={5}
      maxDistance={190}
      autoRotate={cinematic && !reduced && !follow}
      autoRotateSpeed={0.35}
      onStart={() => {
        moving.current = false;
        useWorld.setState({ cinematic: false, followAgent: null });
      }}
    />
  );
}
function Lighting() {
  const quality = useWorld((s) => s.quality);
  const night = useWorld((s) => s.night);
  return (
    <>
      <fog attach="fog" args={[night ? '#263a43' : '#d8dfd0', 85, 165]} />
      <ambientLight intensity={night ? 0.55 : 0.85} color={night ? '#a2b6ed' : '#fff8e7'} />
      <hemisphereLight args={[night ? '#849ccf' : '#e8f0e0', '#849970', night ? 0.7 : 1.25]} />
      <directionalLight
        position={[-10, 20, 12]}
        intensity={night ? 0.7 : 2.8}
        color={night ? '#b2bff0' : '#ffe6b0'}
        castShadow
        shadow-mapSize={quality === 'low' ? [512, 512] : [2048, 2048]}
        shadow-camera-left={-23}
        shadow-camera-right={23}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-bias={-0.0003}
        shadow-normalBias={0.015}
        shadow-radius={2}
      />
      <directionalLight position={[10, 8, -8]} intensity={night ? 0.55 : 1} color="#b2d5d0" />
    </>
  );
}
export default function World() {
  const quality = useWorld((s) => s.quality);
  const mode = useWorld((s) => s.mode);
  const positions = useMemo<Positions>(() => new Map(), []);
  return (
    <Canvas
      orthographic
      shadows
      dpr={quality === 'low' ? 1 : [1, 1.6]}
      camera={{ position: [27, 26, 35], zoom: 30, near: 0.1, far: 360 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => useWorld.getState().select(null)}
    >
      <Lighting />
      <Environment />
      <Suspense fallback={null}>
        <Residents key={mode} positions={positions} />
      </Suspense>
      <Camera positions={positions} />
      {new URLSearchParams(window.location.search).get('renderStats') === '1' && <RenderStats />}
    </Canvas>
  );
}
useGLTF.preload('/models/robot.glb');
