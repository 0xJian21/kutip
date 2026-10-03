import type React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { sec } from "../lib/beat";
import { audio } from "../lib/assets";
import { TitleCard } from "../kit/TitleCard";
import { LowerThird } from "../kit/LowerThird";
import { ProofCard } from "../kit/ProofCard";
import { ClipSlot, Music, VoiceOver } from "../kit/Slots";
import { EndCard } from "../kit/EndCard";
import { CaptionTrack, SrtCaptions, captionsFrom } from "../kit/Captions";
import { LogTerminal } from "../kit/LogTerminal";
import { PhoneFrame } from "../ui/Device";
import { C } from "../theme/tokens";

/**
 * DEMO, 2:00 hard limit. A walkthrough of the real clips in shot-list order (docs/video/README.md).
 * Durations below are seconds; keep the sum ≤ 120. Captions here are the on-screen captions
 * for each shot; the voice-over (audio/vo-demo.mp3) can say more.
 */
type Shot = { name: string; sec: number; caption: string; lower?: [string, string]; proof?: string; phone?: string; terminal?: string; describe?: string };

export const DEMO_SHOTS: Shot[] = [
  { name: "D1-dashboard", sec: 10, caption: "Sign in with Touch ID. Overdue invoices and the treasury, in ringgit.", lower: ["Overview", "kutip-app.vercel.app, Solana mainnet"], describe: "Sign-in → Overview" },
  { name: "D2-new-invoice", sec: 12, caption: "Drop the PDF. The agent reads it, you check it, one pay link goes out.", describe: "New invoice: PDF drop → fields → Create & send" },
  { name: "D3-invoice-overdue", sec: 10, caption: "Reminders in the buyer's hours, each with the rule it followed.", describe: "An overdue invoice: reminders, rule ids, then the Rulebook" },
  { name: "D4-live-flip", sec: 18, caption: "The buyer pays in SOL with 0 gas. Seen → Paid → Settled, live.", phone: "P1-phone-pay", proof: "pay-sol", describe: "Invoice page flipping live while the phone pays" },
  { name: "D4b-receipt", sec: 8, caption: "Execution receipt: exact USDC, the rate against BNM, the Solscan link.", describe: "Scroll to the execution receipt card" },
  { name: "D5-agent-activity", sec: 8, caption: "Reminders cancelled, receipt emailed. Logged with rule C6.", describe: "Agent activity after the payment" },
  { name: "D6-inbox", sec: 16, caption: "A buyer question becomes a draft in seconds. You approve, it sends.", phone: "P2-phone-message", describe: "Inbox: thread jumps to the top, draft ready, Approve & send" },
  { name: "D7-x402-flip", sec: 12, caption: "The buyer's AP bot pays over x402: HTTP 402 to 200 in 4.5 s.", terminal: "x402-bot", proof: "x402", describe: "INV-0155 flipping Paid while the bot runs" },
  { name: "D8-command-bar", sec: 9, caption: "Ask in plain words. Nothing moves until you confirm.", describe: "Command bar: What's due this week? → Sweep now" },
  { name: "D9-cash-out", sec: 8, caption: "Cash out: a proposal the agent prepares, approved with Touch ID.", proof: "cash-out", describe: "Treasury → Cash out → Touch ID" },
];

const INTRO = 3;
const OUTRO = 4;

export const Demo: React.FC = () => {
  const { fps, width, height } = useVideoConfig();
  const vo = audio("vo-demo");
  let cursor = INTRO;
  const starts = DEMO_SHOTS.map((s) => {
    const at = cursor;
    cursor += s.sec;
    return at;
  });
  const endAt = cursor;
  const captions = captionsFrom(DEMO_SHOTS.map((s, i) => [starts[i] + 0.4, starts[i] + s.sec - 0.4, s.caption]));
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Sequence name="Title" from={0} durationInFrames={sec(INTRO)} premountFor={fps}>
        <TitleCard eyebrow="Product demo" title="Kutip, live on Solana mainnet." caption="Everything here is the production app at kutip-app.vercel.app, recorded as it ran." />
      </Sequence>
      {DEMO_SHOTS.map((s, i) => (
        <Sequence key={s.name} name={`Shot ${i + 1}: ${s.name}`} from={sec(starts[i])} durationInFrames={sec(s.sec)} premountFor={fps}>
          {s.terminal ? (
            <>
              <ClipSlot name={s.name} describe={s.describe} box={{ left: width / 2, top: 0, width: width / 2, height }} />
              <LogTerminal name={s.terminal} title="pnpm --filter @kutip/solana bot … --yes" width={width / 2 - 48} height={height - 96} style={{ position: "absolute", left: 48, top: 48 }} />
            </>
          ) : (
            <ClipSlot name={s.name} describe={s.describe} />
          )}
          {s.phone ? (
            <div style={{ position: "absolute", left: 96, top: (height - 824 * 0.9) / 2, filter: "drop-shadow(0 24px 48px oklch(25% 0.03 290 / 0.25))" }}>
              <PhoneFrame scale={0.9}>
                <ClipSlot name={s.phone} describe="Phone screen recording" box={{ left: 0, top: 0, width: 375, height: 812 }} />
              </PhoneFrame>
            </div>
          ) : null}
          {s.lower ? <LowerThird name={s.lower[0]} role={s.lower[1]} /> : null}
          {s.proof ? (
            <Sequence name={`Proof: ${s.proof}`} from={sec(Math.max(2, s.sec - 8))} durationInFrames={sec(6)} premountFor={fps}>
              <ProofCard id={s.proof} />
            </Sequence>
          ) : null}
        </Sequence>
      ))}
      <Sequence name="End card" from={sec(endAt)} durationInFrames={sec(OUTRO)} premountFor={fps}>
        <EndCard />
      </Sequence>
      {/* On-screen captions from the shot list; a synced captions/demo.srt replaces them. */}
      {vo ? <SrtCaptions name="demo" /> : <CaptionTrack captions={captions} />}
      <VoiceOver name="vo-demo" />
      <Music name="music" duck={vo ? [[0, Math.round(vo.durationSec * fps)]] : []} />
    </AbsoluteFill>
  );
};

export const DEMO_FRAMES = sec(INTRO + DEMO_SHOTS.reduce((a, s) => a + s.sec, 0) + OUTRO);
