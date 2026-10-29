import { create } from 'zustand';

export type WorldScale = 'colony' | 'planet' | 'system';
export const useUniverse = create<{
  scale: WorldScale;
  setScale: (scale: WorldScale) => void;
}>((set) => ({ scale: 'colony', setScale: (scale) => set({ scale }) }));

// Hysteresis is supplied by each scene's entry distance, well inside its bounds.
export function orbitalZoomDestination(scale: WorldScale, distance: number): WorldScale {
  if (scale === 'planet' && distance >= 29.5) return 'system';
  if (scale === 'planet' && distance <= 5.1) return 'colony';
  if (scale === 'system' && distance <= 20.5) return 'planet';
  return scale;
}
