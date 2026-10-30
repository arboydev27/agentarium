export const ACCESSORIES = [
  'sensor-pods',
  'cranial-crest',
  'antenna',
  'compound-optics',
  'swept-horns',
  'ear-fins',
  'crystal-crown',
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
    skin: ['#9fbfb4', '#c9b7a1', '#b3a9c7', '#a8c2a0', '#d1b0a0', '#9eb6c6', '#c4c0a4', '#b9a5b8'][
      variant
    ],
    // Silhouette: head shape and build vary with the variant, never limb lengths,
    // so every resident keeps the same keyboard and chair contact.
    build: (
      ['tall', 'wide', 'lean', 'broad', 'tall-broad', 'wide-lean', 'plain', 'tall-lean'] as const
    )[variant],
    pace: 1.08 + (seed % 5) * 0.06,
    restSeconds: 10 + (seed % 9),
    visitSeconds: 7 + (seed % 7),
  };
}
