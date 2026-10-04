import { describe, expect, it } from 'vitest';
import { buildOuterLandscape } from './outerLandscapePlacement';
import { clearOfMeadowRoutes } from './meadowPlacement';
import { clearOfNorthstarStructure, clearOfNorthstarTrail } from './northstarPlacement';

const high = buildOuterLandscape('high');
const low = buildOuterLandscape('low');

describe('outer landscape composition', () => {
  it('is deterministic, bounded, and scales detail without changing retained placements', () => {
    expect(buildOuterLandscape('high')).toEqual(high);
    expect(high.trees.length).toBeGreaterThan(90);
    expect(low.trees.length).toBeLessThan(high.trees.length * 0.65);
    expect(high.rocks.length).toBeGreaterThan(15);
    expect(low.rocks.length).toBeLessThan(high.rocks.length);
    for (const piece of [...high.trees, ...high.rocks]) {
      expect(Math.max(Math.abs(piece.x), Math.abs(piece.z))).toBeLessThanOrEqual(190);
      expect(Math.hypot(piece.x, piece.z)).toBeGreaterThanOrEqual(53);
    }
    for (const piece of [...low.trees, ...low.rocks]) {
      expect([...high.trees, ...high.rocks]).toContainEqual(piece);
    }
  });

  it('keeps landmark routes and Northstar arrival clear', () => {
    for (const tree of high.trees) {
      if (tree.biome === 'highland' && tree.z < -116) {
        expect(clearOfNorthstarTrail(tree.x, tree.z, tree.crown + 2.7)).toBe(true);
        expect(clearOfNorthstarStructure(tree.x, tree.z, tree.crown + 2.7)).toBe(true);
      } else {
        expect(clearOfMeadowRoutes(tree.x, tree.z, tree.crown + 1.8)).toBe(true);
      }
    }
    for (const rock of high.rocks) {
      if (rock.biome === 'highland' && rock.z < -116) {
        expect(clearOfNorthstarTrail(rock.x, rock.z, rock.size + 2.7)).toBe(true);
        expect(clearOfNorthstarStructure(rock.x, rock.z, rock.size + 2.7)).toBe(true);
      } else {
        expect(clearOfMeadowRoutes(rock.x, rock.z, rock.size + 1.8)).toBe(true);
      }
    }
  });
});
