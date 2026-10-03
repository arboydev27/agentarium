import { meadowTrailPoint, walkwayHeight } from '../terrain';

export const TRAIL_TURNOUTS = [
  { id: 'meadow:rest-west', label: 'western trail rest', trailIndex: 6, side: -1 },
  { id: 'meadow:rest-east', label: 'eastern trail rest', trailIndex: 18, side: 1 },
] as const;

export function turnoutPoint(trailIndex: number, side: number, offset: number) {
  const [trailX, , trailZ] = meadowTrailPoint(trailIndex);
  const x = trailX + side * offset;
  return [x, walkwayHeight(x, trailZ, 0.09), trailZ] as const;
}

export function clearOfTurnouts(x: number, z: number, margin = 0) {
  return TRAIL_TURNOUTS.every(({ trailIndex, side }) => {
    const [centerX, , centerZ] = turnoutPoint(trailIndex, side, 4.8);
    return Math.hypot(x - centerX, z - centerZ) > 3.6 + margin;
  });
}
