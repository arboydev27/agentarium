import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SEATS, ZONES } from '../layout';
import { EDGES, NODES } from '../navigation';
import { renderedTerrainHeight } from '../terrain';
import {
  apronSlabs,
  doorPlacements,
  footprint,
  HABITAT_PROPS,
  HABITATS,
  habitatPlacements,
  OPENING_CLEAR,
  OPENING_WIDTH,
  propPlacement,
  shellPlacements,
  SIDES,
  sideFrame,
  sideSegments,
  splitRun,
  TILE,
  YARD_PROPS,
  ZONE_NAMES,
  zoneOfSeat,
} from './habitatLayout';
import {
  BODY_RADIUS,
  firstRouteCollision,
  loadKitScene,
  placeModule,
  worldBounds,
} from './kitFixture';

describe('habitat shell layout', () => {
  it('tiles every wall run exactly, with tile scales close to the authored width', () => {
    for (const zone of ZONE_NAMES) {
      for (const side of SIDES) {
        const frame = sideFrame(zone, side);
        const segments = sideSegments(zone, side);
        const covered = segments.reduce(
          (sum, segment) =>
            sum +
            (segment.module === 'hab-airlock'
              ? OPENING_WIDTH.airlock
              : segment.module === 'hab-gate'
                ? OPENING_WIDTH.gate
                : segment.scale * TILE),
          0,
        );
        expect(covered, `${zone} ${side}`).toBeCloseTo(frame.to - frame.from, 6);
        for (const segment of segments) {
          expect(segment.scale, `${zone} ${side}`).toBeGreaterThanOrEqual(0.65);
          expect(segment.scale, `${zone} ${side}`).toBeLessThanOrEqual(1.1);
        }
      }
    }
    expect(splitRun(0, 0.2)).toEqual([]);
    expect(splitRun(0, 4.8)).toHaveLength(3);
  });

  it('glazes the camera-facing sides and keeps the service sides opaque', () => {
    for (const zone of ZONE_NAMES) {
      const modules = (side: (typeof SIDES)[number]) =>
        new Set(sideSegments(zone, side).map((segment) => segment.module));
      expect(modules('south').has('hab-glass'), zone).toBe(true);
      expect(modules('east').has('hab-glass'), zone).toBe(true);
      expect(modules('west').has('hab-glass'), zone).toBe(false);
      expect(modules('south').has('hab-wall'), zone).toBe(false);
    }
    // The café keeps one window beside the habitat viewport rest spot.
    const window = NODES.window;
    expect(
      sideSegments('café', 'north').some(
        (segment) => segment.module === 'hab-glass' && Math.abs(segment.center - window[0]) < 1.2,
      ),
    ).toBe(true);
  });

  it('places an opening wherever a route chord crosses a module wall', () => {
    for (const zone of ZONE_NAMES) {
      const { minX, maxX, minZ, maxZ } = footprint(zone);
      const inside = (p: readonly number[]) =>
        p[0] > minX + 1e-6 && p[0] < maxX - 1e-6 && p[2] > minZ + 1e-6 && p[2] < maxZ - 1e-6;
      for (const [from, to] of EDGES) {
        const a = NODES[from];
        const b = NODES[to];
        if (inside(a) === inside(b)) continue;
        const [inner, outer] = inside(a) ? [a, b] : [b, a];
        // Exit parameter along the chord and the side it leaves through.
        const candidates = [
          ['west', (minX - inner[0]) / (outer[0] - inner[0])],
          ['east', (maxX - inner[0]) / (outer[0] - inner[0])],
          ['north', (minZ - inner[2]) / (outer[2] - inner[2])],
          ['south', (maxZ - inner[2]) / (outer[2] - inner[2])],
        ] as const;
        const [side, t] = candidates
          .filter(([, value]) => Number.isFinite(value) && value >= 0 && value <= 1)
          .sort((p, q) => p[1] - q[1])[0];
        const along =
          side === 'north' || side === 'south'
            ? inner[0] + (outer[0] - inner[0]) * t
            : inner[2] + (outer[2] - inner[2]) * t;
        const opening = HABITATS[zone].openings.find(
          (candidate) =>
            candidate.side === side &&
            Math.abs(candidate.at - along) <= OPENING_CLEAR[candidate.kind] / 2 - BODY_RADIUS,
        );
        expect(
          opening,
          `${zone}: ${from} → ${to} crosses the ${side} wall at ${along.toFixed(2)}`,
        ).toBeDefined();
      }
    }
  });

  it('roofs the whole footprint and posts a column at each corner', () => {
    for (const zone of ZONE_NAMES) {
      const { minX, maxX, minZ, maxZ, y } = footprint(zone);
      const shell = shellPlacements(zone);
      const roof = shell.filter((p) => p.part === 'roof');
      const box = new THREE.Box3();
      for (const tile of roof) {
        box.expandByPoint(
          new THREE.Vector3(
            tile.position[0] - tile.scale[0],
            tile.position[1],
            tile.position[2] - tile.scale[2],
          ),
        );
        box.expandByPoint(
          new THREE.Vector3(
            tile.position[0] + tile.scale[0],
            tile.position[1],
            tile.position[2] + tile.scale[2],
          ),
        );
        expect(tile.position[1]).toBeGreaterThan(y + 3);
      }
      expect(box.min.x).toBeCloseTo(minX, 6);
      expect(box.max.x).toBeCloseTo(maxX, 6);
      expect(box.min.z).toBeCloseTo(minZ, 6);
      expect(box.max.z).toBeCloseTo(maxZ, 6);
      expect(shell.filter((p) => p.part === 'corner')).toHaveLength(4);
      expect(shell.filter((p) => p.part === 'airlock')).toHaveLength(
        HABITATS[zone].openings.length,
      );
    }
  });

  it('floors the strip where a wall stands outside its deck, leaving the doorway open', () => {
    const slabs = apronSlabs('studio');
    expect(slabs).toHaveLength(2);
    const [left, right] = slabs.sort((a, b) => a.x - b.x);
    expect(left.x + left.w / 2).toBeCloseTo(6.8 - OPENING_CLEAR.airlock / 2, 6);
    expect(right.x - right.w / 2).toBeCloseTo(6.8 + OPENING_CLEAR.airlock / 2, 6);
    for (const slab of slabs) {
      expect(slab.z - slab.d / 2).toBeCloseTo(-1.2, 6);
      expect(slab.z + slab.d / 2).toBeCloseTo(footprint('studio').maxZ, 6);
      expect(slab.y).toBe(ZONES.studio.center[1]);
    }
    expect(apronSlabs('café')).toEqual([]);
  });

  it('runs each airlock ramp from the outside node up to its floor', () => {
    for (const zone of ZONE_NAMES) {
      for (const door of doorPlacements(zone)) {
        expect(door.title).toBe(HABITATS[zone].title);
        if (!door.ramp) continue;
        const { from, to } = door.ramp;
        expect(Math.abs(to[1] - from[1])).toBeLessThan(0.7);
        expect(door.ramp.width).toBeGreaterThanOrEqual(2 * BODY_RADIUS + 0.2);
      }
      // Every door that bridges a level change has a ramp.
      for (const door of doorPlacements(zone)) {
        if (door.kind === 'flush') continue;
        expect(door.ramp, `${zone} ${door.side}`).toBeDefined();
      }
    }
    expect(zoneOfSeat(0)).toBe('café');
    expect(zoneOfSeat(7)).toBe('courtyard');
    expect(zoneOfSeat(8)).toBeUndefined();
  });
});

