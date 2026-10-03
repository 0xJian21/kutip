import type React from "react";
import { useMemo } from "react";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme/tokens";
import { KutipMark } from "../ui/Mark";
import { EASE_EXPO } from "../lib/anim";

type WipeProps = { width: number; height: number; color?: string };

/** A violet disc grows from the centre to reveal the entering scene (the hook's colour shift, reused as a section transition). */
const DiscPresentation: React.FC<TransitionPresentationComponentProps<WipeProps>> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const r = Math.hypot(passedProps.width, passedProps.height) / 2;
  const radius = r * presentationProgress;
  const style = useMemo<React.CSSProperties>(() => (presentationDirection === "entering" ? { clipPath: `circle(${radius}px at 50% 50%)` } : {}), [presentationDirection, radius]);
  // A thin violet rim just outside the reveal edge, so the cut reads as a shape, not a hole.
  const rim = presentationDirection === "entering" && presentationProgress > 0 && presentationProgress < 1 ? (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: radius * 2 + 28, height: radius * 2 + 28, translate: "-50% -50%", borderRadius: 9999, boxShadow: `inset 0 0 0 14px ${passedProps.color ?? C.accent}` }} />
    </AbsoluteFill>
  ) : null;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={style}>{children}</AbsoluteFill>
      {rim}
    </AbsoluteFill>
  );
};

export const discWipe = (props: WipeProps): TransitionPresentation<WipeProps> => ({ component: DiscPresentation, props });

/**
 * Section stinger: a violet card sweeps across with the mark, for use as a
 * <TransitionSeries.Overlay> (does not shorten the timeline) over a hard cut.
 */
export const MarkStinger: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, width } = useVideoConfig();
  const p = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Card enters from the left, covers the frame at the midpoint, leaves to the right.
  const x = interpolate(p, [0, 0.45, 0.55, 1], [-width, 0, 0, width], { easing: EASE_EXPO });
  const markScale = interpolate(p, [0.3, 0.5, 0.7], [0.6, 1, 0.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: C.hero, translate: `${x}px 0px`, alignItems: "center", justifyContent: "center" }}>
        <div style={{ scale: `${markScale}` }}>
          <KutipMark size={160} color={C.surface} fg={C.heroButtonFg} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
