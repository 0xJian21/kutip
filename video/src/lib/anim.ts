import { Easing, interpolate, spring, useVideoConfig } from "remotion";

/** Product ease (globals.css --ease-out), and the landing's ease-out-expo for arrivals. */
export const EASE = Easing.bezier(0.22, 1, 0.36, 1);
export const EASE_EXPO = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN = Easing.bezier(0.7, 0, 0.84, 0);

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Linear 0..1 progress between two frames with the product ease. */
export function ease(frame: number, from: number, durationFrames: number, easing = EASE): number {
  return interpolate(frame, [from, from + durationFrames], [0, 1], { ...CLAMP, easing });
}

/** Enter: fade + rise. Returns style fragments. */
export function riseIn(frame: number, from: number, durationFrames = 14, distance = 28): { opacity: number; translate: string } {
  const p = ease(frame, from, durationFrames, EASE_EXPO);
  return { opacity: p, translate: `0px ${(1 - p) * distance}px` };
}

/** Exit: fade + lift, ending at `to`. */
export function liftOut(frame: number, to: number, durationFrames = 8, distance = -18): { opacity: number; translate: string } {
  const p = ease(frame, to - durationFrames, durationFrames, EASE_IN);
  return { opacity: 1 - p, translate: `0px ${p * distance}px` };
}

/** A pop with no bounce (damping 200), scaled 0..1. */
export function pop(frame: number, fps: number, from: number, durationInFrames = 18): number {
  return spring({ frame: frame - from, fps, config: { damping: 200, stiffness: 180 }, durationInFrames });
}

/** A pop with a little overshoot, for pills and chips landing. */
export function bounce(frame: number, fps: number, from: number): number {
  return spring({ frame: frame - from, fps, config: { damping: 14, stiffness: 160, mass: 0.8 } });
}

/** Portrait-aware layout numbers. `k` scales type designed for 1920 wide. */
export function useLayout() {
  const { width, height, fps } = useVideoConfig();
  const portrait = height > width;
  return {
    width,
    height,
    fps,
    portrait,
    k: portrait ? 0.82 : 1,
    /** Side gutter for key content. */
    gutter: portrait ? 72 : 120,
  };
}

/** Typed-out text: how many characters are visible at `frame`. */
export function typed(frame: number, from: number, text: string, charsPerFrame = 1.6): string {
  const n = Math.max(0, Math.floor((frame - from) * charsPerFrame));
  return text.slice(0, n);
}
