/* eslint-disable @next/next/no-img-element */

/**
 * Initials or a logo for a company or person. The tint is derived from the name,
 * so the same buyer always looks the same, with no colour list to maintain.
 * Six soft tints, each with a dark ink of the same hue: the fill never speaks
 * louder than a status pill.
 */
const TINTS = [
  "bg-[oklch(93%_0.05_292)] text-[oklch(40%_0.16_292)] dark:bg-[oklch(30%_0.07_292)] dark:text-[oklch(85%_0.09_292)]",
  "bg-[oklch(93%_0.05_200)] text-[oklch(38%_0.09_200)] dark:bg-[oklch(30%_0.05_200)] dark:text-[oklch(85%_0.08_200)]",
  "bg-[oklch(93%_0.05_150)] text-[oklch(38%_0.1_150)] dark:bg-[oklch(30%_0.05_150)] dark:text-[oklch(85%_0.09_150)]",
  "bg-[oklch(94%_0.05_70)] text-[oklch(42%_0.1_70)] dark:bg-[oklch(30%_0.05_70)] dark:text-[oklch(86%_0.09_70)]",
  "bg-[oklch(93%_0.04_20)] text-[oklch(40%_0.14_20)] dark:bg-[oklch(30%_0.05_20)] dark:text-[oklch(85%_0.08_20)]",
  "bg-[oklch(93%_0.04_250)] text-[oklch(40%_0.12_250)] dark:bg-[oklch(30%_0.05_250)] dark:text-[oklch(85%_0.08_250)]",
];

const SIZE = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
} as const;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function initials(name: string): string {
  const words = name
    .replace(/\b(sdn|bhd|pty|ltd|llc|inc|co|group|plc)\b\.?/gi, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const letters = words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

export function Avatar({
  name,
  src,
  size = "md",
  shape = "circle",
  className = "",
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZE;
  /** circle for people, square (rounded) for companies */
  shape?: "circle" | "square";
  className?: string;
}) {
  const radius = shape === "circle" ? "rounded-full" : size === "xl" ? "rounded-lg" : "rounded-sm";
  if (src) {
    return <img src={src} alt="" className={`shrink-0 object-cover ${SIZE[size]} ${radius} ${className}`} />;
  }
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 select-none items-center justify-center font-semibold ${SIZE[size]} ${radius} ${TINTS[hash(name) % TINTS.length]} ${className}`}
    >
      {initials(name)}
    </span>
  );
}

/** The Kutip mark. */
export function KutipMark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[28%] bg-accent text-on-accent ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 14 14" fill="none">
        <path d="M3 2v10M3 7l6-5M3 7l6 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
