import type React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { sec } from "../lib/beat";
import { audio } from "../lib/assets";
import { TitleCard } from "../kit/TitleCard";
import { ProofCard } from "../kit/ProofCard";
import { ClipSlot, Music, VoiceOver } from "../kit/Slots";
import { InfoCard } from "../kit/InfoCard";
import { EndCard } from "../kit/EndCard";
import { CaptionTrack, SrtCaptions, captionsFrom } from "../kit/Captions";
import { CommandTerminal, LogTerminal } from "../kit/LogTerminal";
import { C } from "../theme/tokens";

/**
 * SOLAMI, 2:30. The gRPC stream on mainnet (worker logs beside the dashboard flipping),
 * catch-up, balances, then clone-and-run from the README. Segment starts in seconds.
 * Slots: logs/worker-stream.log, logs/worker-catchup.log, clips/D4-live-flip, D10-catchup, D11-treasury,
 * audio/vo-solami.mp3, captions/solami.srt.
 */
export const SOLAMI = { title: 0, how: 6, stream: 16, catchup: 56, balances: 76, run: 96, end: 136, total: 150 } as const;

const HOW = [
  { title: "One stream, every account", body: "Yellowstone gRPC on Solami: processed transactions touching any open invoice's reference key or buyer vault, plus slot updates." },
  { title: "Seen, Paid, Settled", body: "processed → Seen, confirmed → Paid, finalized → Settled. The filter set is rewritten in place as invoices open and close." },
  { title: "Verified from tx meta", body: "USDC mint, exact amount, destination = that buyer's vault, memo matches. Look-alike mints are rejected." },
  { title: "Catch-up over RPC", body: "Every 3 minutes, and on startup, signatures for watched accounts are fetched over Solami RPC so a restart never misses a payment." },
];

const README_COMMANDS = [
  "git clone https://github.com/0xJian21/kutip kutip && cd kutip",
  "pnpm install",
  "# .env: SOLAMI_API_KEY, SOLAMI_RPC_URL, SOLAMI_GRPC_URL from your Solami dashboard",
  "pnpm --filter @kutip/db db:migrate",
  "pnpm --filter @kutip/db db:seed",
  "pnpm --filter web dev",
  "COLLECTIONS=dry pnpm --filter @kutip/worker dev",
];

export const Solami: React.FC = () => {
  const { fps, width, height } = useVideoConfig();
  const d = (a: keyof typeof SOLAMI, b: keyof typeof SOLAMI) => sec(SOLAMI[b]) - sec(SOLAMI[a]);
  const vo = audio("vo-solami");
  const captions = captionsFrom([
    [SOLAMI.stream + 1, SOLAMI.stream + 8, "Left: the worker's gRPC stream on Solami. Right: the invoice page, no refresh."],
    [SOLAMI.stream + 20, SOLAMI.stream + 28, "processed → Seen, confirmed → Paid, finalized → Settled."],
    [SOLAMI.catchup + 1, SOLAMI.catchup + 8, "Restart the worker: catch-up finds the payment over RPC within 3 minutes."],
    [SOLAMI.balances + 1, SOLAMI.balances + 8, "Vault and treasury balances update from the same stream."],
    [SOLAMI.run + 1, SOLAMI.run + 8, "Clone it, add your Solami key, run it. Nothing else is tied to ours."],
  ]);
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Sequence name="Title" from={sec(SOLAMI.title)} durationInFrames={d("title", "how")} premountFor={fps}>
        <TitleCard eyebrow="Solami prize" title="Payment detection on a Solami gRPC stream, live on mainnet." caption="This is the worker that moves an invoice from Seen to Paid to Settled, and how to run it on your own key." />
      </Sequence>
      <Sequence name="How the worker listens" from={sec(SOLAMI.how)} durationInFrames={d("how", "stream")} premountFor={fps}>
        <InfoCard eyebrow="How it listens" title="Four things the worker does with the stream." points={HOW} columns={2} footnote="apps/worker/src/stream.ts, payments.ts, verify.ts" />
      </Sequence>
      <Sequence name="Live stream: logs + dashboard" from={sec(SOLAMI.stream)} durationInFrames={d("stream", "catchup")} premountFor={fps}>
        <LogTerminal name="worker-stream" title="fly logs -a kutip-worker" width={width / 2 - 72} height={height - 120} frameGap={12} style={{ position: "absolute", left: 48, top: 60 }} />
        <ClipSlot name="D4-live-flip" describe="Invoice page flipping Seen → Paid → Settled while the stream logs on the left." box={{ left: width / 2, top: 60, width: width / 2 - 48, height: height - 120 }} frame="browser" />
        <Sequence name="Proof" from={sec(30)} durationInFrames={sec(9)} premountFor={fps}>
          <ProofCard id="pay-sol" position="bottom-left" />
        </Sequence>
      </Sequence>
      <Sequence name="Catch-up" from={sec(SOLAMI.catchup)} durationInFrames={d("catchup", "balances")} premountFor={fps}>
        <LogTerminal name="worker-catchup" title="worker restart → catch-up" width={width / 2 - 72} height={height - 120} frameGap={12} style={{ position: "absolute", left: 48, top: 60 }} />
        <ClipSlot name="D10-catchup" describe="Optional: the invoice page after a worker restart, Paid without the stream." box={{ left: width / 2, top: 60, width: width / 2 - 48, height: height - 120 }} frame="browser" />
      </Sequence>
      <Sequence name="Balances" from={sec(SOLAMI.balances)} durationInFrames={d("balances", "run")} premountFor={fps}>
        <ClipSlot name="D11-treasury" describe="Treasury page: buyer accounts and the treasury balance, refreshed from the stream." />
      </Sequence>
      <Sequence name="Clone and run" from={sec(SOLAMI.run)} durationInFrames={d("run", "end")} premountFor={fps}>
        <InfoCard eyebrow="Run it yourself" title="Three env vars from your Solami dashboard. That is the whole dependency." points={[{ title: "SOLAMI_API_KEY", body: "Sent as x-token on the gRPC stream and as the RPC key." }, { title: "SOLAMI_GRPC_URL", body: "Yellowstone endpoint. One worker uses one stream; the Pro plan allows two." }, { title: "SOLAMI_RPC_URL", body: "Blockhashes, sends, confirmations and the catch-up." }]} columns={3} />
        <CommandTerminal commands={README_COMMANDS} width={width - 240} height={400} gap={40} style={{ position: "absolute", left: 120, bottom: 72 }} />
      </Sequence>
      <Sequence name="End card" from={sec(SOLAMI.end)} durationInFrames={d("end", "total")} premountFor={fps}>
        <EndCard />
      </Sequence>
      {vo ? <SrtCaptions name="solami" /> : <CaptionTrack captions={captions} />}
      <VoiceOver name="vo-solami" />
      <Music name="music" duck={vo ? [[0, Math.round(vo.durationSec * fps)]] : []} />
    </AbsoluteFill>
  );
};
