import { Suspense, lazy, useLayoutEffect } from 'react';
import { act, createRoot, extend, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { CedarObservatory } from './Observatory';

vi.mock('../../state', () => ({
  useWorld: (select: (state: { quality: string; night: boolean }) => unknown) =>
    select({ quality: 'high', night: false }),
}));
vi.mock('../primitives', () => ({ Box: () => null, Cylinder: () => null, Sign: () => null }));

extend({
  Group: THREE.Group,
  InstancedMesh: THREE.InstancedMesh,
  Mesh: THREE.Mesh,
  CylinderGeometry: THREE.CylinderGeometry,
  ConeGeometry: THREE.ConeGeometry,
  TorusGeometry: THREE.TorusGeometry,
  SphereGeometry: THREE.SphereGeometry,
  CircleGeometry: THREE.CircleGeometry,
  OctahedronGeometry: THREE.OctahedronGeometry,
  MeshStandardMaterial: THREE.MeshStandardMaterial,
});

function firstFrameProbe(onFrame: (scene: THREE.Scene) => void) {
  return function FirstFrame() {
    const scene = useThree((state) => state.scene);
    const advance = useThree((state) => state.advance);
    useLayoutEffect(() => {
      // A render/shadow pass may run after commit layout work, before React's
      // passive effects. Observe exactly the buffers the renderer receives.
      onFrame(scene);
      advance(0, false);
    }, [scene, advance]);
    return null;
  };
}

async function rootFixture() {
  const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
  const gl = {
    render: vi.fn(),
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
  } as unknown as THREE.WebGLRenderer;
  const root = createRoot(canvas);
  await root.configure({
    gl,
    frameloop: 'never',
    size: { width: 100, height: 100, top: 0, left: 0 },
  });
  return { root, gl };
}

describe('asynchronously mounted cedar instancing', () => {
  it('provides colors, matrices and bounds to the first render before passive effects', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const { root, gl } = await rootFixture();
    let sampled: THREE.InstancedMesh[] = [];
    const FirstFrame = firstFrameProbe((scene) => {
      const cedar = scene.getObjectByName('cedar-observatory-fringe')!;
      sampled = cedar.children as THREE.InstancedMesh[];
      const [trunks, boughs] = sampled;
      expect(trunks.instanceMatrix.version).toBeGreaterThan(0);
      expect(boughs.instanceMatrix.version).toBeGreaterThan(0);
      expect(boughs.instanceColor).not.toBeNull();
      expect(boughs.instanceColor!.version).toBeGreaterThan(0);
      expect(
        [...boughs.instanceColor!.array].every((value) => value > 0 && Number.isFinite(value)),
      ).toBe(true);
      expect(boughs.boundingSphere).not.toBeNull();
      expect(boughs.boundingSphere!.center.x).toBeLessThan(-20);
      expect(boughs.boundingSphere!.center.z).toBeLessThan(-40);
      expect(trunks.instanceMatrix.array[12]).toBeCloseTo(-40);
      expect(boughs.count).toBe(12);
    });
    const Arrival = lazy(async () => ({
      default: () => (
        <>
          <CedarObservatory />
          <FirstFrame />
        </>
      ),
    }));
    try {
      await act(async () => {
        root.render(
          <Suspense fallback={null}>
            <Arrival />
          </Suspense>,
        );
      });
      expect(sampled).toHaveLength(2);
      expect(gl.render).toHaveBeenCalled();
      const disposals = sampled.map((mesh) => vi.spyOn(mesh, 'dispose'));
      await act(async () => {
        root.unmount();
      });
      for (const disposal of disposals) expect(disposal).toHaveBeenCalled();
    } finally {
      await act(async () => {
        root.unmount();
      });
      vi.unstubAllGlobals();
    }
  });
});
