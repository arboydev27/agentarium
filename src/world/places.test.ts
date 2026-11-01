import { describe, expect, it } from 'vitest';
import { initialAgents } from '../state';
import { CAMERA_VIEWS, SEATS, WORLD_VIEWS, ZONES, type ZoneName } from './layout';
import type { ResidentPosition } from './mapSnapshot';
import { DESTINATIONS, NODES } from './navigation';
import {
  cameraAtPlace,
  getPlaceResidents,
  pickPlace,
  placeById,
  placeContains,
  placeForView,
  placeResidents,
  PLACES,
  placeTagVisible,
  publishPlaceResidents,
  shapeContains,
  subscribePlaceResidents,
} from './places';

const zones = Object.keys(ZONES) as ZoneName[];

describe('place registry', () => {
  it('gives every preset but Overview and Horizon a place containing its look point', () => {
    for (const view of WORLD_VIEWS) {
      const place = placeForView(view);
      if (view === 'horizon' || view === 'overview') {
        expect(place).toBeUndefined();
        continue;
      }
      expect(place, view).toBeDefined();
      const [x, , z] = CAMERA_VIEWS[view].look;
      expect(placeContains(place!, x, z), `${view} look point`).toBe(true);
    }
  });
  it('has unique ids, authored copy and positive volumes', () => {
    expect(new Set(PLACES.map((place) => place.id)).size).toBe(PLACES.length);
    for (const place of PLACES) {
      expect(place.name.length).toBeGreaterThan(2);
      expect(place.role.length).toBeGreaterThan(10);
      expect(place.does.length).toBeGreaterThan(10);
      expect(place.area).toBeGreaterThan(0);
      for (const shape of place.shapes) {
        expect(shape.height).toBeGreaterThan(0);
        if (shape.kind === 'box') {
          expect(shape.maxX).toBeGreaterThan(shape.minX);
          expect(shape.maxZ).toBeGreaterThan(shape.minZ);
        } else expect(shape.radius).toBeGreaterThan(0);
      }
      expect(placeContains(place, place.focus.x, place.focus.z)).toBe(true);
      expect(placeContains(place, place.anchor[0], place.anchor[2])).toBe(true);
      if (place.parent) {
        const parent = placeById(place.parent)!;
        expect(parent.kind).not.toBe('machine');
        expect(placeContains(parent, place.focus.x, place.focus.z)).toBe(true);
        expect(place.area).toBeLessThan(parent.area);
        expect(place.view).toBe(parent.view);
      }
    }
  });
  it('maps each module to its deck and its seats, and keeps seats out of every other place', () => {
    for (const zone of zones) {
      const place = placeById(zone)!;
      expect(place.kind).toBe('module');
      expect([...place.seats].sort()).toEqual([...ZONES[zone].seats].sort());
      for (const seat of ZONES[zone].seats) {
        const [x, , z] = SEATS[seat];
        expect(placeContains(place, x, z)).toBe(true);
      }
    }
    for (const place of PLACES) {
      if (place.kind === 'module') continue;
      expect(place.seats).toEqual([]);
      for (const [x, , z] of SEATS) expect(placeContains(place, x, z), place.id).toBe(false);
    }
  });
  it('derives the rest spots inside each place from the authored destinations', () => {
    const outside = new Set(['meadow:rest-west', 'meadow:rest-east', 'promenade']);
    for (const destination of DESTINATIONS) {
      const [x, , z] = NODES[destination.node];
      const homes = PLACES.filter(
        (place) => place.kind !== 'machine' && placeContains(place, x, z),
      );
      if (outside.has(destination.id)) {
        expect(homes, destination.id).toEqual([]);
        continue;
      }
      expect(
        homes.map((place) => place.id),
        destination.id,
      ).toHaveLength(1);
      expect(homes[0].destinations).toContain(destination.id);
      expect(homes[0].spots).toContain(destination.label);
    }
    expect(placeById('café')!.spots).toEqual(['habitat service station', 'habitat viewport']);
    expect(placeById('garden')!.spots).toEqual(['resource lab']);
    expect(placeById('amber')!.spots).toEqual([]);
    for (const place of PLACES) if (place.kind === 'machine') expect(place.spots).toEqual([]);
  });
  it('picks the most specific proxy under the pointer', () => {
    expect(pickPlace(['northstar', 'northstar:rocket'])?.id).toBe('northstar:rocket');
    expect(pickPlace(['courtyard:dish', 'courtyard'])?.id).toBe('courtyard:dish');
    expect(pickPlace(['observatory'])?.id).toBe('observatory');
    expect(pickPlace(['nowhere'])).toBeNull();
    expect(pickPlace([])).toBeNull();
    expect(
      shapeContains({ kind: 'box', minX: 0, maxX: 2, minZ: 0, maxZ: 2, y: 0, height: 1 }, 2, 2),
    ).toBe(true);
    expect(shapeContains({ kind: 'disc', x: 0, z: 0, radius: 1, y: 0, height: 1 }, 0.8, 0.8)).toBe(
      false,
    );
  });
  it('knows when the camera already frames a place', () => {
    const commons = placeById('café')!;
    expect(cameraAtPlace(commons, { view: 'café', customized: false, following: false })).toBe(
      true,
    );
    expect(cameraAtPlace(commons, { view: 'café', customized: true, following: false })).toBe(
      false,
    );
    expect(cameraAtPlace(commons, { view: 'café', customized: false, following: true })).toBe(
      false,
    );
    expect(cameraAtPlace(commons, { view: 'garden', customized: false, following: false })).toBe(
      false,
    );
  });
});

