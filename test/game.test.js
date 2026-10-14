import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRound, playWord, discardTiles, scoreTiles, createBag, createRng,
  HAND_SIZE, BAG_COUNTS,
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
