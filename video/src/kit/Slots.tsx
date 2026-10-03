import type React from "react";
import { Audio, Video } from "@remotion/media";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, R } from "../theme/tokens";
import { FONT } from "../theme/fonts";
import { audio, audioSrc, clip, clipSrc } from "../lib/assets";
import { BrowserFrame, PhoneFrame } from "../ui/Device";
import { APP_URL } from "../data/proof";

/**
 * A slot for one of the user's recordings (docs/video/clips/<name>.*, synced to public/clips).
 * Plays the file when it exists; otherwise shows a slate naming the file that is still needed,
 * so the whole timeline renders before every clip is in.
 */
export const ClipSlot: React.FC<{
  name: string;
  /** What the slate should say the clip shows. */
  describe?: string;
  frame?: "none" | "browser" | "phone";
  trimBeforeSec?: number;
  fit?: "cover" | "contain";
  muted?: boolean;
  style?: React.CSSProperties;
  /** Box the clip is drawn into; default is the full frame. */
  box?: { left: number; top: number; width: number; height: number };
}> = ({ name, describe, frame = "none", trimBeforeSec = 0, fit = "cover", muted = true, style, box }) => {
  const { fps, width, height } = useVideoConfig();
  const info = clip(name);
  const b = box ?? { left: 0, top: 0, width, height };
  const body = info ? (
    <Video src={clipSrc(info)} trimBefore={Math.round(trimBeforeSec * fps)} premountFor={fps} muted={muted} style={{ width: "100%", height: "100%", objectFit: fit }} />
  ) : (
    <Slate name={name} describe={describe} compact={frame === "phone" || b.width < 700} />
  );
  const inner =
    frame === "browser" ? (
      <BrowserFrame url={`${APP_URL}/dashboard`} width={b.width} height={b.height}>
        {body}
      </BrowserFrame>
    ) : frame === "phone" ? (
      <PhoneFrame scale={b.height / 824} screenWidth={375} screenHeight={812}>
        <div style={{ width: 375, height: 812 }}>{body}</div>
      </PhoneFrame>
    ) : (
      <div style={{ width: b.width, height: b.height, overflow: "hidden", background: C.paper }}>{body}</div>
    );
  return <div style={{ position: "absolute", left: b.left, top: b.top, width: b.width, height: b.height, ...style }}>{inner}</div>;
};

const Slate: React.FC<{ name: string; describe?: string; compact?: boolean }> = ({ name, describe, compact = false }) => {
  const k = compact ? 0.6 : 1;
  return (
    <AbsoluteFill style={{ background: C.paper2, alignItems: "center", justifyContent: "center", fontFamily: FONT, color: C.ink2, padding: 24 * k, textAlign: "center" }}>
      <div style={{ padding: `${28 * k}px ${28 * k}px`, borderRadius: R.xl, border: `2px dashed ${C.lineStrong}`, maxWidth: 720 }}>
        <div style={{ fontSize: 22 * k, fontWeight: 500, color: C.ink3 }}>Waiting for your clip</div>
        <div style={{ marginTop: 8 * k, fontSize: 30 * k, fontWeight: 600, color: C.ink, overflowWrap: "anywhere" }}>{compact ? `${name}.mp4` : `docs/video/clips/${name}.mp4`}</div>
        {describe ? <div style={{ marginTop: 12 * k, fontSize: 22 * k, lineHeight: 1.4 }}>{describe}</div> : null}
        <div style={{ marginTop: 16 * k, fontSize: 18 * k, color: C.ink3 }}>Drop the file in, then run `pnpm sync` in video/.</div>
      </div>
    </AbsoluteFill>
  );
};

/** Voice-over: plays public/audio/<name>.mp3 if synced; silent otherwise. */
export const VoiceOver: React.FC<{ name: string; volume?: number }> = ({ name, volume = 1 }) => {
  const { fps } = useVideoConfig();
  const info = audio(name);
  if (!info) return null;
  return <Audio src={audioSrc(info)} volume={volume} premountFor={fps} />;
};

/**
 * Music bed with ducking: `duck` is a list of [fromFrame, toFrame] windows (where the voice-over
 * speaks) during which the level drops to `duckTo`, with 12-frame ramps.
 */
export const Music: React.FC<{ name?: string; level?: number; duckTo?: number; duck?: Array<[number, number]>; fadeOutFrames?: number }> = ({ name = "music", level = 0.6, duckTo = 0.18, duck = [], fadeOutFrames = 45 }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const info = audio(name);
  if (!info) return null;
  const ramp = 12;
  let gain = 1;
  for (const [a, b] of duck) {
    const g = interpolate(frame, [a - ramp, a, b, b + ramp], [1, duckTo / level, duckTo / level, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    gain = Math.min(gain, g);
  }
  const tail = interpolate(frame, [durationInFrames - fadeOutFrames, durationInFrames - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <Audio src={audioSrc(info)} volume={level * gain * tail} premountFor={fps} loop />;
};
