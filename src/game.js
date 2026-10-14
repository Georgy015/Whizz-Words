// Pure game logic. No DOM access here, so it can be unit-tested in Node and
// driven by the simulation bot.

export const HAND_SIZE = 8;
export const PLAYS_PER_ROUND = 4;
export const DISCARDS_PER_ROUND = 3;
export const BONUS_SECONDS = 60;

// Scrabble-style letter values. Two-letter tiles are worth the sum of their
// letters and count as two letters for word length.
export const LETTER_VALUES = {
  a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1, j: 8, k: 5, l: 1, m: 3,
  n: 1, o: 1, p: 3, r: 1, s: 1, t: 1, u: 1, v: 4, w: 4, x: 8, y: 4, z: 10,
  qu: 10, th: 5, er: 2, in: 2, st: 2, ch: 7,
};

// 61-tile starting bag, weighted toward common letters.
export const BAG_COUNTS = {
  e: 7, a: 5, i: 4, o: 4, u: 2,
  n: 3, r: 4, t: 3, l: 2, s: 4, d: 2, g: 2,
  b: 1, c: 1, m: 1, p: 1, f: 1, h: 1, v: 1, w: 1, y: 1, k: 1, j: 1, x: 1, z: 1,
  qu: 1, th: 1, er: 1, in: 1, st: 1, ch: 1,
};

// Bonus chips by word length (in letters, so two-letter tiles count twice).
const LENGTH_BONUS = [0, 0, 0, 0, 5, 10, 20, 35, 50, 70];

// Targets for the five scored rounds. A bonus round sits after round 3.
export const ROUND_TARGETS = [90, 130, 180, 240, 310];
export const BONUS_AFTER_ROUND = 2; // zero-based: after the third round

// Words found in the bonus round unlock these, cumulatively.
export const BONUS_TIERS = [
  { words: 3, discards: 1, plays: 0 },
  { words: 6, discards: 0, plays: 1 },
  { words: 10, discards: 1, plays: 1 },
];

export function bonusRewards(wordCount) {
  return BONUS_TIERS.filter((t) => wordCount >= t.words).reduce(
    (sum, t) => ({ plays: sum.plays + t.plays, discards: sum.discards + t.discards }),
    { plays: 0, discards: 0 },
  );
}

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

export function createBag(rng, idStart = 0) {
  const tiles = [];
  let id = idStart;
  for (const [letter, count] of Object.entries(BAG_COUNTS)) {
    for (let i = 0; i < count; i++) tiles.push({ id: id++, letter });
  }
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

// Turn a list of letters into tiles, e.g. for the tutorial's fixed hand.
export function tilesFromLetters(letters, idStart = 0) {
  return letters.map((letter, i) => ({ id: idStart + i, letter }));
}

export function tilesToWord(tiles) {
  return tiles.map((t) => t.letter).join('');
}

// Score a word made of tiles. Returns the breakdown so the UI can show it.
export function scoreTiles(tiles) {
  const word = tilesToWord(tiles);
  const letterChips = tiles.reduce((sum, t) => sum + LETTER_VALUES[t.letter], 0);
  const lengthBonus = LENGTH_BONUS[Math.min(word.length, LENGTH_BONUS.length - 1)];
  const chips = letterChips + lengthBonus;
  const mult = Math.max(1, word.length - 2);
  return { word, letterChips, lengthBonus, chips, mult, total: chips * mult };
}

// mode 'round': a scored round with a target and limited casts/discards.
// mode 'bonus': endless casts and discards against the clock; no repeats.
export function createRound({
  seed = Date.now(), roundIndex = 0, mode = 'round',
  extraPlays = 0, extraDiscards = 0, hand = null, bag = null,
} = {}) {
  const rng = createRng(seed);
  const bonus = mode === 'bonus';
  const state = {
    mode,
    roundIndex,
    target: bonus ? Infinity : ROUND_TARGETS[Math.min(roundIndex, ROUND_TARGETS.length - 1)],
    score: 0,
    playsLeft: bonus ? Infinity : PLAYS_PER_ROUND + extraPlays,
    discardsLeft: bonus ? Infinity : DISCARDS_PER_ROUND + extraDiscards,
    rng,
    nextId: 1000,
    bag: bag ?? createBag(rng),
    hand: hand ?? [],
    history: [],
    usedWords: new Set(),
    status: 'playing', // 'playing' | 'won' | 'lost'
  };
  refill(state);
  return state;
}

function refill(state) {
  while (state.hand.length < HAND_SIZE) {
    if (state.bag.length === 0) {
      if (state.mode !== 'bonus') break;
      state.bag = createBag(state.rng, state.nextId);
      state.nextId += state.bag.length;
    }
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
  if (state.mode === 'bonus' && state.usedWords.has(word)) return { ok: false, reason: 'repeat' };

  takeFromHand(state, tileIds);
  const result = scoreTiles(tiles);
  state.score += result.total;
  state.playsLeft -= 1;
  state.history.push(result);
  state.usedWords.add(word);

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
