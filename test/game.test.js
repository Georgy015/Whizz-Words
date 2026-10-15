import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRound, playWord, discardTiles, scoreTiles, createBag, createRng,
  HAND_SIZE, BAG_COUNTS, bonusRewards, tilesFromLetters, carryOver,
} from '../src/game.js';

const t = (letters) => letters.map((letter, id) => ({ id, letter }));

test('scores chips times mult', () => {
  // C3 A1 T1 = 5 chips, no length bonus, mult 1
  assert.deepEqual(scoreTiles(t(['c', 'a', 't'])).total, 5);
  // W4 I1 Z10 A1 R1 D2 = 19 + 20 bonus = 39 chips, mult 4
  const s = scoreTiles(t(['w', 'i', 'z', 'a', 'r', 'd']));
  assert.equal(s.chips, 39);
  assert.equal(s.mult, 4);
  assert.equal(s.total, 156);
});

test('qu tile counts as two letters', () => {
  const s = scoreTiles(t(['qu', 'i', 'z']));
  assert.equal(s.word, 'quiz');
  assert.equal(s.mult, 2);
});

test('bag has every tile and is reproducible by seed', () => {
  const total = Object.values(BAG_COUNTS).reduce((a, b) => a + b, 0);
  const a = createBag(createRng(42)).map((x) => x.letter).join();
  const b = createBag(createRng(42)).map((x) => x.letter).join();
  assert.equal(a.split(',').length, total);
  assert.equal(a, b);
});

test('round deals a full hand', () => {
  const r = createRound({ seed: 1 });
  assert.equal(r.hand.length, HAND_SIZE);
});

test('playing a valid word scores, refills and uses a play', () => {
  const r = createRound({ seed: 1 });
  const ids = r.hand.slice(0, 3).map((x) => x.id);
  const res = playWord(r, ids, () => true);
  assert.ok(res.ok);
  assert.equal(r.playsLeft, 3);
  assert.equal(r.hand.length, HAND_SIZE);
  assert.ok(r.score > 0);
});

test('invalid words cost nothing', () => {
  const r = createRound({ seed: 1 });
  const ids = r.hand.slice(0, 3).map((x) => x.id);
  assert.equal(playWord(r, ids, () => false).reason, 'not-a-word');
  assert.equal(playWord(r, ids.slice(0, 2), () => true).reason, 'too-short');
  assert.equal(r.playsLeft, 4);
});

test('discard replaces tiles and uses a discard', () => {
  const r = createRound({ seed: 1 });
  const ids = r.hand.slice(0, 2).map((x) => x.id);
  assert.ok(discardTiles(r, ids).ok);
  assert.equal(r.discardsLeft, 2);
  assert.ok(r.hand.every((x) => !ids.includes(x.id)));
});

test('reaching the target wins, running out of plays loses', () => {
  const win = createRound({ seed: 1 });
  win.target = 1;
  playWord(win, win.hand.slice(0, 3).map((x) => x.id), () => true);
  assert.equal(win.status, 'won');

  const lose = createRound({ seed: 1 });
  lose.target = 1e9;
  for (let i = 0; i < 4; i++) playWord(lose, lose.hand.slice(0, 3).map((x) => x.id), () => true);
  assert.equal(lose.status, 'lost');
});

test('two-letter tiles score their value and count as two letters', () => {
  const s = scoreTiles(t(['th', 'o', 'r', 'n']));
  assert.equal(s.word, 'thorn');
  assert.equal(s.chips, 5 + 3 + 10);
  assert.equal(s.mult, 3);
});

test('extra casts and discards from the bonus round carry into a round', () => {
  const r = createRound({ seed: 1, extraPlays: 1, extraDiscards: 2 });
  assert.equal(r.playsLeft, 5);
  assert.equal(r.discardsLeft, 5);
});

test('bonus round never runs out of tiles and rejects repeated words', () => {
  const r = createRound({ seed: 1, mode: 'bonus' });
  for (let i = 0; i < 40; i++) {
    const ids = r.hand.slice(0, 3).map((x) => x.id);
    const word = r.hand.slice(0, 3).map((x) => x.letter).join('');
    const seen = r.usedWords.has(word);
    const res = playWord(r, ids, () => true);
    assert.equal(res.ok, !seen);
    if (seen) discardTiles(r, ids);
  }
  assert.equal(r.hand.length, HAND_SIZE);
  assert.equal(r.status, 'playing');
  assert.ok(new Set(r.hand.map((x) => x.id)).size === HAND_SIZE);
});

