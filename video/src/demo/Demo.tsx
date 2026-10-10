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
type Shot = { name: string; sec: number; caption: string; clip?: string; trim?: number; rate?: number; lower?: [string, string]; proof?: string; phone?: string; terminal?: string; describe?: string };

/** Cut from the 10 Oct 2026 recording: `clip` overrides the file, `trim` skips into the take, `rate` speeds it up. */
export const DEMO_SHOTS: Shot[] = [
  { name: "D1-dashboard", clip: "D8-command-bar", trim: 2, sec: 6, caption: "Signed in with Touch ID: what came in, what's overdue, in ringgit.", lower: ["Overview", "kutip-app.vercel.app, Solana mainnet"], describe: "Overview" },
  { name: "D2-new-invoice", trim: 10, rate: 2.2, sec: 12, caption: "Drop the PDF. The agent reads it, you check it, one pay link goes out.", describe: "New invoice: PDF drop → fields → Create & send" },
  { name: "D3-invoice-overdue", trim: 52, rate: 3, sec: 12, caption: "Reminders in the buyer's hours, each with the rule it followed.", describe: "An overdue invoice: reminders, rule ids, then the Rulebook" },
  { name: "D4-live-flip", trim: 156, sec: 20, caption: "The buyer pays from Phantom with 0 gas. Payment received, then final. No refresh.", phone: "P1-phone-pay", proof: "pay-oct10", describe: "Pay page flipping live while the phone pays" },
  { name: "D4b-receipt", trim: 8.5, sec: 7, caption: "Exactly 1.00 USDC, network fee paid by Kutip, the Solscan link.", describe: "The receipt card" },
  { name: "D5-agent-activity", trim: 2, sec: 6, caption: "Reminders cancelled, each action logged with its rule.", describe: "Agent activity after the payment" },
  { name: "D6-inbox", trim: 152, rate: 2.2, sec: 14, caption: "A buyer question becomes a draft from that invoice only. You approve, it sends.", describe: "Inbox: message arrives, draft ready, Approve & send" },
  { name: "D7-x402-flip", trim: 28, sec: 13, caption: "The buyer's AP bot pays over x402: HTTP 402, pay, 200.", terminal: "x402-bot", proof: "x402-oct10", describe: "INV-0155 flipping Paid while the bot runs" },
  { name: "D8-command-bar", trim: 8, rate: 1.6, sec: 10, caption: "Ask in plain words. Nothing moves until you confirm.", describe: "Command bar: What's due this week?" },
  { name: "D9-cash-out", trim: 5, rate: 3.2, sec: 12, caption: "Cash out: the agent prepares it, you approve with Touch ID.", proof: "cash-out-oct10", describe: "Treasury → Cash out → Touch ID" },
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
              <ClipSlot name={s.clip ?? s.name} trimBeforeSec={s.trim} rate={s.rate} describe={s.describe} box={{ left: width / 2, top: 0, width: width / 2, height }} />
              <LogTerminal name={s.terminal} title="pnpm --filter @kutip/solana bot … --yes" width={width / 2 - 48} height={height - 96} style={{ position: "absolute", left: 48, top: 48 }} />
            </>
          ) : (
            <ClipSlot name={s.clip ?? s.name} trimBeforeSec={s.trim} rate={s.rate} describe={s.describe} />
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
