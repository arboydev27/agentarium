export const ACCESSORIES = [
  'headphones',
  'cap',
  'antenna',
  'glasses',
  'beret',
  'ear-fins',
  'flower',
  'visor',
] as const;
export function residentStyle(identity: string) {
  let seed = 2166136261;
  for (const char of identity) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  const demo = /^demo-(\d+)$/.exec(identity);
  const variant = demo ? Number(demo[1]) % 8 : seed % 8;
  return {
    variant,
    seed,
    accessory: ACCESSORIES[variant],
    accent: [
      '#dbb16e',
      '#6b8870',
      '#a3bfcc',
      '#e0b7a0',
      '#9c8fb4',
      '#b8bd80',
      '#d99287',
      '#87b8b0',
    ][variant],
    trim: ['#f2e5c7', '#e1e9ce', '#dbe9e8', '#f4dccc'][variant % 4],
    pace: 1.08 + (seed % 5) * 0.06,
    restSeconds: 10 + (seed % 9),
    visitSeconds: 7 + (seed % 7),
  };
}
