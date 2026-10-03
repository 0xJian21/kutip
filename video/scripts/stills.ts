/**
 * Render the hook's key frames as PNGs into docs/video/stills/ (both orientations).
 * Usage: pnpm stills            (frames listed below)
 *        pnpm stills 73 370     (specific frames, landscape only)
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve(import.meta.dirname, "../../docs/video/stills");
mkdirSync(OUT, { recursive: true });

const KEY = [
  ["01-muar-sydney", 73],
  ["02-fees-est", 247],
  ["03-colour-shift", 370],
  ["04-phone-qr", 537],
  ["05-agent-touch-id", 798],
  ["06-end-frame", 885],
] as const;

const custom = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n));
const jobs: Array<[string, string, number]> = custom.length ? custom.map((f) => ["Hook", `custom-${f}`, f]) : KEY.flatMap(([name, f]) => [["Hook", name, f], ["HookVertical", `${name}-vertical`, f]] as Array<[string, string, number]>);

for (const [comp, name, frame] of jobs) {
  const file = path.join(OUT, `${name}.png`);
  execFileSync("pnpm", ["exec", "remotion", "still", comp, file, `--frame=${frame}`, "--image-format=png", "--log=error"], { stdio: "inherit" });
  console.log(`${comp} @${frame} → docs/video/stills/${name}.png`);
}
