import { DAWNLIGHT_GLASSHOUSE } from './dawnlightPlacement';

// Local +Z follows the path through the conservatory. Its center aisle remains
// open from the western trail to the forecourt and resident destination.
export const HEADING = Math.atan2(12, 9);
export const COS = Math.cos(HEADING);
export const SIN = Math.sin(HEADING);
export const HALF_WIDTH = 4.8;
export const HALF_LENGTH = 3.3;

export function localToWorld(x: number, z: number): [number, number] {
  return [
    DAWNLIGHT_GLASSHOUSE.centerX + COS * x + SIN * z,
    DAWNLIGHT_GLASSHOUSE.centerZ - SIN * x + COS * z,
  ];
}
