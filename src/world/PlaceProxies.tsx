import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../state';
import type { ResidentPosition } from './mapSnapshot';
import {
  PLACE_LAYER,
  PLACES,
  pickPlace,
  placeById,
  placeResidents,
  placeTagVisible,
  publishPlaceResidents,
  type PlaceShape,
} from './places';

// Pick proxies for the places you can click. They sit on PLACE_LAYER, which no
// camera renders and no shadow pass sees; the raycaster is told to test it.
// One handler set on the group reads every hit and keeps the most specific
// proxy, so a machine wins over the landmark around it, and a resident under
// the pointer always wins over any place.

const BOX = new THREE.BoxGeometry(1, 1, 1);
const DISC = new THREE.CylinderGeometry(1, 1, 1, 28);
const PROXY_MATERIAL = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });

/** One pick volume: on PLACE_LAYER so the raycaster finds it and no camera draws it. */
export function proxyMesh(shape: PlaceShape, placeId: string, index: number) {
  const mesh = new THREE.Mesh(shape.kind === 'box' ? BOX : DISC, PROXY_MATERIAL);
  if (shape.kind === 'box') {
    mesh.position.set(
      (shape.minX + shape.maxX) / 2,
      shape.y + shape.height / 2,
      (shape.minZ + shape.maxZ) / 2,
    );
    mesh.scale.set(shape.maxX - shape.minX, shape.height, shape.maxZ - shape.minZ);
  } else {
    mesh.position.set(shape.x, shape.y + shape.height / 2, shape.z);
    mesh.scale.set(shape.radius, shape.height, shape.radius);
  }
  mesh.layers.set(PLACE_LAYER);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  mesh.userData.placeId = placeId;
  mesh.name = `place-proxy-${placeId}-${index}`;
  return mesh;
}

type Hit = { eventObject: THREE.Object3D; object: THREE.Object3D };
/** The place under the pointer, or null when a resident is under it too. */
export function placeUnderPointer(intersections: readonly Hit[]) {
  if (intersections.some((hit) => hit.eventObject.userData.resident)) return null;
  const ids: string[] = [];
  for (const hit of intersections) {
    const id = hit.object.userData.placeId;
    if (typeof id === 'string') ids.push(id);
  }
  return pickPlace(ids);
}

export function PlaceProxies({ positions }: { positions: ReadonlyMap<string, ResidentPosition> }) {
  const { raycaster, gl, camera, size } = useThree();
  const open = useWorld((s) => s.place);
  const watch = useWorld((s) => s.watchMode);
  const [hovered, setHovered] = useState<string | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const tag = useRef<HTMLSpanElement | null>(null);
  const point = useMemo(() => new THREE.Vector3(), []);
  const lastPublish = useRef(Number.NEGATIVE_INFINITY);
  const meshes = useMemo(
    () =>
      PLACES.flatMap((place) =>
        place.shapes.map((shape, index) => proxyMesh(shape, place.id, index)),
      ),
    [],
  );
  useEffect(() => {
    raycaster.layers.enable(PLACE_LAYER);
    return () => {
      raycaster.layers.disable(PLACE_LAYER);
    };
  }, [raycaster]);
  useEffect(() => {
    const element = document.createElement('span');
    element.className = 'place-tag';
    element.setAttribute('aria-hidden', 'true');
    element.style.visibility = 'hidden';
    gl.domElement.parentElement?.appendChild(element);
    tag.current = element;
    return () => {
      element.remove();
      tag.current = null;
    };
  }, [gl]);
  useEffect(() => {
    const element = tag.current;
    const place = placeById(hovered);
    if (!element || !place) return;
    element.replaceChildren();
    element.append(document.createTextNode(place.name));
    const hint = document.createElement('small');
    hint.textContent = place.kind === 'machine' ? 'Machine' : 'Click to inspect';
    element.append(hint);
  }, [hovered]);
  useEffect(() => {
    if (!open) publishPlaceResidents([]);
    lastPublish.current = Number.NEGATIVE_INFINITY;
  }, [open]);
  useEffect(() => {
    if (watch && hoveredRef.current) {
      hoveredRef.current = null;
      setHovered(null);
      document.body.style.cursor = 'auto';
    }
  }, [watch]);
  useFrame(({ clock }) => {
    const element = tag.current;
    if (element) {
      const place = placeById(hoveredRef.current);
      const show =
        !!place && placeTagVisible({ hovered: hoveredRef.current, open, watchMode: watch });
      if (show && place) {
        point.fromArray(place.anchor).project(camera);
        const onScreen = Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && point.z < 1;
        element.style.visibility = onScreen ? 'visible' : 'hidden';
        element.style.transform = `translate(${((point.x + 1) * size.width) / 2}px,${((1 - point.y) * size.height) / 2}px) translate(-50%,-100%)`;
      } else element.style.visibility = 'hidden';
    }
    const place = placeById(open);
    if (!place) return;
    const now = clock.elapsedTime * 1000;
    if (now - lastPublish.current < 250) return;
    lastPublish.current = now;
    publishPlaceResidents(placeResidents(place, useWorld.getState().agents, positions));
  });
  const update = (id: string | null) => {
    if (id === hoveredRef.current) return;
    hoveredRef.current = id;
    setHovered(id);
  };
  return (
    <group
      name="place-proxies"
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        if (watch) return;
        const place = placeUnderPointer(e.intersections);
        update(place?.id ?? null);
        if (place) document.body.style.cursor = 'pointer';
        else if (!e.intersections.some((hit) => hit.eventObject.userData.resident))
          document.body.style.cursor = 'auto';
      }}
      onPointerOut={() => {
        update(null);
        document.body.style.cursor = 'auto';
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        // A drag that happens to start and end on a proxy is an orbit, not a click.
        if (watch || e.delta > 3) return;
        const place = placeUnderPointer(e.intersections);
        if (!place) return;
        e.stopPropagation();
        const world = useWorld.getState();
        world.select(null);
        world.setPlace(place.id);
      }}
    >
      {meshes.map((mesh) => (
        <primitive key={mesh.name} object={mesh} />
      ))}
    </group>
  );
}