describe('habitat kit geometry', () => {
  it('keeps every placed module clear of the resident routes', async () => {
    const { scene } = await loadKitScene();
    const yard = YARD_PROPS.map((prop) => ({
      module: prop.module,
      position: [prop.x, prop.y ?? renderedTerrainHeight(prop.x, prop.z), prop.z] as [
        number,
        number,
        number,
      ],
      rotationY: prop.turn,
      scale: [1, 1, 1] as [number, number, number],
    }));
    for (const placement of [...habitatPlacements(), ...yard]) {
      const model = placeModule(scene, placement);
      const collision = firstRouteCollision(model);
      expect(
        collision,
        `${placement.module} at ${placement.position.map((v) => v.toFixed(2))}`,
      ).toBeNull();
    }
  });

  it('keeps interior props inside their module and off the desks', async () => {
    const { scene } = await loadKitScene();
    const desks = SEATS.map(
      ([x, , z]) =>
        new THREE.Box2(new THREE.Vector2(x - 1.0, z - 1.25), new THREE.Vector2(x + 1.0, z + 0.9)),
    );
    for (const prop of HABITAT_PROPS) {
      const { minX, maxX, minZ, maxZ, y } = footprint(prop.zone);
      const bounds = worldBounds(placeModule(scene, propPlacement(prop)));
      const label = `${prop.module} in ${prop.zone} at ${prop.x},${prop.z}`;
      expect(bounds.min.x, label).toBeGreaterThanOrEqual(minX - 0.01);
      expect(bounds.max.x, label).toBeLessThanOrEqual(maxX + 0.01);
      expect(bounds.min.z, label).toBeGreaterThanOrEqual(minZ - 0.01);
      expect(bounds.max.z, label).toBeLessThanOrEqual(maxZ + 0.01);
      expect(bounds.min.y, label).toBeGreaterThanOrEqual(y - 0.05);
      expect(bounds.max.y, label).toBeLessThan(y + 3.1);
      const flat = new THREE.Box2(
        new THREE.Vector2(bounds.min.x, bounds.min.z),
        new THREE.Vector2(bounds.max.x, bounds.max.z),
      );
      for (const [seat, desk] of desks.entries()) {
        expect(flat.intersectsBox(desk), `${label} overlaps desk ${seat}`).toBe(false);
      }
    }
  });

  it('keeps the wall tiles thin enough that insets leave the decks walkable', async () => {
    const { scene } = await loadKitScene();
    for (const module of ['hab-wall', 'hab-glass'] as const) {
      const bounds = worldBounds(
        placeModule(scene, { module, position: [0, 0, 0], rotationY: 0, scale: [1, 1, 1] }),
      );
      // Interior protrusions (liner, cove lamp) stay under a hand's width.
      expect(bounds.min.z).toBeGreaterThan(-0.1);
      expect(bounds.max.z).toBeLessThan(0.4);
      expect(bounds.min.y).toBeLessThan(-0.7);
    }
    for (const zone of ZONE_NAMES) {
      const {
        center: [, y],
      } = ZONES[zone];
      expect(footprint(zone).y).toBe(y);
    }
  });
});
