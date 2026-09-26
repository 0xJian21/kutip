import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm font-medium transition-colors duration-(--dur-fast) disabled:pointer-events-none disabled:opacity-50";
const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-paper-2",
  ghost: "text-ink-2 hover:bg-paper-2 hover:text-ink",
};
const SIZE: Record<Size, string> = {
  md: "h-9 px-4 text-base",
  lg: "h-12 px-5 text-md",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className = "") {
  const pad = variant === "ghost" ? (size === "lg" ? "px-4" : "px-3") : "";
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
