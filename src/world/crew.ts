import type { ClipName } from './character';
import { residentStyle } from './personality';
import { siteGround } from './scenery/constructionPlacement';

// The construction crew at the Fabrication Bay: three figures on short closed
// loops between authored stops, each stop a clip and a dwell. Pure and
// deterministic in time. The crew have no identity: no id, no name, no seat, no
// session. They never enter the store, the roster, the map or a place card.

/** Crew wear the colonist body at nine tenths, so they never read as a ninth resident. */
export const CREW_SCALE = 0.9;
/** Walking speed between stops, metres per second. */
export const CREW_PACE = 1.05;
/** High-visibility work suit, unlike every roster colour. */
export const CREW_SUIT = '#d9962f';

export type CrewRole = 'hauler' | 'fitter' | 'rigger';
export type CrewStop = {
  x: number;
  z: number;
  /** Heading while standing, radians about +y (0 faces +z). */
  facing: number;
  clip: ClipName;
  /** Seconds spent at the stop. */
  dwell: number;
};
export type CrewLook = { color: string; style: ReturnType<typeof residentStyle> };
export type CrewMember = {
  role: CrewRole;
  look: CrewLook;
  /** Closed loop: the last stop walks back to the first. */
  stops: readonly CrewStop[];
  /** Seconds of head start, so no two crew are ever in step. */
  phase: number;
};

const look = (seed: string): CrewLook => ({
  color: CREW_SUIT,
  // The seed only picks skin and build; crew wear dark trim and pale accents.
  style: { ...residentStyle(seed), trim: '#2f333a', accent: '#f4e6c8' },
});

export const CREW: readonly CrewMember[] = [
  {
    // Carries crates from the yard up the ramp onto the raft and back.
    role: 'hauler',
    look: look('crew-hauler'),
    phase: 0,
    stops: [
      { x: 15.45, z: -5.9, facing: -Math.PI / 2, clip: 'SampleScan', dwell: 5 },
      { x: 17, z: -4.7, facing: Math.PI, clip: 'SampleScan', dwell: 4 },
    ],
  },
  {
    // Works the north wall: checks the standing tiles, measures the gap for the next.
    role: 'fitter',
    look: look('crew-fitter'),
    phase: 11,
    stops: [
      { x: 16.9, z: -7.15, facing: Math.PI, clip: 'GardenLook', dwell: 8 },
      { x: 21, z: -7.15, facing: Math.PI, clip: 'SampleScan', dwell: 6 },
    ],
  },
  {
    // Watches the hoist load from beside the mast and from further back.
    role: 'rigger',
    look: look('crew-rigger'),
    phase: 5,
    stops: [
      { x: 17.4, z: -1.5, facing: 1.27, clip: 'SurveySky', dwell: 7 },
      { x: 16.3, z: -0.4, facing: 1.79, clip: 'GardenLook', dwell: 5 },
    ],
  },
];

export function crewByRole(role: CrewRole): CrewMember {
  return CREW.find((member) => member.role === role)!;
}

type Leg = { from: CrewStop; to: CrewStop; start: number; walk: number };
const timelines = new Map<CrewRole, { legs: Leg[]; cycle: number }>();
function timeline(member: CrewMember) {
  let cached = timelines.get(member.role);
  if (cached) return cached;
  const legs: Leg[] = [];
  let clock = 0;
  member.stops.forEach((stop, index) => {
    const next = member.stops[(index + 1) % member.stops.length];
    const walk = Math.hypot(next.x - stop.x, next.z - stop.z) / CREW_PACE;
    legs.push({ from: stop, to: next, start: clock, walk });
    clock += stop.dwell + walk;
  });
  cached = { legs, cycle: clock };
  timelines.set(member.role, cached);
  return cached;
}

/** Seconds for one lap of the loop, dwells included. */
export function crewCycle(member: CrewMember) {
  return timeline(member).cycle;
}

export type CrewPose = {
  x: number;
  y: number;
  z: number;
  heading: number;
  clip: ClipName;
  moving: boolean;
};

const standing = (stop: CrewStop): CrewPose => ({
  x: stop.x,
  y: siteGround(stop.x, stop.z),
  z: stop.z,
  heading: stop.facing,
  clip: stop.clip,
  moving: false,
});

/** Where a crew member is at `time`; reduced motion parks them at their first stop in its pose. */
export function crewPose(member: CrewMember, time: number, reduced = false): CrewPose {
  if (reduced) return standing(member.stops[0]);
  const { legs, cycle } = timeline(member);
  const t = (((time + member.phase) % cycle) + cycle) % cycle;
  for (const leg of legs) {
    const local = t - leg.start;
    if (local < 0 || local >= leg.from.dwell + leg.walk) continue;
    if (local < leg.from.dwell) return standing(leg.from);
    const s = (local - leg.from.dwell) / leg.walk;
    const x = leg.from.x + (leg.to.x - leg.from.x) * s;
    const z = leg.from.z + (leg.to.z - leg.from.z) * s;
    return {
      x,
      y: siteGround(x, z),
      z,
      heading: Math.atan2(leg.to.x - leg.from.x, leg.to.z - leg.from.z),
      clip: 'Walking',
      moving: true,
    };
  }
  return standing(member.stops[0]);
}
