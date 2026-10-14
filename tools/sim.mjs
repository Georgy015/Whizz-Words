// Balance check: a greedy bot plays full runs and reports how far it gets.
// It knows every word, so treat its results as an upper bound for players.
// Usage: node tools/sim.mjs [runs]
import { readFileSync } from 'node:fs';
import {
  createRound, playWord, scoreTiles, castContext, roundCoins, carryOver, createRng, ROUND_TARGETS,
} from '../src/game.js';
import { charmById, shopOffers, CHARM_SLOTS } from '../src/charms.js';

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

function bestPlay(hand, ctx) {
  let best = null;
  for (const w of words) {
    const ids = match(w, 0, hand, []);
    if (!ids) continue;
    const score = scoreTiles(ids.map((id) => hand.find((t) => t.id === id)), ctx).total;
    if (!best || score > best.score) best = { ids, score, w };
  }
  return best;
}

// Play one run. buyCharms=false gives the no-charm baseline.
function playRun(seed, buyCharms) {
  const rng = createRng(seed);
  const run = { coins: 0, charms: [], carry: 0 };
  for (let i = 0; i < ROUND_TARGETS.length; i++) {
    const charms = run.charms.map(charmById);
    const sum = (k) => charms.reduce((s, c) => s + (c[k] || 0), 0);
    const r = createRound({
      seed: seed * 97 + i, roundIndex: i, startScore: run.carry,
      extraPlays: sum('extraPlays'), extraDiscards: sum('extraDiscards'),
    });
    while (r.status === 'playing') {
      const p = bestPlay(r.hand, castContext(r, charms, run.coins));
      if (!p) { r.status = 'lost'; break; }
      playWord(r, p.ids, (w) => dict.has(w), { charms, coins: run.coins });
    }
    if (r.status !== 'won') return i; // rounds cleared
    run.coins += roundCoins(r, charms);
    run.carry = i + 1 < ROUND_TARGETS.length ? carryOver(r.score, r.target, ROUND_TARGETS[i + 1]) : 0;
    if (buyCharms) {
      for (const offer of shopOffers(rng, run.charms)) {
        if (run.charms.length < CHARM_SLOTS && run.coins >= offer.price) {
          run.coins -= offer.price;
          run.charms.push(offer.id);
        }
      }
    }
  }
  return ROUND_TARGETS.length;
}

for (const buy of [false, true]) {
  const reached = new Array(ROUND_TARGETS.length + 1).fill(0);
  for (let n = 0; n < N; n++) reached[playRun(n + 1, buy)]++;
  const line = ROUND_TARGETS.map((target, i) => {
    const cleared = reached.slice(i + 1).reduce((a, b) => a + b, 0);
    return `R${i + 1} (${target}): ${((100 * cleared) / N).toFixed(0)}%`;
  }).join('  ');
  console.log(`${buy ? 'buying charms' : 'no charms    '}  ${line}`);
}
