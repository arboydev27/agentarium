import { describe, expect, it } from 'vitest';
import { CAMERA_VIEWS, OBSERVATORY } from '../layout';
import { meadowTrailPoint } from '../terrain';
import {
  OBSERVATORY_BRANCH,
  clearOfObservatory,
  clearOfObservatoryView,
} from './observatoryPlacement';

describe('Cedar Observatory scenery clearance', () => {
  it('keeps the resident arrival and the full western branch free of distant grove placements', () => {
    expect(clearOfObservatory(OBSERVATORY.x, OBSERVATORY.z)).toBe(false);
    const [startX, , startZ] = meadowTrailPoint(16);
    for (const [x, z] of [[startX, startZ], ...OBSERVATORY_BRANCH]) {
      expect(clearOfObservatory(x, z)).toBe(false);
    }
    expect(clearOfObservatory(-45, -65)).toBe(true);
  });

  it('keeps the named camera sightline open while retaining nearby woodland', () => {
    const [cameraX, , cameraZ] = CAMERA_VIEWS.observatory.pos;
    const halfwayX = (cameraX + OBSERVATORY.x) / 2;
    const halfwayZ = (cameraZ + OBSERVATORY.z) / 2;
    expect(clearOfObservatoryView(halfwayX, halfwayZ)).toBe(false);
    expect(clearOfObservatoryView(-45, -65)).toBe(true);
  });
});
