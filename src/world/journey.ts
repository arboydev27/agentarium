import type { Agent } from '../state';
import { ResidentMotion, routePoint, type Point } from './motion';
import { DESTINATIONS, NavigationTraffic, planRoute, type Destination } from './navigation';
import { residentStyle } from './personality';

type Options = {
  reduced: boolean;
  playing: boolean;
  leaving: boolean;
  now: number;
  outings?: boolean;
};
export class ResidentJourney extends ResidentMotion {
  readonly style;
  private idleTime = 0;
  private visit = 0;
  private trip: {
    path: ReturnType<typeof planRoute>;
    destination: Destination;
    distance: number;
    returning: boolean;
    held: boolean;
    dwell: number;
    seated: number;
  } | null = null;
  activity = 'Near desk';
  constructor(
    readonly seat: number,
    readonly identity: string,
    private traffic: NavigationTraffic,
  ) {
    super(seat);
    this.style = residentStyle(identity);
  }
  dispose() {
    this.traffic.release(this.identity);
  }
  override get position(): Point {
    if (!this.trip) return super.position;
    const point = routePoint(this.trip.path.points, this.trip.path.lengths, this.trip.distance);
    point[1] += this.trip.seated * 0.18;
    return point;
  }
  override update(agent: Agent, delta: number, options: Options) {
    const dt = Math.max(0, Math.min(delta, 0.05));
    const leisure =
      ['idle', 'completed'].includes(agent.status) &&
      !agent.telemetryStale &&
      options.outings !== false;
    if (options.reduced) {
      this.trip = null;
      this.traffic.release(this.identity);
      this.idleTime = 0;
      super.update(agent, delta, options);
      this.activity = this.sitting > 0 ? 'At desk' : 'Near desk';
      return;
    }
    const trip = this.trip;
    if (trip) {
      // A removed offsite resident must not hold up seat replacement behind a paused traveler.
      if (options.leaving) {
        this.opacity = Math.max(0, this.opacity - dt * 3);
        this.moving = false;
        this.activity = 'Leaving the grove';
        this.exited = this.opacity === 0;
        if (this.exited) this.traffic.release(this.identity);
        return;
      }
      this.exited = false;
      this.opacity = Math.min(1, this.opacity + dt * 3);
      if (!options.playing && !options.leaving) {
        this.moving = false;
        return;
      }
      if (
        (!leisure || options.leaving || trip.dwell >= this.style.visitSeconds) &&
        !trip.returning
      ) {
        trip.returning = true;
        // Outbound travel may have released the corridor behind us. Reclaim the
        // complete return before reversing, or wait here with our current lease.
        trip.held = this.traffic.acquire(this.identity, trip.path.ids, true);
      }
      if (trip.returning && !trip.held)
        trip.held = this.traffic.acquire(this.identity, trip.path.ids, true);
      const end = trip.path.lengths.at(-1)!;
      const atDestination = trip.distance === end && !trip.returning;
      if (atDestination) {
        if (trip.held) {
          this.traffic.releaseCorridor(this.identity);
          trip.held = false;
        }
        trip.dwell += dt;
      }
      const sitTarget = atDestination && trip.destination.seated ? 1 : 0;
      trip.seated +=
        Math.sign(sitTarget - trip.seated) * Math.min(Math.abs(sitTarget - trip.seated), dt / 0.6);
      const before = this.position;
      if (trip.held && trip.seated === 0) {
        trip.distance = trip.returning
          ? Math.max(0, trip.distance - dt * this.style.pace)
          : Math.min(end, trip.distance + dt * this.style.pace);
        this.traffic.releasePassed(this.identity, trip.distance, trip.returning);
      }
      const after = this.position;
      const dx = after[0] - before[0],
        dz = after[2] - before[2];
      this.moving = Math.hypot(dx, dz) > 0.00001;
      const heading = this.moving ? Math.atan2(dx, dz) : trip.destination.facing;
      this.facing +=
        Math.atan2(Math.sin(heading - this.facing), Math.cos(heading - this.facing)) *
        (1 - Math.exp(-12 * dt));
      this.elapsed += dt;
      this.activity = trip.returning
        ? trip.held
          ? 'Returning to desk'
          : 'Waiting for a clear path'
        : atDestination
          ? `Resting at ${trip.destination.label}`
          : `Walking to ${trip.destination.label}`;
      if (trip.returning && trip.distance === 0) {
        this.trip = null;
        this.traffic.release(this.identity);
        this.idleTime = 0;
      }
      return;
    }
    super.update(agent, delta, options);
    this.activity =
      this.sitting > 0 ? 'At desk' : this.moving ? 'Walking beside desk' : 'Near desk';
    if (!leisure || !options.playing || options.leaving) {
      this.idleTime = 0;
      return;
    }
    if (
      this.moving ||
      this.sitting > 0 ||
      this.celebration > 0 ||
      this.distance !== this.lengths[1]
    )
      return;
    this.idleTime += dt;
    if (this.idleTime < this.style.restSeconds) return;
    // Try preferred destinations first, rotating preferences between visits.
    for (let offset = 0; offset < DESTINATIONS.length; offset++) {
      const destination =
        DESTINATIONS[(this.style.variant + this.visit + offset) % DESTINATIONS.length];
      const path = planRoute(`home-${this.seat}`, destination.node);
      if (!this.traffic.reserveDestination(this.identity, destination.id)) continue;
      if (!this.traffic.acquire(this.identity, path.ids)) {
        this.traffic.release(this.identity);
        continue;
      }
      this.trip = {
        path,
        destination,
        distance: 0,
        returning: false,
        held: true,
        dwell: 0,
        seated: 0,
      };
      this.visit++;
      return;
    }
    this.idleTime = this.style.restSeconds - 1;
    this.activity = 'Waiting for a clear path';
  }
  override clip(agent: Agent) {
    if (this.trip)
      return this.moving
        ? 'Walking'
        : this.trip.distance === this.trip.path.lengths.at(-1) && !this.trip.returning
          ? this.trip.destination.clip
          : 'Rest';
    return super.clip(agent);
  }
}
