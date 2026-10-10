/**
 * Record the dashboard side of the demo with Playwright video capture, one clip per shot.
 *
 *   pnpm record --inv154 inv_xxx --inv155 inv_yyy [--base https://kutip-app.vercel.app] [--only D4,D5]
 *
 * Launches your installed Google Chrome (channel "chrome") so passkeys (iCloud Keychain / Touch ID)
 * work, with a persistent profile in video/.pw-profile so you sign in once. Each shot opens a fresh
 * page at 1920×1080; the WebM is converted to 30 fps H.264 MP4 into docs/video/clips/<id>.mp4.
 *
 * The script never signs in, pays, approves or sends anything itself. It prints what to do and
 * waits for Enter. Shots marked "money" or "writes" ask before continuing.
 */
import { chromium, type BrowserContext, type Page } from "playwright";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");
const CLIPS = path.resolve(ROOT, "../docs/video/clips");
const PROFILE = path.join(ROOT, ".pw-profile");
const RAW = path.join(ROOT, ".pw-video");

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith("--") ? [a.slice(2), all[i + 1]?.startsWith("--") || all[i + 1] === undefined ? "true" : all[i + 1]] : [])).filter((p) => p.length)) as Record<string, string>;
const BASE = args.base ?? "https://kutip-app.vercel.app";
// Defaults: the pair from the Oct 10 demo-reset, so a bare `pnpm record` opens the right invoices.
const INV154 = args.inv154 && args.inv154 !== "true" ? args.inv154 : "inv_vAweoKgNCCB2tJvL7a1a";
const INV155 = args.inv155 && args.inv155 !== "true" ? args.inv155 : "inv_hajpQwJ3k5GYQyGc6rWk";
const ONLY = args.only ? args.only.split(",") : null;

type Shot = {
  id: string;
  title: string;
  url: string;
  /** What to do, printed before recording starts. */
  before?: string[];
  /** What to do while recording; Enter ends the shot. */
  during: string[];
  /** Wait until this text appears on the page before the prompt (e.g. "Settled"). */
  waitFor?: string;
  /** Auto slow scroll at the start of the shot. */
  scroll?: boolean;
  /** Needs confirmation because it moves money or writes production data. */
  caution?: "money" | "writes";
};

const need = (v: string | undefined, flag: string) => v ?? `<${flag} missing: pass --${flag} inv_…>`;

const SHOTS: Shot[] = [
  { id: "D1-dashboard", title: "Overview", url: `${BASE}/dashboard`, during: ["Let it sit 3 s, then scroll slowly to the bottom and back (the script scrolls for you)."], scroll: true },
  { id: "D2-new-invoice", title: "New invoice from a PDF", url: `${BASE}/invoices/new`, caution: "writes", before: ["Have packages/agent/fixtures/invoices/demo-harbourline-inv-0161-usd1.pdf ready to drag in."], during: ["Drag the PDF onto the drop zone, wait for the fields (~4 s), check the preview.", "Create & send creates a real invoice and emails the buyer: do it only if you want that in the demo DB."] },
  { id: "D3-invoice-overdue", title: "An overdue invoice + rulebook", url: `${BASE}/invoices`, during: ["Click an Overdue row (INV-2026-0142 Harbourline), scroll to Reminders, then open Rulebook from the rail."] },
  { id: "D4-live-flip", title: "Live flip while the phone pays", url: `${BASE}/invoices/${need(INV154, "inv154")}`, caution: "money", before: ["Phone: open the pay link for INV-2026-0154 in Safari, Phantom ready (not Solflare).", "Start the phone screen recording now (name it P1-phone-pay)."], during: ["Pay from the phone: Confirm and pay → SOL → Open in wallet → approve in Phantom.", "The script waits for 'Settled' on the page, then 6 s more. Don't touch the laptop."], waitFor: "Settled" },
  { id: "D4b-receipt", title: "Execution receipt", url: `${BASE}/invoices/${need(INV154, "inv154")}`, during: ["Scroll to the 'Payment received' receipt card; hover the Solscan link."], scroll: true },
  { id: "D5-agent-activity", title: "Agent activity after the payment", url: `${BASE}/agent`, during: ["Show 'Cancelled the reminder schedule' (C6) at the top; scroll a little."] },
  { id: "D6-inbox", title: "Buyer message → draft → approve", url: `${BASE}/inbox`, caution: "writes", before: ["Phone: pay page of INV-2026-0155 open, screen recording running (name it P2-phone-message)."], during: ["Phone: type 'Hi, can you resend the invoice? Our AP team needs a copy.' and Send.", "Laptop: the thread jumps to the top; open it; edit a word in the draft; Approve & send.", "Phone: the reply appears. Then press Enter here."] },
  { id: "D7-x402-flip", title: "x402 bot pays INV-0155", url: `${BASE}/invoices/${need(INV155, "inv155")}`, caution: "money", before: ["Terminal ready with:", `  pnpm --filter @kutip/solana bot ${BASE}/api/x402/invoice/${need(INV155, "inv155")} --yes 2>&1 | tee docs/video/clips/x402-bot.log`], during: ["Run the bot command in the terminal. The page flips Paid in ~5 s; wait for Settled, then Enter."], waitFor: "Settled" },
  { id: "D8-command-bar", title: "Command bar", url: `${BASE}/dashboard`, caution: "money", during: ["Type: What's due this week?  (wait for the list)", "Then: Sweep now → the dialog shows the preview. Pressing Sweep moves USDC: your call. Enter when done."] },
  { id: "D9-cash-out", title: "Cash out with Touch ID", url: `${BASE}/treasury`, caution: "money", during: ["Cash out → amount 0.25 → Propose → Approve with Touch ID. Wait for 'executed'. Enter when done."] },
  { id: "D11-treasury", title: "Treasury balances", url: `${BASE}/treasury`, during: ["Let it sit; the script scrolls once."], scroll: true },
];

