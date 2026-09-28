import Link from "next/link";
import type { ComponentProps } from "react";

/**
 * primary   = violet pill: the one thing to press on a screen.
 * secondary = near-black pill: the strong alternative (Send, Approve, Cash out).
 * outline   = white pill with a hairline: quiet actions that sit on cards.
 * ghost     = text only: Cancel, Reject, tertiary links in rows.
 * hero      = white pill on the treasury card; heroOutline = its quiet sibling.
 */
type Variant = "primary" | "secondary" | "outline" | "ghost" | "hero" | "heroOutline";
type Size = "sm" | "md" | "lg";

// Disabled is a quiet fill, never a faded accent: an enabled violet button must always read as enabled.
const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-colors duration-(--dur-fast) disabled:cursor-not-allowed";
const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover disabled:bg-paper-2 disabled:text-ink-3 disabled:hover:bg-paper-2",
  secondary: "bg-ink text-paper hover:bg-ink/85 disabled:bg-paper-2 disabled:text-ink-3 disabled:hover:bg-paper-2",
  outline: "border border-line-strong bg-surface text-ink hover:bg-paper-2 shadow-pill disabled:border-line disabled:bg-paper-2 disabled:text-ink-3 disabled:shadow-none disabled:hover:bg-paper-2",
  ghost: "text-ink-2 hover:bg-paper-2 hover:text-ink disabled:text-ink-3 disabled:hover:bg-transparent",
  hero: "bg-on-hero text-hero-button-fg hover:opacity-90 disabled:border disabled:border-hero-line disabled:bg-hero-fill disabled:text-on-hero-2 disabled:hover:opacity-100",
  heroOutline: "border border-hero-line bg-hero-fill text-on-hero hover:bg-on-hero/20 disabled:text-on-hero-2/70 disabled:hover:bg-hero-fill",
};
const SIZE: Record<Size, string> = {
  sm: "h-8 px-3.5 text-sm",
  md: "h-10 px-5 text-base",
  lg: "h-12 px-6 text-md",
};
const GHOST_PAD: Record<Size, string> = { sm: "px-2.5", md: "px-3.5", lg: "px-4" };

export function buttonClass(variant: Variant = "primary", size: Size = "md", className = "") {
  const pad = variant === "ghost" ? GHOST_PAD[size] : "";
  return `${BASE} ${VARIANT[variant]} ${SIZE[size]} ${pad} ${className}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

/** Round icon-only button (card menus, close, copy). Always give it an aria-label. */
export function IconButton({
  size = "md",
  variant = "outline",
  className = "",
  type = "button",
  ...props
}: ComponentProps<"button"> & { size?: "sm" | "md"; variant?: "outline" | "ghost" }) {
  const dims = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const look =
    variant === "outline"
      ? "border border-line bg-surface text-ink-2 hover:bg-paper-2 hover:text-ink"
      : "text-ink-2 hover:bg-paper-2 hover:text-ink";
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-(--dur-fast) disabled:cursor-not-allowed disabled:text-ink-3 ${dims} ${look} ${className}`}
      {...props}
    />
  );
}
