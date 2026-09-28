// Hysteresis prevents repeated mount/unmount near a zoom boundary.
export function showFineDetail(
  previous: boolean,
  pixelsPerUnit: number,
  inView: boolean,
  quality: 'high' | 'low',
) {
  return quality === 'high' && inView && pixelsPerUnit >= (previous ? 22 : 26);
}
