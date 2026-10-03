/** One typeface: Plus Jakarta Sans, as in the product. Loaded once; rendering waits for it. */
import { loadFont } from "@remotion/google-fonts/PlusJakartaSans";

const jakarta = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

export const FONT = `"${jakarta.fontFamily}", ui-sans-serif, system-ui, sans-serif`;

/** Money and columns use lining, tabular figures. */
export const TABULAR: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums lining-nums",
  fontFeatureSettings: '"tnum" 1, "lnum" 1',
};

/** Type scale from DESIGN.md (px at 16px root). Video scales these with `k` from useLayout(). */
export const TYPE = {
  money2xl: { fontSize: 56, fontWeight: 700, lineHeight: 1.07, letterSpacing: "-0.025em" },
  moneyXl: { fontSize: 44, fontWeight: 700, lineHeight: 1.09, letterSpacing: "-0.025em" },
  moneyLg: { fontSize: 34, fontWeight: 700, lineHeight: 1.12, letterSpacing: "-0.025em" },
  moneyMd: { fontSize: 24, fontWeight: 700, lineHeight: 1.17, letterSpacing: "-0.025em" },
  headline: { fontSize: 36, fontWeight: 600, lineHeight: 1.11, letterSpacing: "-0.01em" },
  title: { fontSize: 22, fontWeight: 600, lineHeight: 1.27, letterSpacing: "-0.01em" },
  cardTitle: { fontSize: 18, fontWeight: 600, lineHeight: 1.44, letterSpacing: "-0.01em" },
  body: { fontSize: 16, fontWeight: 400, lineHeight: 1.5 },
  ui: { fontSize: 14, fontWeight: 400, lineHeight: 1.43 },
  label: { fontSize: 13, fontWeight: 500, lineHeight: 1.38 },
} as const;
