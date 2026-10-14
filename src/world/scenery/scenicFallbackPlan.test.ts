import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EDGES, NODES } from '../navigation';
import { CAMERA_VIEWS, LOOKOUT, OBSERVATORY, ORCHARD } from '../layout';
import { SCENIC_REGIONS } from '../scenicVisibility';
import { renderedTerrainHeight } from '../terrain';
import { AMBER_BLUFF } from './amberPlacement';
import { DAWNLIGHT_GLASSHOUSE } from './dawnlightPlacement';
import { WINDWARD_MILL } from './windwardPlacement';
import { ORCHARD_PAVILION } from './orchardPlacement';
import { WOODLAND_HOLLOW, WOODLAND_SHELTER_XZ } from './woodlandPlacement';
import { NORTHSTAR_OUTPOST, NORTHSTAR_TOWER_XZ } from './northstarPlacement';
import { SLATE_REACH } from './slatePlacement';
import { SCENIC_FALLBACK_PLANS, type ScenicFallbackPlan } from './scenicFallbackPlan';

const shapes = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone: new THREE.ConeGeometry(1, 1, 6),
};

function root(plan: ScenicFallbackPlan) {
  const group = new THREE.Group();
  group.position.set(plan.origin[0], renderedTerrainHeight(...plan.origin), plan.origin[1]);
  group.rotation.y = plan.heading;
  return group;
}

function bounds(plan: ScenicFallbackPlan) {
  const group = root(plan);
  const meshes = plan.parts.map((part) => {
    const mesh = new THREE.Mesh(shapes[part.shape]);
    mesh.position.fromArray(part.position);
    mesh.scale.fromArray(part.scale);
    if (part.rotation) mesh.rotation.fromArray([...part.rotation, 'XYZ']);
    group.add(mesh);
    return mesh;
  });
  group.updateMatrixWorld(true);
  return meshes.map((mesh) => new THREE.Box3().setFromObject(mesh));
}

describe('scenic loading fallback placement', () => {
  it('covers every visibility identity at its existing authored structure coordinates', () => {
    expect(Object.keys(SCENIC_FALLBACK_PLANS).sort()).toEqual(
      SCENIC_REGIONS.map((region) => region.id).sort(),
    );
    const authored = {
      lookout: [LOOKOUT.x, LOOKOUT.z],
      orchard: [ORCHARD_PAVILION.x, ORCHARD_PAVILION.z],
      observatory: [OBSERVATORY.x, OBSERVATORY.z],
      dawnlight: [DAWNLIGHT_GLASSHOUSE.centerX, DAWNLIGHT_GLASSHOUSE.centerZ],
      windward: [WINDWARD_MILL.centerX, WINDWARD_MILL.centerZ],
      amber: [AMBER_BLUFF.x, AMBER_BLUFF.z],
      woodland: WOODLAND_SHELTER_XZ,
      northstar: NORTHSTAR_TOWER_XZ,
      slate: [SLATE_REACH.x, SLATE_REACH.z],
    };
    for (const region of SCENIC_REGIONS) {
      const plan = SCENIC_FALLBACK_PLANS[region.id];
      expect(plan.origin).toEqual(authored[region.id]);
      for (const shape of bounds(plan)) {
        expect(shape.min.x).toBeGreaterThanOrEqual(region.bounds.minX);
        expect(shape.max.x).toBeLessThanOrEqual(region.bounds.maxX);
        expect(shape.min.z).toBeGreaterThanOrEqual(region.bounds.minZ);
        expect(shape.max.z).toBeLessThanOrEqual(region.bounds.maxZ);
      }
      expect(plan.parts.length).toBeLessThanOrEqual(12);
    }
  });

  it('keeps a resident-width corridor open on all navigation edges, including destination approaches', () => {
    const body = new THREE.Sphere(new THREE.Vector3(), 0.55);
    for (const [id, plan] of Object.entries(SCENIC_FALLBACK_PLANS)) {
      const forms = bounds(plan);
      for (const [from, to] of EDGES) {
        const a = new THREE.Vector3(...NODES[from]);
        const b = new THREE.Vector3(...NODES[to]);
        const steps = Math.ceil(a.distanceTo(b) / 0.2);
        for (let step = 0; step <= steps; step++) {
          for (const bodyHeight of [0.55, 1.25, 1.8]) {
            body.center.lerpVectors(a, b, step / steps);
            body.center.y += bodyHeight;
            for (const form of forms) {
              expect(form.intersectsSphere(body), `${id} obstructs ${from} → ${to}`).toBe(false);
            }
          }
        }
      }
    }
  });

  it('preserves a clear view of arriving residents from destination camera bookmarks', () => {
    const landmarks = [
      ['lookout', 'lookout', LOOKOUT],
      ['orchard', 'orchard', ORCHARD],
      ['observatory', 'observatory', OBSERVATORY],
      ['dawnlight', 'dawnlight', DAWNLIGHT_GLASSHOUSE],
      ['windward', 'windward', WINDWARD_MILL],
      ['woodland', 'hollow', WOODLAND_HOLLOW],
      ['northstar', 'northstar', NORTHSTAR_OUTPOST],
    ] as const;
    for (const [id, cameraId, destination] of landmarks) {
      const camera = new THREE.Vector3(...CAMERA_VIEWS[cameraId].pos);
      const arrival = new THREE.Vector3(
        destination.x,
        renderedTerrainHeight(destination.x, destination.z) + 1.3,
        destination.z,
      );
      const line = new THREE.Ray(camera, arrival.clone().sub(camera).normalize());
      for (const form of bounds(SCENIC_FALLBACK_PLANS[id])) {
        const hit = line.intersectBox(form, new THREE.Vector3());
        expect(
          hit && hit.distanceTo(camera) < arrival.distanceTo(camera),
          `${id} hides its arrival`,
        ).toBeFalsy();
      }
    }
  });

  it('does not introduce low slabs or backdrop walls across the arrival clearings', () => {
    for (const plan of Object.values(SCENIC_FALLBACK_PLANS)) {
      for (const form of bounds(plan)) {
        const size = form.getSize(new THREE.Vector3());
        if (form.min.y < renderedTerrainHeight(...plan.origin) + 2.4) {
          // Ground-level boxes are only posts or the two scenic-only landforms.
          const scenicLandform =
            plan === SCENIC_FALLBACK_PLANS.amber || plan === SCENIC_FALLBACK_PLANS.slate;
          if (!scenicLandform && plan !== SCENIC_FALLBACK_PLANS.windward) {
            expect(Math.min(size.x, size.z)).toBeLessThan(1.1);
          }
        }
      }
    }
  });
});
