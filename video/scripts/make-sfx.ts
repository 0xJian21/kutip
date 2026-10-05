/**
 * Synthesize the hook's sound effects into public/sfx/*.wav (44.1 kHz mono, 16-bit).
 * Everything is generated from oscillators and seeded noise, so there is nothing to license
 * and a re-run produces identical files. Usage: pnpm sfx
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve(import.meta.dirname, "../public/sfx");
const SR = 44100;
const TAU = Math.PI * 2;

let seed = 0x6b757469; // "kuti"
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 0xffffffff) * 2 - 1;
};

const buf = (sec: number) => new Float32Array(Math.round(sec * SR));
const env = (t: number, attack: number, decay: number) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));

/** Sine whose frequency glides f0 → f1 (exponentially) over `glide` seconds. */
function sweep(out: Float32Array, f0: number, f1: number, glide: number, gain: number, attack: number, decay: number, at = 0) {
  let ph = 0;
  for (let i = Math.round(at * SR); i < out.length; i++) {
    const t = i / SR - at;
    const f = f0 * Math.pow(f1 / f0, Math.min(1, t / glide));
    ph += (TAU * f) / SR;
    out[i] += Math.sin(ph) * gain * env(t, attack, decay);
  }
}

/** Bell: a few inharmonic partials, each decaying at its own rate. */
function bell(out: Float32Array, f: number, gain: number, at = 0, decay = 0.6) {
  const partials: Array<[number, number, number]> = [[1, 1, 1], [2.0, 0.35, 0.6], [3.01, 0.12, 0.35], [4.17, 0.06, 0.2]];
  for (const [ratio, g, d] of partials) sweep(out, f * ratio, f * ratio, 1, gain * g, 0.002, decay * d, at);
}

/** Noise through a one-pole low-pass whose cutoff follows `cutoff(t)`, shaped by `amp(t)`. */
function filteredNoise(out: Float32Array, cutoff: (t: number) => number, amp: (t: number) => number, at = 0) {
  let lp = 0, lp2 = 0;
  for (let i = Math.round(at * SR); i < out.length; i++) {
    const t = i / SR - at;
    const a = 1 - Math.exp((-TAU * cutoff(t)) / SR);
    lp += a * (noise() - lp);
    lp2 += a * (lp - lp2);
    out[i] += lp2 * amp(t);
  }
}

function normalize(x: Float32Array, peak: number) {
  let m = 0;
  for (const v of x) m = Math.max(m, Math.abs(v));
  // 4 ms fade at both ends so no file clicks on cut-in.
  const fade = Math.round(0.004 * SR);
  for (let i = 0; i < x.length; i++) {
    const f = Math.min(1, i / fade, (x.length - 1 - i) / fade);
    x[i] = (x[i] / (m || 1)) * peak * f;
  }
  return x;
}

function wav(name: string, x: Float32Array) {
  const data = Buffer.alloc(x.length * 2);
  x.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(data.length, 40);
  writeFileSync(path.join(OUT, `${name}.wav`), Buffer.concat([h, data]));
  console.log(`public/sfx/${name}.wav  ${(x.length / SR).toFixed(2)} s`);
}

mkdirSync(OUT, { recursive: true });

// tick: soft UI click for text lines landing.
{
  const x = buf(0.06);
  sweep(x, 2600, 1800, 0.02, 1, 0.0005, 0.008);
  filteredNoise(x, () => 6000, (t) => 0.5 * Math.exp(-t / 0.003));
  wav("tick", normalize(x, 0.7));
}

// clock: woodblock tock for the wire's days.
{
  const x = buf(0.18);
  sweep(x, 1050, 900, 0.03, 1, 0.0008, 0.025);
  sweep(x, 2600, 2600, 1, 0.25, 0.0005, 0.01);
  wav("clock", normalize(x, 0.8));
}

// whoosh: air past the camera for cuts and slides.
{
  const d = 0.5;
  const x = buf(d);
  filteredNoise(x, (t) => 300 + 3200 * Math.sin((Math.PI * t) / d) ** 2, (t) => Math.sin((Math.PI * Math.min(t, d)) / d) ** 1.6);
  wav("whoosh", normalize(x, 0.8));
}

// thud: low punch under the giant numbers.
{
  const x = buf(0.45);
  sweep(x, 140, 45, 0.18, 1, 0.002, 0.14);
  filteredNoise(x, () => 900, (t) => 0.6 * Math.exp(-t / 0.012));
  wav("thud", normalize(x, 0.9));
}

// riser: noise and a rising tone that swells into the colour shift (cut off by the impact).
{
  const d = 1.6;
  const x = buf(d);
  const amp = (t: number) => (t / d) ** 2.2;
  filteredNoise(x, (t) => 400 + 6000 * (t / d) ** 2, amp);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    ph += (TAU * (180 * Math.pow(6, t / d))) / SR;
    x[i] += 0.35 * Math.sin(ph) * amp(t);
  }
  wav("riser", normalize(x, 0.75));
}

// impact: the grey world flips to violet.
{
  const x = buf(1.6);
  sweep(x, 90, 38, 0.5, 1, 0.003, 0.45);
  filteredNoise(x, (t) => 200 + 5000 * Math.exp(-t / 0.08), (t) => 0.9 * Math.exp(-t / 0.18));
  bell(x, 523.25, 0.25, 0.01, 1.2);
  wav("impact", normalize(x, 0.9));
}

// pop: the Kutip mark (and the end card) bouncing in.
{
  const x = buf(0.16);
  sweep(x, 380, 980, 0.05, 1, 0.001, 0.04);
  wav("pop", normalize(x, 0.8));
}

// scan: two short beeps, a QR being read.
{
  const x = buf(0.26);
  for (const at of [0, 0.11]) sweep(x, 1760, 1760, 1, 1, 0.002, 0.03, at);
  wav("scan", normalize(x, 0.55));
}

// paid: one bright bell.
{
  const x = buf(1.4);
  bell(x, 1318.5, 1, 0, 0.7);
  wav("paid", normalize(x, 0.7));
}

// settled: rising two-note chime (C6 → G6).
{
  const x = buf(1.8);
  bell(x, 1046.5, 0.8, 0, 0.6);
  bell(x, 1568, 1, 0.12, 0.8);
  wav("settled", normalize(x, 0.75));
}

// touch: Touch ID, a haptic thump then a confirming tick.
{
  const x = buf(0.4);
  sweep(x, 160, 110, 0.05, 1, 0.002, 0.03);
  sweep(x, 2100, 2100, 1, 0.45, 0.001, 0.03, 0.14);
  sweep(x, 2800, 2800, 1, 0.35, 0.001, 0.04, 0.2);
  wav("touch", normalize(x, 0.8));
}
