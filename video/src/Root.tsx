import type React from "react";
import { Composition, Folder, Still } from "remotion";
import { HOOK_FRAMES, FPS, sec } from "./lib/beat";
import { Hook } from "./hook/Hook";
import { Pitch, PITCH } from "./pitch/Pitch";
import { Demo, DEMO_FRAMES } from "./demo/Demo";
import { Solami, SOLAMI } from "./solami/Solami";
import { TitleCard } from "./kit/TitleCard";
import { LowerThird } from "./kit/LowerThird";
import { ProofCard } from "./kit/ProofCard";
import { GtmCard, TeamCard, TrustCard, WhySolanaCard } from "./kit/InfoCard";
import { EndCard } from "./kit/EndCard";
import { MarkStinger } from "./kit/Stinger";
import { CaptionTrack, captionsFrom } from "./kit/Captions";
import { AbsoluteFill } from "remotion";
import { C } from "./theme/tokens";
import { TreasuryCard } from "./ui/TreasuryCard";
import { PayPage } from "./ui/PayPage";
import { PhoneFrame } from "./ui/Device";
import { FlipCard } from "./ui/FlipCard";
import { AgentRow } from "./ui/AgentRow";

const W = 1920, H = 1080;

/** Kit previews need a canvas; the cards themselves are overlays. */
const OnPaper: React.FC<{ children: React.ReactNode }> = ({ children }) => <AbsoluteFill style={{ background: C.paper }}>{children}</AbsoluteFill>;
const LowerThirdPreview: React.FC = () => <OnPaper><LowerThird name="Farid Zulkifli" role="Owner · Teratai Woodworks (demo exporter)" /></OnPaper>;
const ProofPreview: React.FC = () => <OnPaper><ProofCard id="pay-sol" /></OnPaper>;
const CaptionsPreview: React.FC = () => <OnPaper><CaptionTrack captions={captionsFrom([[0.2, 2.2, "Captions in the product's voice: a white pill, ink text."], [2.4, 4.6, "Load a .srt or Caption[] JSON from docs/video/captions."]])} /></OnPaper>;
const TitlePreview: React.FC = () => <TitleCard eyebrow="Section" title="A title card in the daylight ledger." caption="Caption text sits under the headline, in ink-2." />;
const UiPreview: React.FC = () => (
  <OnPaper>
    <div style={{ position: "absolute", left: 120, top: 120 }}><TreasuryCard scale={1.4} width={520} meterFrom={10} meterValue={0.35} /></div>
    <div style={{ position: "absolute", left: 120, top: 640 }}><AgentRow scale={1.1} width={760} touchAt={40} /></div>
    <div style={{ position: "absolute", left: 1000, top: 120 }}><FlipCard seenAt={20} scale={1.6} /></div>
    <div style={{ position: "absolute", left: 1480, top: 80 }}><PhoneFrame scale={1.1}><PayPage stage="qr" /></PhoneFrame></div>
  </OnPaper>
);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Hook">
        <Composition id="Hook" component={Hook} durationInFrames={HOOK_FRAMES} fps={FPS} width={W} height={H} />
        <Composition id="HookVertical" component={Hook} durationInFrames={HOOK_FRAMES} fps={FPS} width={1080} height={1920} />
      </Folder>
      <Folder name="Timelines">
        <Composition id="Pitch" component={Pitch} durationInFrames={sec(PITCH.total)} fps={FPS} width={W} height={H} />
        <Composition id="Demo" component={Demo} durationInFrames={DEMO_FRAMES} fps={FPS} width={W} height={H} />
        <Composition id="Solami" component={Solami} durationInFrames={sec(SOLAMI.total)} fps={FPS} width={W} height={H} />
      </Folder>
      <Folder name="Kit">
        <Composition id="TitleCard" component={TitlePreview} durationInFrames={sec(4)} fps={FPS} width={W} height={H} />
        <Composition id="LowerThird" component={LowerThirdPreview} durationInFrames={sec(4)} fps={FPS} width={W} height={H} />
        <Composition id="Captions" component={CaptionsPreview} durationInFrames={sec(5)} fps={FPS} width={W} height={H} />
        <Composition id="Stinger" component={MarkStinger} durationInFrames={24} fps={FPS} width={W} height={H} />
        <Composition id="ProofCard" component={ProofPreview} durationInFrames={sec(4)} fps={FPS} width={W} height={H} />
        <Composition id="WhySolana" component={WhySolanaCard} durationInFrames={sec(6)} fps={FPS} width={W} height={H} />
        <Composition id="Trust" component={TrustCard} durationInFrames={sec(6)} fps={FPS} width={W} height={H} />
        <Composition id="GoToMarket" component={GtmCard} durationInFrames={sec(6)} fps={FPS} width={W} height={H} />
        <Composition id="Team" component={TeamCard} durationInFrames={sec(6)} fps={FPS} width={W} height={H} />
        <Composition id="EndCard" component={EndCard} durationInFrames={sec(5)} fps={FPS} width={W} height={H} />
        <Composition id="RecreatedUi" component={UiPreview} durationInFrames={sec(5)} fps={FPS} width={W} height={H} />
      </Folder>
      <Folder name="Stills">
        <Still id="EndFrame" component={EndCard} width={W} height={H} defaultProps={{ markAt: -60, taglineAt: -60, urlAt: -60, footerAt: -60 }} />
      </Folder>
    </>
  );
};
