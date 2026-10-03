export const SLATE_REACH = { x: -20, z: -79, radius: 5 } as const;

export function clearOfSlateReach(x: number, z: number, margin = 0) {
  return Math.hypot(x - SLATE_REACH.x, z - SLATE_REACH.z) >= SLATE_REACH.radius + margin;
}
