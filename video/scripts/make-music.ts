/**
 * Synthesize the hook's music bed into docs/video/music-hook.wav (44.1 kHz stereo, 16-bit), then run
 * `pnpm sync`. Written on the hook's beat grid (src/lib/beat.ts, 124 BPM): muted A minor through
 * the grey world, a drop into a bright C–G–Am–F groove on the colour shift (beat 25), a resolve
 * on the end card. To use a real track instead, save it as docs/video/music-hook.mp3, delete music-hook.wav, and run `pnpm sync`.
 * Usage: pnpm music
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve(import.meta.dirname, "../../docs/video/music-hook.wav");
const SR = 44100;
const TAU = Math.PI * 2;
const BPM = 124;
const BEATS = 62;
const SPB = 60 / BPM;
const t = (b: number) => b * SPB;
const N = Math.round(t(BEATS) * SR) + SR; // one second of tail
const L = new Float32Array(N);
const R = new Float32Array(N);
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

let seed = 0x6d757369; // "musi"
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 0xffffffff) * 2 - 1;
};

/** Beat positions (fractional) where the kick lands; the pad and bass duck after each one. */
const kicks: number[] = [];
/** 0..1 sidechain gain at time `s`. */
const pump = (s: number) => {
  let g = 1;
  for (const k of kicks) {
    const d = s - t(k);
    if (d >= 0 && d < 0.3) g = Math.min(g, 0.45 + 0.55 * (d / 0.3) ** 0.7);
  }
  return g;
};

/** Additive saw-ish voice with `harm` harmonics, detuned left/right, attack/release in seconds. */
function pad(midi: number, from: number, to: number, gain: number, harm: number, duck: boolean) {
  const f = hz(midi);
  const a = 0.35, r = 0.5;
  const i0 = Math.round(t(from) * SR), i1 = Math.min(N, Math.round((t(to) + r) * SR));
  for (let i = i0; i < i1; i++) {
    const s = i / SR, u = s - t(from);
    const e = Math.min(1, u / a) * (s > t(to) ? Math.max(0, 1 - (s - t(to)) / r) : 1) * (duck ? pump(s) : 1);
    let l = 0, rr = 0;
    for (let h = 1; h <= harm; h++) {
      l += Math.sin(TAU * f * h * 1.003 * u) / h;
      rr += Math.sin(TAU * f * h * 0.997 * u + 1.1) / h;
    }
    L[i] += l * gain * e;
    R[i] += rr * gain * e;
  }
}

function bass(midi: number, from: number, to: number, gain: number) {
  const f = hz(midi);
  const i0 = Math.round(t(from) * SR), i1 = Math.min(N, Math.round(t(to) * SR));
  for (let i = i0; i < i1; i++) {
    const s = i / SR, u = s - t(from);
    const e = Math.min(1, u / 0.01) * Math.min(1, (t(to) - s) / 0.03) * pump(s);
    const v = (Math.sin(TAU * f * u) + 0.3 * Math.sin(TAU * 2 * f * u)) * gain * e;
    L[i] += v;
    R[i] += v;
  }
}

function pluck(midi: number, at: number, gain: number, pan: number) {
  const f = hz(midi);
  const i0 = Math.round(t(at) * SR), i1 = Math.min(N, i0 + Math.round(0.5 * SR));
  for (let i = i0; i < i1; i++) {
    const u = (i - i0) / SR;
    const v = (Math.sin(TAU * f * u) + 0.25 * Math.sin(TAU * 2 * f * u) * Math.exp(-u / 0.03)) * Math.exp(-u / 0.12) * Math.min(1, u / 0.002) * gain;
    L[i] += v * (1 - pan);
    R[i] += v * (1 + pan);
  }
}