test('bonus rewards stack by tier', () => {
  assert.deepEqual(bonusRewards(2), { plays: 0, discards: 0 });
  assert.deepEqual(bonusRewards(3), { plays: 0, discards: 1 });
  assert.deepEqual(bonusRewards(6), { plays: 1, discards: 1 });
  assert.deepEqual(bonusRewards(12), { plays: 2, discards: 2 });
});

test('a preset hand and bag are used as given', () => {
  const r = createRound({ hand: tilesFromLetters(['c', 'a', 't']), bag: tilesFromLetters(['x', 'y', 'z', 'o', 'p'], 100) });
  assert.deepEqual(r.hand.map((x) => x.letter), ['c', 'a', 't', 'p', 'o', 'z', 'y', 'x']);
});

test('surplus points carry over, capped at half the next target', () => {
  assert.equal(carryOver(60, 60, 85), 0);
  assert.equal(carryOver(80, 60, 85), 20);
  assert.equal(carryOver(190, 60, 85), 42);
  const r = createRound({ seed: 1, roundIndex: 1, startScore: 20 });
  assert.equal(r.score, 20);
  assert.equal(r.status, 'playing');
});

// ---------- Charms and coins ----------
import { CHARMS, charmById, shopOffers } from '../src/charms.js';
import { roundCoins, castContext, ROUND_TARGETS, BONUS_AFTER } from '../src/game.js';

const charm = (id) => [charmById(id)];

test('every charm has a name, glyph, price and description', () => {
  assert.equal(CHARMS.length, 15);
  for (const c of CHARMS) {
    assert.ok(c.id && c.name && c.glyph && c.text && c.price > 0, c.id);
  }
  assert.equal(new Set(CHARMS.map((c) => c.id)).size, CHARMS.length);
});

test('charm hooks add chips, add mult, then multiply', () => {
  // CAT: 5 chips × 1 mult. Short & Sweet +15 chips, Vowel Hunter +1 mult.
  const s = scoreTiles(t(['c', 'a', 't']), { charms: [charmById('short-sweet'), charmById('vowel-hunter')] });
  assert.equal(s.chips, 20);
  assert.equal(s.mult, 2);
  assert.equal(s.total, 40);
  assert.deepEqual(s.fired.map((f) => f.id), ['short-sweet', 'vowel-hunter']);
  // Bookworm only fires on 6+ letters.
  assert.equal(scoreTiles(t(['c', 'a', 't']), { charms: charm('bookworm') }).fired.length, 0);
  assert.equal(scoreTiles(t(['w', 'i', 'z', 'a', 'r', 'd']), { charms: charm('bookworm') }).mult, 8);
});

test('situational charms read the cast context', () => {
  const tiles = t(['n', 'o', 'o', 'n']);
  assert.equal(scoreTiles(tiles, { charms: charm('palindrome') }).mult, 10);
  assert.equal(scoreTiles(tiles, { charms: charm('twin-letters') }).mult, 6);
  assert.equal(scoreTiles(tiles, { charms: charm('last-gasp'), last: true }).mult, 6);
  assert.equal(scoreTiles(tiles, { charms: charm('last-gasp'), last: false }).mult, 2);
  assert.equal(scoreTiles(tiles, { charms: charm('hoarder'), coins: 7 }).mult, 4);
  assert.equal(scoreTiles(tiles, { charms: charm('opening-spell'), first: true }).chips, 4 + 5 + 25);
});

test('cast context knows the first and last cast of a round', () => {
  const r = createRound({ seed: 1 });
  assert.deepEqual(castContext(r), { charms: [], coins: 0, rules: {}, first: true, last: false });
  r.playsLeft = 1;
  assert.equal(castContext(r).last, true);
});

test('clearing a round pays $3 plus $1 per unused cast, plus charm coins', () => {
  const r = createRound({ seed: 1 });
  r.playsLeft = 2;
  r.discardsLeft = 3;
  assert.equal(roundCoins(r), 5);
  assert.equal(roundCoins(r, charm('penny-pincher')), 8);
});

test('shop offers distinct charms the player does not own', () => {
  const rng = createRng(3);
  const owned = CHARMS.slice(0, 13).map((c) => c.id);
  const offers = shopOffers(rng, owned);
  assert.equal(offers.length, 2);
  assert.ok(offers.every((o) => !owned.includes(o.id)));
  assert.equal(new Set(shopOffers(createRng(9), []).map((o) => o.id)).size, 3);
});

