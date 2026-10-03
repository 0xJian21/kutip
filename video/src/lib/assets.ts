import { staticFile } from "remotion";
import { MANIFEST, type MediaInfo } from "../manifest.generated";

/** Find a synced clip by base name (any extension). `null` when it has not been provided yet. */
export function clip(name: string): MediaInfo | null {
  return MANIFEST.clips.find((c) => c.file === name || c.file.replace(/\.[^.]+$/, "") === name) ?? null;
}

export function audio(name: string): MediaInfo | null {
  return MANIFEST.audio.find((c) => c.file === name || c.file.replace(/\.[^.]+$/, "") === name) ?? null;
}

export const clipSrc = (info: MediaInfo) => staticFile(`clips/${info.file}`);
export const audioSrc = (info: MediaInfo) => staticFile(`audio/${info.file}`);

export function screen(name: string): string | null {
  return MANIFEST.screens.includes(name) ? staticFile(`screens/${name}`) : null;
}

export function captionsFile(name: string): string | null {
  const f = MANIFEST.captions.find((c) => c === name || c.replace(/\.[^.]+$/, "") === name);
  return f ? staticFile(`captions/${f}`) : null;
}

export function logFile(name: string): string | null {
  const f = MANIFEST.logs.find((c) => c === name || c.replace(/\.[^.]+$/, "") === name);
  return f ? staticFile(`logs/${f}`) : null;
}
