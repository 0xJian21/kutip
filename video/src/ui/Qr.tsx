import type React from "react";
import { useMemo } from "react";
import QRCode from "qrcode";
import { C } from "../theme/tokens";

/** A real QR code (the `qrcode` encoder), drawn as SVG rects so it stays crisp at any scale. */
export const Qr: React.FC<{ value: string; size: number; color?: string; style?: React.CSSProperties }> = ({ value, size, color = C.ink, style }) => {
  const { modules, count } = useMemo(() => {
    const q = QRCode.create(value, { errorCorrectionLevel: "M" });
    return { modules: q.modules.data as Uint8Array, count: q.modules.size };
  }, [value]);
  const cell = size / count;
  const rects: React.ReactNode[] = [];
  for (let y = 0; y < count; y++) {
    for (let x = 0; x < count; x++) {
      if (modules[y * count + x]) rects.push(<rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell + 0.2} height={cell + 0.2} />);
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", ...style }} fill={color} shapeRendering="crispEdges">
      {rects}
    </svg>
  );
};
