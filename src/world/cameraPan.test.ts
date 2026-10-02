import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CAMERA_PAN_BOUNDS, clampPanDelta, keyboardPanDelta } from './cameraPan';

describe('camera pan', () => {
  it('moves in the ground-plane view direction without changing camera height', () => {
    const camera = new Vector3(0, 12, 35);
    const look = new Vector3(0, 2, -22);
    const north = keyboardPanDelta(camera, look, look, 'ArrowUp', 3);
    const east = keyboardPanDelta(camera, look, look, 'ArrowRight', 3);
    expect(north.x).toBeCloseTo(0);
    expect(north.y).toBe(0);
    expect(north.z).toBeCloseTo(-3);
    expect(east.x).toBeCloseTo(3);
    expect(east.y).toBe(0);
    expect(east.z).toBeCloseTo(0);
  });

  it('keeps repeated keyboard and pointer pans inside explorable terrain', () => {
    const camera = new Vector3(27, 26, 35);
    const look = new Vector3(0, 2.8, 0);
    const destination = look.clone();
    for (let i = 0; i < 100; i++) {
      destination.add(keyboardPanDelta(camera, look, destination, 'ArrowRight', 8));
      destination.add(keyboardPanDelta(camera, look, destination, 'ArrowUp', 8));
    }
    expect(destination.x).toBeLessThanOrEqual(CAMERA_PAN_BOUNDS.maxX);
    expect(destination.z).toBeGreaterThanOrEqual(CAMERA_PAN_BOUNDS.minZ);
    expect(destination.y).toBe(look.y);
    const pointerTarget = new Vector3(180, 4, -210);
    pointerTarget.add(clampPanDelta(pointerTarget));
    expect(pointerTarget.x).toBe(CAMERA_PAN_BOUNDS.maxX);
    expect(pointerTarget.z).toBe(CAMERA_PAN_BOUNDS.minZ);
    expect(pointerTarget.y).toBe(4);
  });
});
