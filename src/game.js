// Pure game logic for a single round. No DOM access here, so it can be
// unit-tested in Node and later driven by a simulation bot.

export const HAND_SIZE = 8;
export const PLAYS_PER_ROUND = 4;
export const DISCARDS_PER_ROUND = 3;

// Scrabble-style letter values. "qu" is a single tile so Q is playable.
export const LETTER_VALUES = {
  a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1, j: 8, k: 5, l: 1, m: 3,
  n: 1, o: 1, p: 3, qu: 10, r: 1, s: 1, t: 1, u: 1, v: 4, w: 4, x: 8, y: 4, z: 10,
};

// 56-tile starting bag, weighted toward common letters.
export const BAG_COUNTS = {
  e: 7, a: 5, i: 4, o: 4, u: 2,
  n: 3, r: 4, t: 3, l: 2, s: 4, d: 2, g: 2,
  b: 1, c: 1, m: 1, p: 1, f: 1, h: 1, v: 1, w: 1, y: 1, k: 1, j: 1, x: 1, qu: 1, z: 1,
};

// Bonus chips by word length (in letters, so "qu" counts as two).
const LENGTH_BONUS = [0, 0, 0, 0, 5, 10, 20, 35, 50, 70];

// Round targets for the M1 prototype (no shop yet, just escalating rounds).
export const ROUND_TARGETS = [120, 180, 260, 360, 480];

// Small seeded RNG (mulberry32) so runs are reproducible.
export function createRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createBag(rng) {
  const tiles = [];
  let id = 0;
  for (const [letter, count] of Object.entries(BAG_COUNTS)) {
    for (let i = 0; i < count; i++) tiles.push({ id: id++, letter });
  }
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

export function tilesToWord(tiles) {
  return tiles.map((t) => t.letter).join('');
}

// Score a word made of tiles. Returns the breakdown so the UI can animate it.
export function scoreTiles(tiles) {
  const word = tilesToWord(tiles);
  const letterChips = tiles.reduce((sum, t) => sum + LETTER_VALUES[t.letter], 0);
  const lengthBonus = LENGTH_BONUS[Math.min(word.length, LENGTH_BONUS.length - 1)];
  const chips = letterChips + lengthBonus;
  const mult = Math.max(1, word.length - 2);
  return { word, letterChips, lengthBonus, chips, mult, total: chips * mult };
}

export function createRound({ seed = Date.now(), roundIndex = 0 } = {}) {
  const rng = createRng(seed);
  const state = {
    roundIndex,
    target: ROUND_TARGETS[Math.min(roundIndex, ROUND_TARGETS.length - 1)],
    score: 0,
    playsLeft: PLAYS_PER_ROUND,
    discardsLeft: DISCARDS_PER_ROUND,
    bag: createBag(rng),
    hand: [],
    history: [],
    status: 'playing', // 'playing' | 'won' | 'lost'
  };
  refill(state);
  return state;
}

function refill(state) {
  while (state.hand.length < HAND_SIZE && state.bag.length > 0) {
    state.hand.push(state.bag.pop());
  }
  // Out of tiles: no word can be made any more.
  if (state.status === 'playing' && state.hand.length < 3) state.status = 'lost';
}

function takeFromHand(state, tileIds) {
  const picked = tileIds.map((id) => state.hand.find((t) => t.id === id));
  if (picked.some((t) => !t) || new Set(tileIds).size !== tileIds.length) {
    return null;
  }
  state.hand = state.hand.filter((t) => !tileIds.includes(t.id));
  return picked;
}

// Play the tiles (in order) as a word. isWord is injected for testability.
export function playWord(state, tileIds, isWord) {
  if (state.status !== 'playing') return { ok: false, reason: 'over' };
  if (state.playsLeft <= 0) return { ok: false, reason: 'no-plays' };
  const tiles = tileIds.map((id) => state.hand.find((t) => t.id === id));
  if (tiles.some((t) => !t)) return { ok: false, reason: 'bad-tiles' };
  const word = tilesToWord(tiles);
  if (word.length < 3) return { ok: false, reason: 'too-short' };
  if (!isWord(word)) return { ok: false, reason: 'not-a-word' };

  takeFromHand(state, tileIds);
  const result = scoreTiles(tiles);
  state.score += result.total;
  state.playsLeft -= 1;
  state.history.push(result);

  if (state.score >= state.target) state.status = 'won';
  else if (state.playsLeft === 0) state.status = 'lost';
  refill(state);
  return { ok: true, result };
}

export function discardTiles(state, tileIds) {
  if (state.status !== 'playing') return { ok: false, reason: 'over' };
  if (state.discardsLeft <= 0) return { ok: false, reason: 'no-discards' };
  if (tileIds.length === 0) return { ok: false, reason: 'nothing-selected' };
  if (!takeFromHand(state, tileIds)) return { ok: false, reason: 'bad-tiles' };
  state.discardsLeft -= 1;
  refill(state);
  return { ok: true };
}
