import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../state';
import { ZONES, type ZoneName } from './layout';
import { showFineDetail } from './detail';

export function DetailLayer({ zone, children }: { zone: ZoneName; children: ReactNode }) {
  const quality = useWorld((s) => s.quality);
  const [visible, setVisible] = useState(false);
  const current = useRef(false);
  const elapsed = useRef(0);
  const scratch = useMemo(() => {
    const { center, size } = ZONES[zone];
    return {
      frustum: new THREE.Frustum(),
      matrix: new THREE.Matrix4(),
      bounds: new THREE.Sphere(new THREE.Vector3(center[0], 2, center[2]), Math.hypot(...size) / 2),
    };
  }, [zone]);
  useFrame(({ camera, size }, delta) => {
    elapsed.current += delta;
    if (elapsed.current < 0.2) return;
    elapsed.current = 0;
    scratch.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    scratch.frustum.setFromProjectionMatrix(scratch.matrix);
    const scale =
      camera instanceof THREE.OrthographicCamera
        ? camera.zoom
        : size.height /
          (2 *
            Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov / 2)) *
            camera.position.distanceTo(scratch.bounds.center));
    const next = showFineDetail(
      current.current,
      scale,
      scratch.frustum.intersectsSphere(scratch.bounds),
      quality,
    );
    if (next !== current.current) {
      current.current = next;
      setVisible(next);
    }
  });
  return visible && quality === 'high' ? (
    <group name={`${zone}-fine-detail`}>{children}</group>
  ) : null;
}
