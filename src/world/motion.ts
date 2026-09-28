import type { Agent } from '../state';
export type Point = [number, number, number];
export const SEATS: Point[] = [
  [-5.4, 0.64, -1.8],
  [-2.2, 0.64, -1.8],
  [3.2, 0.55, 2.8],
  [6.1, 0.55, 2.8],
  [2.5, 1.1, -3.5],
  [5.5, 1.1, -3.5],
  [-5, 0.49, 3.3],
  [-2, 0.49, 3.3],
];
export const DESK_Z = -0.42;
export const SIT_LIFT = 0.13;
export function deskBound(status: Agent['status']) {
  return ['working', 'tool', 'waiting', 'failed'].includes(status);
}
// Each route stays on its own level and approaches the chair from the side.
// Progress is reversible, so interruptions retrace the route rather than cut through a desk.
export function routeForSeat(seat: number): Point[] {
  const [x, y, z] = SEATS[seat];
  // The right studio seat has a shorter back route to clear its bookcase.
  const back = seat === 5 ? 1.05 : 1.55;
  return [
    [x + 1.1, y, z - back - (seat === 5 ? 0.25 : 0.55)],
    [x + 1.1, y, z - back],
    [x + 1.1, y, z + DESK_Z],
    [x, y, z + DESK_Z],
  ];
}
export function routeLengths(route: Point[]) {
  const lengths = [0];
  for (let i = 1; i < route.length; i++)
    lengths.push(lengths[i - 1] + Math.hypot(...route[i].map((n, axis) => n - route[i - 1][axis])));
  return lengths;
}
export function routePoint(route: Point[], lengths: number[], distance: number): Point {
  const d = Math.max(0, Math.min(lengths.at(-1)!, distance));
  let i = 1;
  while (i < lengths.length - 1 && d > lengths[i]) i++;
  const t = (d - lengths[i - 1]) / (lengths[i] - lengths[i - 1]);
  return route[i].map((n, axis) => route[i - 1][axis] + (n - route[i - 1][axis]) * t) as Point;
}
const toward = (n: number, goal: number, step: number) =>
  n + Math.sign(goal - n) * Math.min(Math.abs(goal - n), step);
export class ResidentMotion {
  readonly route: Point[];
  readonly lengths: number[];
  distance = 0;
  sitting = 0;
  opacity = 0;
  facing = 0;
  moving = false;
  exited = false;
  elapsed = 0;
  celebration = 0;
  private completion: number | null = null;
  constructor(seat: number) {
    this.route = routeForSeat(seat);
    this.lengths = routeLengths(this.route);
  }
  get position(): Point {
    const p = routePoint(this.route, this.lengths, this.distance);
    p[1] += this.sitting * SIT_LIFT;
    return p;
  }
  update(
    agent: Agent,
    delta: number,
    options: { reduced: boolean; playing: boolean; leaving: boolean; now: number },
  ) {
    const { reduced, playing, leaving, now } = options;
    const desk = this.lengths.at(-1)!;
    const target = leaving ? 0 : deskBound(agent.status) ? desk : this.lengths[1];
    const stamp = agent.observedAt ?? agent.updatedAt;
    if (agent.status !== 'completed') {
      this.celebration = 0;
      this.completion = null;
    } else if (this.completion !== stamp) {
      this.completion = stamp;
      this.celebration = !agent.telemetryStale && now - stamp >= 0 && now - stamp < 30000 ? 1.8 : 0;
    }
    if (reduced) {
      this.distance = target;
      this.sitting = !leaving && target === desk ? 1 : 0;
      this.opacity = leaving ? 0 : 1;
      this.moving = false;
      this.facing = target === desk ? 0 : 0.5;
      this.celebration = 0;
      this.exited = leaving;
      return;
    }
    if (!playing && !leaving) {
      if (this.opacity === 0) {
        this.distance = target;
        this.sitting = target === desk ? 1 : 0;
        this.opacity = 1;
      }
      this.moving = false;
      return;
    }
    const dt = Math.min(Math.max(delta, 0), 0.05);
    this.elapsed += dt;
    const canSit = !leaving && target === desk && Math.abs(this.distance - desk) < 0.001;
    this.sitting = toward(this.sitting, canSit ? 1 : 0, dt / 0.6);
    const before = this.position;
    if (canSit || this.sitting === 0) this.distance = toward(this.distance, target, dt * 1.05);
    const after = this.position;
    const dx = after[0] - before[0],
      dz = after[2] - before[2];
    this.moving = Math.abs(dx) + Math.abs(dz) > 0.00001;
    const heading = this.moving ? Math.atan2(dx, dz) : target === desk ? 0 : 0.5;
    const angle = Math.atan2(Math.sin(heading - this.facing), Math.cos(heading - this.facing));
    this.facing += angle * (1 - Math.exp(-12 * dt));
    this.opacity = toward(this.opacity, leaving && this.distance === 0 ? 0 : 1, dt * 3);
    this.exited = leaving && this.distance === 0 && this.opacity === 0;
    if (!this.moving && this.distance === target && this.sitting === 0)
      this.celebration = Math.max(0, this.celebration - dt);
  }
  clip(agent: Agent) {
    if (this.moving) return 'Walking';
    if (this.sitting > 0 && deskBound(agent.status))
      return agent.status === 'waiting'
        ? 'DeskWait'
        : agent.status === 'failed'
          ? 'DeskError'
          : agent.status === 'tool'
            ? 'DeskReview'
            : 'DeskType';
    return this.celebration > 0 ? 'ThumbsUp' : 'Rest';
  }
}
