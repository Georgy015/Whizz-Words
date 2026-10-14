// Balance check: a greedy bot plays many rounds and reports win rates per target.
// Usage: node tools/sim.mjs [rounds-per-target]
import { readFileSync } from 'node:fs';
import { createRound, playWord, scoreTiles, ROUND_TARGETS } from '../src/game.js';

const words = readFileSync(new URL('../assets/words.txt', import.meta.url), 'utf8').split('\n').filter(Boolean);
const dict = new Set(words);
const N = Number(process.argv[2] || 300);

// Find the highest-scoring word buildable from the hand (Qu tile = "qu").
function bestPlay(hand) {
  let best = null;
  for (const w of words) {
    if (w.length > 9) continue;
    const pool = [...hand];
    const ids = [];
    let i = 0;
    let ok = true;
    while (i < w.length) {
      const want = w.startsWith('qu', i) ? 'qu' : w[i];
      const k = pool.findIndex((t) => t.letter === want);
      if (k < 0) { ok = false; break; }
      ids.push(pool[k].id);
      i += want.length;
      pool.splice(k, 1);
    }
    if (!ok) continue;
    const score = scoreTiles(ids.map((id) => hand.find((t) => t.id === id))).total;
    if (!best || score > best.score) best = { ids, score, w };
  }
  return best;
}

for (const [roundIndex, target] of ROUND_TARGETS.entries()) {
  let wins = 0;
  let total = 0;
  for (let n = 0; n < N; n++) {
    const r = createRound({ seed: n * 31 + roundIndex, roundIndex });
    while (r.status === 'playing') {
      const p = bestPlay(r.hand);
      if (!p) { r.status = 'lost'; break; }
      playWord(r, p.ids, (w) => dict.has(w));
    }
    if (r.status === 'won') wins++;
    total += r.score;
  }
  console.log(`round ${roundIndex + 1} target ${target}: best-play bot wins ${(100 * wins / N).toFixed(0)}%`);
}
