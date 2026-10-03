import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { parseSrt, createTikTokStyleCaptions, type Caption } from "@remotion/captions";
import { useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import { C, R, SHADOW } from "../theme/tokens";
import { FONT } from "../theme/fonts";
import { captionsFile } from "../lib/assets";

/**
 * Burned-in subtitles in the product's voice: a white pill, ink text, bottom-centre.
 * Takes Caption[] (the @remotion/captions type). Use <SrtCaptions> to load a .srt / .json
 * from public/captions (synced from docs/video/captions/).
 */
export const CaptionTrack: React.FC<{ captions: Caption[]; combineMs?: number; width?: number; bottom?: number; scale?: number }> = ({ captions, combineMs = 2200, width, bottom, scale = 1 }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const portrait = H > W;
  const pages = useMemo(() => createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds: combineMs }).pages, [captions, combineMs]);
  const t = (frame / fps) * 1000;
  const page = pages.find((p) => t >= p.startMs && t < p.startMs + p.durationMs);
  const w = width ?? (portrait ? W - 96 : 1180);
  return (
    <div style={{ position: "absolute", left: (W - w) / 2, width: w, bottom: bottom ?? (portrait ? 200 : 72), display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      {page ? (
        <div
          style={{
            padding: `${14 * scale}px ${26 * scale}px`,
            borderRadius: R.lg,
            background: C.surface,
            boxShadow: `${SHADOW.float}, inset 0 0 0 1px ${C.line}`,
            fontFamily: FONT,
            fontSize: (portrait ? 34 : 36) * scale,
            fontWeight: 500,
            lineHeight: 1.3,
            color: C.ink,
            textAlign: "center",
            textWrap: "balance",
            whiteSpace: "pre-wrap",
          }}
        >
          {page.text.trim()}
        </div>
      ) : null}
    </div>
  );
};

/** Loads `public/captions/<name>.srt` or `.json` (Caption[]) and renders a CaptionTrack. Renders nothing if the file is not synced yet. */
export const SrtCaptions: React.FC<{ name: string; offsetMs?: number; combineMs?: number }> = ({ name, offsetMs = 0, combineMs }) => {
  const src = captionsFile(name);
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => (src ? delayRender(`captions ${name}`) : null));
  useEffect(() => {
    if (!src || handle === null) return;
    fetch(src)
      .then(async (r) => {
        const text = await r.text();
        const parsed: Caption[] = src.endsWith(".json") ? (JSON.parse(text) as Caption[]) : parseSrt({ input: text }).captions;
        setCaptions(parsed.map((c) => ({ ...c, startMs: c.startMs + offsetMs, endMs: c.endMs + offsetMs, timestampMs: c.timestampMs === null ? null : c.timestampMs + offsetMs })));
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [src, handle, offsetMs, continueRender, cancelRender]);
  if (!captions) return null;
  return <CaptionTrack captions={captions} combineMs={combineMs} />;
};

/** Build Caption[] from `[startSec, endSec, text]` rows, for captions written in code. */
export function captionsFrom(rows: Array<[number, number, string]>): Caption[] {
  return rows.map(([s, e, text]) => ({ text: ` ${text}`, startMs: s * 1000, endMs: e * 1000, timestampMs: null, confidence: null, pageBreakAfter: true }));
}
