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
