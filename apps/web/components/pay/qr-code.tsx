"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** QR as inline SVG so it inherits the ink colour and stays crisp at any size. */
export function QrCode({ value, className = "" }: { value: string; className?: string }) {
  const [svg, setSvg] = useState<string>("");
  useEffect(() => {
    let alive = true;
    QRCode.toString(value, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#0000" } })
      .then((s) => alive && setSvg(s.replace(/#000000/g, "currentColor")))
      .catch(() => alive && setSvg(""));
    return () => {
      alive = false;
    };
  }, [value]);
  if (!svg) return <div aria-hidden="true" className={`aspect-square w-full animate-pulse rounded-sm bg-paper-2 ${className}`} />;
  return <div role="img" aria-label="QR code for the pay link" className={`aspect-square w-full text-ink [&>svg]:h-full [&>svg]:w-full ${className}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}
