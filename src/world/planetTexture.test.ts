import { expect, it } from 'vitest';
import { createPlanetTexture, planetMineral } from './planetTexture';

it('keeps both longitude edges and the poles continuous without visible seams', () => {
  const texture = createPlanetTexture();
  const { data, width, height } = texture.image;
  for (let row = 0; row < height; row++) {
    const first = row * width * 4,
      last = first + (width - 1) * 4;
    expect(Array.from(data.slice(first, first + 4))).toEqual(
      Array.from(data.slice(last, last + 4)),
    );
  }
  for (const row of [0, height - 1]) {
    const first = row * width * 4;
    for (let col = 1; col < width; col++)
      expect(Array.from(data.slice(first + col * 4, first + col * 4 + 4))).toEqual(
        Array.from(data.slice(first, first + 4)),
      );
  }
  texture.dispose();
});
it('samples a stable bounded mineral field', () => {
  for (let i = 0; i < 50; i++) {
    const value = planetMineral(Math.sin(i), Math.cos(i), Math.sin(i * 3));
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
  }
});