test('the run has eight rounds with bonus rounds after rounds 3 and 6', () => {
  assert.equal(ROUND_TARGETS.length, 8);
  assert.deepEqual(BONUS_AFTER, [2, 5]);
  assert.ok(ROUND_TARGETS.every((x, i) => i === 0 || x > ROUND_TARGETS[i - 1]));
});

// ---------- Bosses ----------
import { BOSSES, bossById, applyBoss, pickBosses } from '../src/bosses.js';
import { ruleViolation } from '../src/game.js';

const bossRound = (id, opts = {}) => {
  const r = createRound({ seed: 5, roundIndex: 3, ...opts });
  const detail = applyBoss(r, bossById(id), { rng: createRng(1), charms: opts.charms ?? [] });
  return { r, detail };
};

test('every boss has a name, glyph and rule, and exactly one is the final boss', () => {
  assert.equal(BOSSES.length, 8);
  for (const b of BOSSES) assert.ok(b.id && b.name && b.glyph && b.rule, b.id);
  assert.equal(BOSSES.filter((b) => b.final).length, 1);
});

test('Mute Owl: vowel tiles score 0', () => {
  const { r } = bossRound('mute-owl');
  // CAT: C3 + A0 + T1 = 4 chips
  assert.equal(scoreTiles(t(['c', 'a', 't']), castContext(r)).chips, 4);
});

test('Shrinking Hex, Banshee and Climbing Vine reject words that break their rule', () => {
  assert.equal(ruleViolation(bossRound('shrinking-hex').r, 'wizard'), 'too-long');
  assert.equal(ruleViolation(bossRound('shrinking-hex').r, 'wiz'), null);
  const { r: banshee, detail } = bossRound('banshee');
  assert.match(detail, /cursed letter is [RSTNL]/);
  assert.equal(ruleViolation(banshee, `x${banshee.rules.cursed}y`), 'cursed');
  const { r: vine } = bossRound('climbing-vine');
  vine.history.push({ word: 'cats' });
  assert.equal(ruleViolation(vine, 'dog'), 'climb');
  assert.equal(ruleViolation(vine, 'dogs'), 'climb');
  assert.equal(ruleViolation(vine, 'doggy'), null);
});

test('rule-breaking casts are refused and cost nothing', () => {
  const { r } = bossRound('shrinking-hex', { hand: tilesFromLetters(['w', 'i', 'z', 'a', 'r', 'd', 'e', 's']) });
  const res = playWord(r, r.hand.slice(0, 6).map((x) => x.id), () => true);
  assert.equal(res.reason, 'too-long');
  assert.equal(r.playsLeft, 4);
});

test('Frost Witch and Greedy Goblin cut casts and discards', () => {
  assert.equal(bossRound('frost-witch').r.playsLeft, 3);
  assert.equal(bossRound('greedy-goblin').r.discardsLeft, 0);
});

test('Ink Thief keeps two tiles face-down, even after refills', () => {
  const { r } = bossRound('ink-thief');
  assert.equal(r.hand.filter((x) => x.hidden).length, 2);
  discardTiles(r, r.hand.filter((x) => x.hidden).map((x) => x.id));
  assert.equal(r.hand.filter((x) => x.hidden).length, 2);
});

test('Charm Eater switches off one owned charm', () => {
  const charms = [charmById('short-sweet')];
  const { r, detail } = bossRound('charm-eater', { charms });
  assert.match(detail, /Short & Sweet/);
  const s = scoreTiles(t(['c', 'a', 't']), castContext(r, charms));
  assert.equal(s.chips, 5);
  assert.equal(s.fired.length, 0);
});

test('a run picks distinct regular bosses and ends with the final boss', () => {
  const picks = pickBosses(createRng(4), 2);
  assert.equal(picks.length, 2);
  assert.ok(!picks[0].final);
  assert.ok(picks[1].final);
});

// ---------- Word filter ----------
import { readFileSync } from 'node:fs';
import { blocked, ALLOW } from '../tools/word-filter.mjs';

test('the word list contains no blocked words, and keeps innocent look-alikes', () => {
  const words = new Set(readFileSync(new URL('../assets/words.txt', import.meta.url), 'utf8').split('\n'));
  const leaks = [...blocked].filter((w) => words.has(w));
  assert.equal(leaks.length, 0, `run node tools/filter-words.mjs (${leaks.length} blocked words found)`);
  for (const w of ['spicy', 'fingering', 'scat', 'horns', 'pants', 'grape']) assert.ok(words.has(w), w);
  assert.ok(blocked.size > 300 && ALLOW.has('spicy'));
});