describe('hover tags', () => {
  it('hide in watch mode and for the place already open', () => {
    expect(placeTagVisible({ hovered: 'café', open: null, watchMode: false })).toBe(true);
    expect(placeTagVisible({ hovered: 'café', open: null, watchMode: true })).toBe(false);
    expect(placeTagVisible({ hovered: 'café', open: 'café', watchMode: false })).toBe(false);
    expect(placeTagVisible({ hovered: 'café', open: 'garden', watchMode: false })).toBe(true);
    expect(placeTagVisible({ hovered: null, open: null, watchMode: false })).toBe(false);
  });
});

describe('who is here', () => {
  const agents = initialAgents();
  const at = (seat: number, x: number, z: number, activity: string): ResidentPosition => ({
    point: { x, y: 0.6, z },
    seat,
    activity,
  });
  it('lists residents inside the place first, then those based at its desks but away', () => {
    const positions = new Map<string, ResidentPosition>([
      [agents[0].id, at(0, SEATS[0][0], SEATS[0][2], 'At desk')],
      [agents[1].id, at(1, 13.5, -38, 'Resting at survey lookout')],
      [agents[2].id, at(2, -2.4, -5.5, 'Resting at habitat viewport')],
      [agents[3].id, at(3, SEATS[3][0], SEATS[3][2], 'At desk')],
    ]);
    const commons = placeResidents(placeById('café')!, agents, positions);
    expect(commons.map((r) => [r.name, r.here, r.based, r.activity])).toEqual([
      ['Milo', true, true, 'At desk'],
      ['Atlas', true, false, 'Resting at habitat viewport'],
      ['Juniper', false, true, 'Resting at survey lookout'],
    ]);
    const lookout = placeResidents(placeById('lookout')!, agents, positions);
    expect(lookout.map((r) => r.name)).toEqual(['Juniper']);
    expect(placeResidents(placeById('northstar:rocket')!, agents, positions)).toEqual([]);
    // A departing rig that still reports its old seat produces no row.
    positions.set(agents[0].id, at(5, SEATS[0][0], SEATS[0][2], 'Leaving the colony'));
    expect(placeResidents(placeById('café')!, agents, positions).map((r) => r.name)).toEqual([
      'Atlas',
      'Juniper',
    ]);
  });
  it('publishes changes only when a row differs', () => {
    let notified = 0;
    const unsubscribe = subscribePlaceResidents(() => notified++);
    const row = { id: 'a', name: 'A', seat: 0, activity: 'At desk', here: true, based: true };
    publishPlaceResidents([row]);
    publishPlaceResidents([{ ...row }]);
    expect(notified).toBe(1);
    expect(getPlaceResidents()).toEqual([row]);
    publishPlaceResidents([{ ...row, activity: 'Near desk' }]);
    expect(notified).toBe(2);
    publishPlaceResidents([]);
    publishPlaceResidents([]);
    expect(notified).toBe(3);
    expect(getPlaceResidents()).toEqual([]);
    unsubscribe();
  });
});

describe('pick proxies', () => {
  it('are hit by a ray from each preset camera to its look point, and never rendered', async () => {
    const THREE = await import('three');
    const { PLACE_LAYER } = await import('./places');
    const { placeUnderPointer, proxyMesh } = await import('./PlaceProxies');
    const camera = new THREE.PerspectiveCamera();
    const raycaster = new THREE.Raycaster();
    const meshes = PLACES.flatMap((place) =>
      place.shapes.map((shape, index) => proxyMesh(shape, place.id, index)),
    );
    for (const mesh of meshes) {
      mesh.updateMatrixWorld(true);
      expect(camera.layers.test(mesh.layers)).toBe(false);
      expect(mesh.castShadow).toBe(false);
      expect(raycaster.layers.test(mesh.layers)).toBe(false);
    }
    raycaster.layers.enable(PLACE_LAYER);
    for (const view of WORLD_VIEWS) {
      const place = placeForView(view);
      if (!place) continue;
      const origin = new THREE.Vector3(...CAMERA_VIEWS[view].pos);
      const look = new THREE.Vector3(...CAMERA_VIEWS[view].look);
      raycaster.set(origin, look.clone().sub(origin).normalize());
      const hits = raycaster
        .intersectObjects(meshes, false)
        .map((hit) => ({ object: hit.object, eventObject: hit.object }));
      // The most specific proxy wins, so a machine standing at the look point is a valid hit.
      const hit = placeUnderPointer(hits);
      expect(hit && (hit.id === place.id || hit.parent === place.id), view).toBe(true);
    }
    const resident = new THREE.Group();
    resident.userData.resident = 'demo-0';
    expect(placeUnderPointer([{ object: meshes[0], eventObject: resident }])).toBeNull();
    expect(placeUnderPointer([])).toBeNull();
  });
});
