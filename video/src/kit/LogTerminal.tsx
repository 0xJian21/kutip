import type React from "react";
import { useEffect, useState } from "react";
import { useDelayRender, useVideoConfig } from "remotion";
import { logFile } from "../lib/assets";
import { Terminal, type TermLine } from "../ui/Terminal";
import { C, R } from "../theme/tokens";
import { FONT } from "../theme/fonts";

/**
 * A terminal fed by a real log file in public/logs (synced from docs/video/clips/*.log),
 * revealed one line every `frameGap` frames. Shows a slate until the file is provided.
 * Lines containing "Seen", "Paid", "Settled", "Catch-up", "subscribed" get a tone.
 */
export const LogTerminal: React.FC<{ name: string; title?: string; width: number; height: number; frameGap?: number; fontSize?: number; style?: React.CSSProperties }> = ({ name, title, width, height, frameGap = 10, fontSize, style }) => {
  const src = logFile(name);
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [lines, setLines] = useState<TermLine[] | null>(null);
  const [handle] = useState(() => (src ? delayRender(`log ${name}`) : null));
  useEffect(() => {
    if (!src || handle === null) return;
    fetch(src)
      .then(async (r) => {
        const text = await r.text();
        const rows = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        setLines(rows.map((text, i) => ({ text, at: i * frameGap, tone: toneOf(text) })));
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [src, handle, frameGap, continueRender, cancelRender]);
  if (!src) return <LogSlate name={name} width={width} height={height} style={style} />;
  if (!lines) return null;
  return <Terminal lines={lines} title={title ?? name} width={width} height={height} fontSize={fontSize} style={style} />;
};

function toneOf(line: string): TermLine["tone"] {
  if (/settled|finalized|200 OK|receipt/i.test(line)) return "ok";
  if (/paid|confirmed|subscribed|Catch-up/i.test(line)) return "accent";
  if (/warn|failed|retry|down/i.test(line)) return "warn";
  if (/^\s*\d{4}-\d{2}-\d{2}|^\[/.test(line)) return undefined;
  return undefined;
}

/** Commands typed from the README, one per `gap` frames, with a prompt. */
export const CommandTerminal: React.FC<{ commands: string[]; title?: string; width: number; height: number; gap?: number; fontSize?: number; style?: React.CSSProperties }> = ({ commands, title = "~/kutip", width, height, gap = 24, fontSize, style }) => {
  const lines: TermLine[] = commands.map((c, i) => ({ text: c.startsWith("#") ? c : `$ ${c}`, at: i * gap, tone: c.startsWith("#") ? "dim" : undefined }));
  return <Terminal lines={lines} title={title} width={width} height={height} fontSize={fontSize} style={style} />;
};

const LogSlate: React.FC<{ name: string; width: number; height: number; style?: React.CSSProperties }> = ({ name, width, height, style }) => {
  const { fps } = useVideoConfig();
  void fps;
  return (
    <div style={{ width, height, borderRadius: R.xl, background: C.darkPaper, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 48, fontFamily: FONT, color: C.darkInk2, ...style }}>
      <div style={{ padding: "28px 36px", borderRadius: R.xl, border: `2px dashed ${C.darkLine}`, maxWidth: 640 }}>
        <div style={{ fontSize: 20, color: C.darkInk3 }}>Waiting for your log</div>
        <div style={{ marginTop: 8, fontSize: 28, fontWeight: 600, color: C.darkInk, wordBreak: "break-all" }}>docs/video/clips/{name}.log</div>
        <div style={{ marginTop: 12, fontSize: 18, color: C.darkInk3 }}>Plain text, one line per log entry. Then `pnpm sync`.</div>
      </div>
    </div>
  );
};
