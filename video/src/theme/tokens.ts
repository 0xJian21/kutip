/**
 * Kutip design tokens, copied from docs/DESIGN.md and apps/web/app/globals.css.
 * OKLCH strings render as-is in Remotion's Chrome. Light theme is the product;
 * the "grey" world used before the colour shift in the hook is the same room
 * with the violet drained out, so it never introduces a second palette.
 */
export const C = {
  // Surfaces
  paper: "oklch(96.2% 0.006 290)",
  paper2: "oklch(93.4% 0.009 290)",
  surface: "oklch(99.4% 0.002 290)",
  well: "oklch(97.6% 0.004 290)",
  // Ink
  ink: "oklch(21% 0.025 290)",
  ink2: "oklch(44% 0.02 290)",
  ink3: "oklch(53% 0.018 290)",
  // Lines
  line: "oklch(90.5% 0.008 290)",
  lineStrong: "oklch(82% 0.012 290)",
  // Accent: violet. The one thing to press, the live fill.
  accent: "oklch(52% 0.21 292)",
  accentHover: "oklch(46% 0.21 292)",
  accentSoft: "oklch(94.5% 0.035 292)",
  accentSoft2: "oklch(90% 0.07 292)",
  onAccent: "oklch(99% 0.005 292)",
  // Indigo: only ever the far end of the hero gradient.
  accent2: "oklch(34% 0.17 278)",
  // The hero card (treasury). The only gradient and dark surface on a light screen.
  hero: "linear-gradient(135deg, oklch(54% 0.22 300) 0%, oklch(46% 0.22 290) 42%, oklch(31% 0.16 276) 100%)",
  heroStart: "oklch(54% 0.22 300)",
  heroMid: "oklch(46% 0.22 290)",
  heroEnd: "oklch(31% 0.16 276)",
  onHero: "oklch(99% 0.005 292)",
  onHero2: "oklch(93% 0.025 292)",
  heroLine: "oklch(100% 0 0 / 0.18)",
  heroFill: "oklch(100% 0 0 / 0.12)",
  heroButtonFg: "oklch(34% 0.17 278)",
  // Status pairs (only ever inside a pill)
  seenFg: "oklch(44% 0.13 255)",
  seenBg: "oklch(93% 0.035 255)",
  paidFg: "oklch(42% 0.12 150)",
  paidBg: "oklch(93% 0.05 150)",
  settledBg: "oklch(44% 0.13 150)",
  settledFg: "oklch(99% 0.005 150)",
  overdueFg: "oklch(46% 0.16 35)",
  overdueBg: "oklch(94% 0.04 35)",
  disputedFg: "oklch(44% 0.17 20)",
  disputedBg: "oklch(94% 0.04 20)",
  partialFg: "oklch(46% 0.12 70)",
  partialBg: "oklch(94% 0.05 70)",
  // Dark room (globals.css [data-theme=dark]); used for dark title cards and the terminal.
  darkPaper: "oklch(14% 0.014 290)",
  darkPaper2: "oklch(19.5% 0.014 290)",
  darkSurface: "oklch(21.5% 0.014 290)",
  darkWell: "oklch(17.5% 0.014 290)",
  darkInk: "oklch(94% 0.01 290)",
  darkInk2: "oklch(72% 0.015 290)",
  darkInk3: "oklch(60% 0.015 290)",
  darkLine: "oklch(30% 0.014 290)",
  darkAccent: "oklch(77% 0.14 292)",
} as const;

export const SHADOW = {
  card: "0 1px 2px oklch(25% 0.03 290 / 0.05), 0 12px 32px -16px oklch(25% 0.03 290 / 0.16)",
  float: "0 2px 6px oklch(20% 0.03 290 / 0.08), 0 16px 40px -12px oklch(20% 0.03 290 / 0.28)",
  hero: "0 24px 48px -20px oklch(50% 0.2 290 / 0.55)",
  pill: "0 1px 2px oklch(25% 0.03 290 / 0.08), 0 2px 8px -2px oklch(25% 0.03 290 / 0.1)",
} as const;

/** Radius carries hierarchy: hero 24, cards 20, inner blocks 16, inputs/wells 12, chips 8, swatches 6. */
export const R = { xs: 6, sm: 8, md: 12, lg: 16, xl: 20, "2xl": 24, full: 9999 } as const;

/** Product motion tokens (globals.css). */
export const EASE_OUT_BEZIER = [0.22, 1, 0.36, 1] as const;
export const DUR = { fast: 150, base: 250, slow: 450 } as const;

/** Buyer avatar tints (components/ui/avatar.tsx), hashed from the name. */
export const AVATAR_TINTS = [
  { bg: "oklch(93% 0.05 292)", fg: "oklch(40% 0.16 292)" },
  { bg: "oklch(93% 0.05 200)", fg: "oklch(38% 0.09 200)" },
  { bg: "oklch(93% 0.05 150)", fg: "oklch(38% 0.1 150)" },
  { bg: "oklch(94% 0.05 70)", fg: "oklch(42% 0.1 70)" },
  { bg: "oklch(93% 0.04 20)", fg: "oklch(40% 0.14 20)" },
  { bg: "oklch(93% 0.04 250)", fg: "oklch(40% 0.12 250)" },
] as const;

export function avatarTint(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

export function initials(name: string): string {
  const words = name
    .replace(/\b(sdn|bhd|pty|ltd|llc|inc|co|group|plc)\b\.?/gi, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}