function kick(at: number, gain: number) {
  kicks.push(at);
  const i0 = Math.round(t(at) * SR);
  let ph = 0;
  for (let i = i0; i < Math.min(N, i0 + Math.round(0.35 * SR)); i++) {
    const u = (i - i0) / SR;
    ph += (TAU * (45 + 110 * Math.exp(-u / 0.03))) / SR;
    const v = Math.sin(ph) * Math.exp(-u / 0.12) * gain;
    L[i] += v;
    R[i] += v;
  }
}

/** Filtered noise hit: hats (bright, short) and claps (mid, longer). */
function hit(at: number, gain: number, decay: number, bright: boolean, pan = 0) {
  const i0 = Math.round(t(at) * SR);
  let lp = 0;
  for (let i = i0; i < Math.min(N, i0 + Math.round(decay * 6 * SR)); i++) {
    const u = (i - i0) / SR;
    const n = noise();
    lp += 0.25 * (n - lp);
    const v = (bright ? n - lp : lp) * Math.exp(-u / decay) * gain;
    L[i] += v * (1 - pan);
    R[i] += v * (1 + pan);
  }
}

// Kicks first so the sidechain knows them. Grey world: a heartbeat every two beats from the
// waiting, quarter notes into the shift, silence on the half beat before the impact.
for (let b = 7; b < 22; b += 2) kick(b, 0.35);
for (let b = 22; b < 24.5; b += 1) kick(b, 0.45);
for (let b = 25; b < 56; b += 1) kick(b, 0.75);

// Grey world, A minor, dark pad (few harmonics) and sustained bass.
const GREY: Array<[number, number, number[]]> = [
  [0, 8, [57, 60, 64]], // Am
  [8, 16, [53, 57, 60]], // F
  [16, 22, [50, 53, 57]], // Dm
  [22, 24.5, [52, 56, 59]], // E
];
for (const [a, b, notes] of GREY) {
  for (const m of notes) pad(m, a, b, 0.05, 3, true);
  bass(notes[0] - 12, a, b, 0.22);
}

// After the shift: C – G – Am – F, one bar each, brighter pad, eighth-note bass and arp.
const BRIGHT: Array<[number, number[]]> = [
  [60, [60, 64, 67]], [55, [59, 62, 67]], [57, [60, 64, 69]], [53, [60, 65, 69]],
];
for (let bar = 0; bar < 8; bar++) {
  const a = 25 + bar * 4;
  const b = Math.min(56, a + 4);
  const [root, notes] = BRIGHT[bar % 4];
  for (const m of notes) pad(m, a, b, 0.045, 6, true);
  for (let e = a; e < b; e += 0.5) bass(root - 24, e, e + 0.45, 0.28);
  const arp = [notes[0] + 12, notes[1] + 12, notes[2] + 12, notes[1] + 12];
  for (let e = a, j = 0; e < b; e += 0.5, j++) pluck(arp[j % 4], e, 0.07, j % 2 ? 0.4 : -0.4);
  for (let e = a; e < b; e += 1) {
    hit(e + 0.5, 0.06, 0.025, true, 0.3);
    if ((e - 25) % 2 === 1) hit(e, 0.16, 0.06, false);
  }
}

// End card: drums out, C add9 rings and a last pluck.
for (const m of [48, 55, 60, 64, 74]) pad(m, 56, 61, 0.045, 5, false);
pluck(84, 56, 0.08, 0);
pluck(79, 57, 0.06, -0.3);

// Soft-clip, normalise to -3 dBFS, 16-bit stereo WAV.
let peak = 0;
for (let i = 0; i < N; i++) {
  L[i] = Math.tanh(L[i]);
  R[i] = Math.tanh(R[i]);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const g = 0.708 / peak;
const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.round(L[i] * g * 32767), i * 4);
  data.writeInt16LE(Math.round(R[i] * g * 32767), i * 4 + 2);
}
const h = Buffer.alloc(44);
h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8);
h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34);
h.write("data", 36); h.writeUInt32LE(data.length, 40);
writeFileSync(OUT, Buffer.concat([h, data]));
console.log(`docs/video/music-hook.wav  ${(N / SR).toFixed(2)} s at ${BPM} BPM`);
