// Sound effects synthesized with the Web Audio API: no audio files, so the
// game stays tiny. Browsers only allow sound after a tap or key press, so the
// audio context is created lazily on the first sound.

let ctx = null;
let master = null;
let enabled = true;
try { enabled = localStorage.getItem('whizz-sound') !== 'off'; } catch { /* storage unavailable */ }

export const soundOn = () => enabled;

export function setSound(on) {
  enabled = on;
  try { localStorage.setItem('whizz-sound', on ? 'on' : 'off'); } catch { /* storage unavailable */ }
  if (master) master.gain.value = on ? 0.5 : 0;
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.5 : 0;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// One enveloped oscillator note.
function tone(freq, { at = 0, dur = 0.15, type = 'triangle', gain = 0.25, attack = 0.005, slide = 0 } = {}) {
  const a = audio();
  if (!a || !enabled) return;
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

// A short burst of filtered noise (whooshes and clicks).
function noise({ at = 0, dur = 0.2, gain = 0.15, from = 400, to = 2400, q = 1 } = {}) {
  const a = audio();
  if (!a || !enabled) return;
  const t = a.currentTime + at;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t);
}

// C major pentatonic, so any run of notes sounds pleasant.
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26];
const note = (step, base = 523.25) => base * 2 ** (PENTA[Math.min(step, PENTA.length - 1)] / 12);

export const sfx = {
  tap: () => tone(880, { dur: 0.07, type: 'sine', gain: 0.18, slide: 0.7 }),
  untap: () => tone(560, { dur: 0.07, type: 'sine', gain: 0.14, slide: 0.8 }),
  letter: (i) => {
    tone(note(i), { dur: 0.22, gain: 0.2 });
    tone(note(i) * 2, { dur: 0.12, type: 'sine', gain: 0.05 });
  },
  charm: () => [1568, 2093, 2637].forEach((f, i) => tone(f, { at: i * 0.05, dur: 0.18, type: 'sine', gain: 0.08 })),
  total: (big) => {
    const chord = big ? [0, 2, 4, 5, 7] : [0, 2, 4];
    chord.forEach((s, i) => tone(note(s, 392), { at: i * 0.06, dur: 0.5, gain: 0.16 }));
  },
  tick: () => tone(1500, { dur: 0.025, type: 'square', gain: 0.03 }),
  invalid: () => {
    tone(150, { dur: 0.2, type: 'square', gain: 0.07, slide: 0.6 });
    tone(110, { at: 0.08, dur: 0.22, type: 'square', gain: 0.06, slide: 0.6 });
  },
  discard: () => noise({ dur: 0.25, from: 300, to: 3000, gain: 0.12 }),
  shuffle: () => [0, 0.06, 0.12, 0.18].forEach((at) => noise({ at, dur: 0.04, from: 2500, to: 3500, gain: 0.1, q: 4 })),
  coin: () => {
    tone(988, { dur: 0.09, type: 'square', gain: 0.06 });
    tone(1319, { at: 0.08, dur: 0.25, type: 'square', gain: 0.06 });
  },
  win: () => {
    [0, 2, 4, 5].forEach((s, i) => tone(note(s), { at: i * 0.11, dur: 0.35, gain: 0.18 }));
    [7, 9, 10].forEach((s, i) => tone(note(s), { at: 0.5 + i * 0.05, dur: 0.6, type: 'sine', gain: 0.07 }));
  },
  lose: () => [4, 2, 0].forEach((s, i) => tone(note(s, 392), { at: i * 0.18, dur: 0.45, type: 'sine', gain: 0.16 })),
  boss: () => {
    tone(110, { dur: 1.4, type: 'sawtooth', gain: 0.05, attack: 0.2 });
    [220, 261.6, 311.1].forEach((f, i) => tone(f, { at: 0.15 + i * 0.12, dur: 1, type: 'triangle', gain: 0.06, attack: 0.05 }));
  },
  countdown: () => tone(1046, { dur: 0.08, type: 'sine', gain: 0.12 }),
  timeUp: () => {
    tone(523, { dur: 0.6, type: 'triangle', gain: 0.18 });
    tone(392, { at: 0.12, dur: 0.8, type: 'triangle', gain: 0.14 });
  },
};
