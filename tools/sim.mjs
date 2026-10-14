// Balance check: a greedy bot plays many rounds and reports win rates per target.
// Usage: node tools/sim.mjs [rounds-per-target]
import { readFileSync } from 'node:fs';
import { createRound, playWord, scoreTiles, ROUND_TARGETS } from '../src/game.js';

const words = readFileSync(new URL('../assets/words.txt', import.meta.url), 'utf8').split('\n').filter(Boolean);
const dict = new Set(words);
const N = Number(process.argv[2] || 300);

// Find the highest-scoring word buildable from the hand. Two-letter tiles
// make several spellings possible, so match recursively.
function match(w, i, pool, ids) {
  if (i === w.length) return ids;
  for (let k = 0; k < pool.length; k++) {
    const l = pool[k].letter;
    if (w.startsWith(l, i)) {
      const found = match(w, i + l.length, pool.filter((_, j) => j !== k), [...ids, pool[k].id]);
      if (found) return found;
    }
  }
  return null;
}

function bestPlay(hand) {
  let best = null;
  for (const w of words) {
    const ids = match(w, 0, hand, []);
    if (!ids) continue;
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
