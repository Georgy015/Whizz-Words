// Background music: a lo-fi, funky loop synthesized live with Web Audio.
// Mellow electric-piano chords (Fmaj9 – Em7 – Dm9 – G13), a syncopated bass,
// a swung beat and a little vinyl crackle. It only plays while you're in a
// round; main.js starts and stops it as screens open and close.

import { audioContext } from './sound.js';

const BPM = 84;
const STEP = 60 / BPM / 4; // one 16th note
const SWING = 0.22; // off-beat 16ths are pushed late by this share of a step
const VOLUME = 0.32;

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// One bar per chord: rootless keys voicing and the bass root.
const CHORDS = [
  { keys: [57, 64, 67, 72], root: 41 }, // Fmaj9
  { keys: [55, 62, 64, 71], root: 40 }, // Em7
  { keys: [53, 60, 64, 69], root: 38 }, // Dm9
  { keys: [53, 59, 64, 69], root: 43 }, // G13
];

// 16th-step patterns within a bar.
const KEYS_HITS = [0, 6, 10]; // a held chord, then two short stabs
const BASS = [ // [step, semitones above root, length in steps]
  [0, 0, 3], [3, 12, 1], [6, 7, 2], [8, 0, 2], [11, 12, 1], [14, -1, 2],
];
const KICK = [0, 7, 10];
const SNARE = [4, 12];
// A sparse pentatonic phrase for every other 8-bar cycle (bars 3–4).
const MELODY = [[0, 76], [3, 79], [6, 81], [10, 79], [16, 76], [19, 74], [22, 72]];

let ctx = null;
let bus = null;
let timer = null;
let step = 0; // position in the song, in 16ths
let nextTime = 0;
let enabled = true;
try { enabled = localStorage.getItem('whizz-music') !== 'off'; } catch { /* storage unavailable */ }

export const musicOn = () => enabled;

export function setMusic(on) {
  enabled = on;
  try { localStorage.setItem('whizz-music', on ? 'on' : 'off'); } catch { /* storage unavailable */ }
  if (!on) stopMusic();
}

function setup() {
  ctx = audioContext();
  if (!ctx || bus) return;
  bus = ctx.createGain();
  bus.gain.value = 0;
  // Lo-fi: roll off the top end.
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 3800;
  bus.connect(tone).connect(ctx.destination);
}

function env(at, dur, peak, attack = 0.01) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  return g;
}

function osc(type, freq, at, dur, gainNode, detune = 0) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  o.detune.value = detune;
  o.connect(gainNode);
  o.start(at);
  o.stop(at + dur + 0.05);
}

function noiseBuffer(dur) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function noiseHit(at, dur, gain, type, freq) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(dur);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  src.connect(f).connect(env(at, dur, gain, 0.002)).connect(bus);
  src.start(at);
}

// Electric-piano-ish note: sine body plus a soft, slightly detuned triangle.
function keys(note, at, dur, gain) {
  const g = env(at, dur, gain, 0.015);
  const warm = ctx.createBiquadFilter();
  warm.type = 'lowpass';
  warm.frequency.value = 1700;
  g.connect(warm).connect(bus);
  osc('sine', midi(note), at, dur, g);
  osc('triangle', midi(note), at, dur, g, 7);
}

function bass(note, at, dur) {
  const g = env(at, dur, 0.32, 0.008);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 520;
  g.connect(f).connect(bus);
  osc('triangle', midi(note), at, dur, g);
  osc('sine', midi(note), at, dur, g);
}

function kick(at) {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(130, at);
  o.frequency.exponentialRampToValueAtTime(42, at + 0.18);
  o.connect(env(at, 0.32, 0.55, 0.003)).connect(bus);
  o.start(at);
  o.stop(at + 0.4);
}

function snare(at) {
  noiseHit(at, 0.16, 0.18, 'bandpass', 1900);
  osc('triangle', 190, at, 0.08, env(at, 0.08, 0.1, 0.002));
}

const hat = (at, gain) => noiseHit(at, 0.04, gain, 'highpass', 7500);
const crackle = (at) => noiseHit(at, 0.012, 0.05 + Math.random() * 0.05, 'highpass', 2500);

// Schedule everything that falls on one 16th step.
function playStep(s, at) {
  const inBar = s % 16;
  const bar = Math.floor(s / 16);
  const chord = CHORDS[bar % CHORDS.length];
  const cycle = Math.floor(bar / 8);
  const barInCycle = bar % 8;
  // The last bar of each 8-bar cycle drops the drums for a breath.
  const drums = barInCycle !== 7;

  if (KEYS_HITS.includes(inBar)) {
    const held = inBar === 0;
    chord.keys.forEach((n, i) => keys(n, at + i * 0.012, held ? STEP * 7 : STEP * 1.6, held ? 0.05 : 0.035));
  }
  for (const [st, offset, len] of BASS) {
    if (st === inBar) bass(chord.root + offset, at, STEP * len * 0.9);
  }
  if (drums) {
    if (KICK.includes(inBar)) kick(at);
    if (SNARE.includes(inBar)) snare(at);
    if (inBar % 2 === 0) hat(at, inBar % 4 === 0 ? 0.05 : 0.035);
    else if (Math.random() < 0.3) hat(at, 0.015); // ghost hats
  }
  // Melody on bars 3–4 of every other cycle.
  if (cycle % 2 === 1 && (barInCycle === 2 || barInCycle === 3)) {
    const pos = (barInCycle - 2) * 16 + inBar;
    for (const [st, n] of MELODY) if (st === pos) keys(n, at, STEP * 3, 0.04);
  }
  if (Math.random() < 0.08) crackle(at + Math.random() * STEP);
}

function schedule() {
  while (nextTime < ctx.currentTime + 0.15) {
    const swing = step % 2 === 1 ? SWING * STEP : 0;
    playStep(step, nextTime + swing);
    nextTime += STEP;
    step += 1;
  }
}

export function startMusic() {
  if (!enabled) return;
  setup();
  if (!ctx || timer) return;
  nextTime = ctx.currentTime + 0.08;
  timer = setInterval(schedule, 30);
  bus.gain.cancelScheduledValues(ctx.currentTime);
  bus.gain.setTargetAtTime(VOLUME, ctx.currentTime, 0.5);
}

export function stopMusic() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  // Fade out; notes already scheduled ring out under the fade.
  bus.gain.cancelScheduledValues(ctx.currentTime);
  bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
  // Resume on the next bar line so the groove restarts cleanly.
  step = Math.ceil(step / 16) * 16;
}

export const musicPlaying = () => timer !== null;
