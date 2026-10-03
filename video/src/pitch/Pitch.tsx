import type React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { sec } from "../lib/beat";
import { audio } from "../lib/assets";
import { Hook } from "../hook/Hook";
import { TitleCard } from "../kit/TitleCard";
import { LowerThird } from "../kit/LowerThird";
import { ProofCard } from "../kit/ProofCard";
import { ClipSlot, Music, VoiceOver } from "../kit/Slots";
import { GtmCard, TeamCard, TrustCard, WhySolanaCard } from "../kit/InfoCard";
import { EndCard } from "../kit/EndCard";
import { SrtCaptions } from "../kit/Captions";
import { LogTerminal } from "../kit/LogTerminal";
import { PhoneFrame } from "../ui/Device";
import { C } from "../theme/tokens";

/**
 * PITCH, 2:00 hard limit (3600 frames). Segment starts are in seconds; change them here.
 * Slots: audio/vo-pitch.mp3, audio/music.mp3, clips/D1-dashboard, P1-phone-pay, D4-live-flip,
 * D6-inbox, D7-x402-flip, logs/x402-bot.log, captions/pitch.srt (or .json).
 */
export const PITCH = {
  hook: 0,
  user: 15,
  dashboard: 30,
  pay: 42,
  inbox: 60,
  x402: 70,
  whySolana: 78,
  gtm: 92,
  trust: 102,
  team: 111,
  end: 116,
  total: 120,
} as const;

export const Pitch: React.FC = () => {
  const { fps, width, height } = useVideoConfig();
  const d = (a: keyof typeof PITCH, b: keyof typeof PITCH) => sec(PITCH[b]) - sec(PITCH[a]);
  const vo = audio("vo-pitch");
  const voFrames = vo ? Math.round(vo.durationSec * fps) : 0;
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Sequence name="Hook (first 15 s)" from={sec(PITCH.hook)} durationInFrames={d("hook", "user")} premountFor={fps}>
        <Hook />
      </Sequence>
      <Sequence name="The user" from={sec(PITCH.user)} durationInFrames={d("user", "dashboard")} premountFor={fps}>
        <TitleCard
          eyebrow="Who it is for"
          title="The finance admin of a furniture exporter in Muar."
          caption="30 to 80 people. Teak and rubberwood to Sydney, Dallas and Riyadh on 30 to 60 day terms. Every invoice chased by email across four time zones; every wire 2 to 5 days and RM 50 to 150 in fees (est.)."
        />
      </Sequence>
      <Sequence name="Clip: the Overview" from={sec(PITCH.dashboard)} durationInFrames={d("dashboard", "pay")} premountFor={fps}>
        <ClipSlot name="D1-dashboard" describe="The owner's Overview after Touch ID sign-in: overdue invoices, the treasury in ringgit, the command bar." />
        <LowerThird name="Live on Solana mainnet" role="kutip-app.vercel.app, production app" />
      </Sequence>
      <Sequence name="Clip: the buyer pays (phone + live flip)" from={sec(PITCH.pay)} durationInFrames={d("pay", "inbox")} premountFor={fps}>
        <ClipSlot name="D4-live-flip" describe="The invoice page flipping Seen → Paid → Settled, no refresh." box={{ left: 0, top: 0, width, height }} />
        <div style={{ position: "absolute", left: 96, top: (height - 824 * 0.95) / 2, filter: "drop-shadow(0 24px 48px oklch(25% 0.03 290 / 0.25))" }}>
          <PhoneFrame scale={0.95}>
            <ClipSlot name="P1-phone-pay" describe="Phone: Confirm and pay → Phantom approves, 0 SOL fee." box={{ left: 0, top: 0, width: 375, height: 812 }} />
          </PhoneFrame>
        </div>
        <Sequence name="Proof: SOL in, exact USDC out" from={sec(10)} durationInFrames={sec(8)} premountFor={fps}>
          <ProofCard id="pay-sol" />
        </Sequence>
      </Sequence>
      <Sequence name="Clip: inbox, draft, approve" from={sec(PITCH.inbox)} durationInFrames={d("inbox", "x402")} premountFor={fps}>
        <ClipSlot name="D6-inbox" describe="A buyer question lands in the inbox; the agent drafts; you approve and send." />
        <LowerThird name="The agent proposes, you decide" role="Every action logged with its rule and confidence" />
      </Sequence>
      <Sequence name="x402: the buyer's AP bot pays" from={sec(PITCH.x402)} durationInFrames={d("x402", "whySolana")} premountFor={fps}>
        <ClipSlot name="D7-x402-flip" describe="INV-2026-0155 flipping Paid while the bot runs." box={{ left: width / 2, top: 0, width: width / 2, height }} />
        <LogTerminal name="x402-bot" title="pnpm --filter @kutip/solana bot … --yes" width={width / 2 - 48} height={height - 96} style={{ position: "absolute", left: 48, top: 48 }} />
        <Sequence name="Proof: x402" from={sec(3)} durationInFrames={sec(5)} premountFor={fps}>
          <ProofCard id="x402" />
        </Sequence>
      </Sequence>
      <Sequence name="Why Solana / Solami" from={sec(PITCH.whySolana)} durationInFrames={d("whySolana", "gtm")} premountFor={fps}>
        <WhySolanaCard />
      </Sequence>
      <Sequence name="Go-to-market" from={sec(PITCH.gtm)} durationInFrames={d("gtm", "trust")} premountFor={fps}>
        <GtmCard />
      </Sequence>
      <Sequence name="Trust and compliance" from={sec(PITCH.trust)} durationInFrames={d("trust", "team")} premountFor={fps}>
        <TrustCard />
      </Sequence>
      <Sequence name="Team" from={sec(PITCH.team)} durationInFrames={d("team", "end")} premountFor={fps}>
        <TeamCard />
      </Sequence>
      <Sequence name="End card" from={sec(PITCH.end)} durationInFrames={d("end", "total")} premountFor={fps}>
        <EndCard />
      </Sequence>
      <SrtCaptions name="pitch" />
      <VoiceOver name="vo-pitch" />
      <Music name="music" duck={vo ? [[0, voFrames]] : []} />
    </AbsoluteFill>
  );
};
