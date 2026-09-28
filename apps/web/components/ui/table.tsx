import type { ComponentProps } from "react";

/**
 * Table primitives. A table always lives inside a Card with padded={false};
 * the header sits on a quiet fill, rows divide by hairline, amounts right-align.
 */
export function Table({ className = "", ...props }: ComponentProps<"table">) {
  return <table className={`w-full text-base ${className}`} {...props} />;
}

export function THead({ className = "", ...props }: ComponentProps<"thead">) {
  return <thead className={`bg-paper-2/70 text-sm text-ink-2 ${className}`} {...props} />;
}

export function TBody({ className = "", ...props }: ComponentProps<"tbody">) {
  return <tbody className={`divide-y divide-line ${className}`} {...props} />;
}

export function TR({ className = "", interactive = false, ...props }: ComponentProps<"tr"> & { interactive?: boolean }) {
  return <tr className={`${interactive ? "group relative transition-colors duration-(--dur-fast) hover:bg-paper-2/50" : ""} ${className}`} {...props} />;
}

export function TH({ className = "", align = "left", ...props }: ComponentProps<"th"> & { align?: "left" | "right" }) {
  return <th scope="col" className={`px-4 py-2.5 font-medium first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6 ${align === "right" ? "text-right" : "text-left"} ${className}`} {...props} />;
}

export function TD({ className = "", align = "left", ...props }: ComponentProps<"td"> & { align?: "left" | "right" }) {
  return <td className={`px-4 py-3 first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6 ${align === "right" ? "text-right" : ""} ${className}`} {...props} />;
}
