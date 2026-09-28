export function ambientStep(delta: number, reduced: boolean, low: boolean) {
  return reduced || low ? 0 : Math.max(0, Math.min(delta, 0.05));
}
export function leafPose(time: number, index: number) {
  const phase = (time * 0.075 + index * 0.173) % 1;
  // Leaves stay in planted perimeter strips, away from workstations and labels.
  const side = index % 2 ? -1 : 1;
  return {
    x: side * (12.7 + Math.sin(phase * 5 + index) * 0.35),
    y: 0.5 + (1 - phase) * 3.2,
    z: -7.5 + (index % 6) * 3 + Math.sin(phase * 3 + index) * 0.4,
    scale: Math.sin(Math.PI * phase) * 0.13,
    angle: phase * 8 + index,
  };
}
export function frameSummary(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  if (!sorted.length) return { fps: 0, p95: 0 };
  return {
    fps: 1000 / (sorted.reduce((a, b) => a + b, 0) / sorted.length),
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
  };
}