async function slowScroll(page: Page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  for (let y = 0; y <= h; y += 24) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(800);
  for (let y = h; y >= 0; y -= 36) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(16);
  }
}

/** A visible cursor: Playwright videos don't capture the pointer. */
const CURSOR = `(() => { if (window.__kutipCursor) return; window.__kutipCursor = 1; const d = document.createElement('div');
d.style.cssText = 'position:fixed;left:0;top:0;width:18px;height:18px;border-radius:50%;background:oklch(52% 0.21 292 / 0.9);box-shadow:0 0 0 4px oklch(52% 0.21 292 / 0.25);pointer-events:none;z-index:2147483647;translate:-50% -50%;transition:scale .12s;opacity:0';
const add = () => document.body && document.body.appendChild(d); add() || document.addEventListener('DOMContentLoaded', add);
window.addEventListener('mousemove', e => { d.style.opacity = 1; d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }, true);
window.addEventListener('mousedown', () => { d.style.scale = '0.6'; }, true); window.addEventListener('mouseup', () => { d.style.scale = '1'; }, true); })();`;

async function main() {
  mkdirSync(CLIPS, { recursive: true });
  rmSync(RAW, { recursive: true, force: true });
  mkdirSync(RAW, { recursive: true });
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const ask = (q: string) => rl.question(`\n${q}\n> `);

  console.log(`Recording against ${BASE}. Clips → ${path.relative(process.cwd(), CLIPS)}`);
  if (!INV154 || !INV155) console.log("Tip: pass --inv154 and --inv155 (from demo-reset) so D4/D7 open the right invoices.");

  const context: BrowserContext = await chromium.launchPersistentContext(PROFILE, {
    channel: "chrome",
    headless: false,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: { dir: RAW, size: { width: 1920, height: 1080 } },
    args: ["--hide-scrollbars", "--window-size=1920,1180"],
  });

  // Sign-in (not recorded: this page's video is discarded).
  const signIn = await context.newPage();
  await signIn.goto(`${BASE}/onboarding`);
  await ask("Sign in with your passkey in the Chrome window (Chrome shows a picker: pick iCloud Keychain → Touch ID). Press Enter when the dashboard shows.");
  const signInVideo = await signIn.video()?.path();
  await signIn.close();
  if (signInVideo) rmSync(signInVideo, { force: true });

  for (const shot of SHOTS) {
    if (ONLY && !ONLY.includes(shot.id)) continue;
    console.log(`\n━━━ ${shot.id} · ${shot.title}`);
    if (shot.before?.length) console.log(shot.before.map((l) => `  • ${l}`).join("\n"));
    if (shot.caution) {
      const a = await ask(`This shot ${shot.caution === "money" ? "involves a payment or approval (you do it, the script only records)" : "writes real data to the production app"}. Record it? [y/N/s=skip]`);
      if (!/^y/i.test(a)) {
        console.log("  skipped");
        continue;
      }
    } else {
      await ask("Press Enter to start recording this shot.");
    }
    const page = await context.newPage();
    await page.addInitScript(CURSOR);
    await page.goto(shot.url, { waitUntil: "networkidle" });
    await page.evaluate(CURSOR);
    const started = Date.now();
    console.log(`  ● recording`);
    console.log(shot.during.map((l) => `  • ${l}`).join("\n"));
    if (shot.scroll) await slowScroll(page);
    if (shot.waitFor) {
      console.log(`  waiting for "${shot.waitFor}" on the page…`);
      try {
        await page.getByText(shot.waitFor, { exact: false }).first().waitFor({ timeout: 10 * 60 * 1000 });
        console.log(`  "${shot.waitFor}" seen after ${((Date.now() - started) / 1000).toFixed(1)} s; holding 6 s`);
        await page.waitForTimeout(6000);
      } catch {
        console.log("  timed out waiting; ending the shot anyway");
      }
    }
    await ask("Press Enter to end this shot.");
    const raw = await page.video()?.path();
    await page.close();
    if (!raw) {
      console.log("  no video captured");
      continue;
    }
    const webm = path.join(CLIPS, `${shot.id}.webm`);
    const mp4 = path.join(CLIPS, `${shot.id}.mp4`);
    renameSync(raw, webm);
    try {
      execFileSync("pnpm", ["exec", "remotion", "ffmpeg", "-y", "-v", "error", "-i", webm, "-r", "30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", "-an", mp4], { cwd: ROOT, stdio: "inherit" });
      rmSync(webm, { force: true });
      console.log(`  ✓ ${path.relative(process.cwd(), mp4)} (${((Date.now() - started) / 1000).toFixed(0)} s)`);
    } catch {
      console.log(`  ffmpeg failed; kept ${webm}`);
    }
  }
  await context.close();
  rl.close();
  if (existsSync(RAW)) rmSync(RAW, { recursive: true, force: true });
  console.log("\nDone. Next: drop phone recordings into docs/video/clips/ (P1-phone-pay.mp4, P2-phone-message.mp4), then `pnpm sync` in video/.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
