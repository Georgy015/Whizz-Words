// Charm definitions. Each charm is data plus small hook functions, so adding
// one never touches the scoring code.
//
// Scoring hooks receive a context:
//   { word, tiles, length, first, last, coins }
// and return a number (or 0/undefined when they don't trigger):
//   chips(ctx)  -> chips added
//   mult(ctx)   -> mult added
//   xmult(ctx)  -> mult multiplier (applied after all additions)
// Round hooks:
//   extraPlays / extraDiscards  -> added to every round
//   roundCoins(state)           -> extra coins when a round is cleared

import { LETTER_VALUES } from './game.js';

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
const countVowels = (word) => [...word].filter((c) => VOWELS.has(c)).length;

export const CHARMS = [
  {
    id: 'vowel-hunter', name: 'Vowel Hunter', glyph: '◉', price: 4,
    text: '+1 mult for each vowel in the word',
    mult: ({ word }) => countVowels(word),
  },
  {
    id: 'bookworm', name: 'Bookworm', glyph: '❦', price: 5,
    text: '×2 mult for words of 6 or more letters',
    xmult: ({ length }) => (length >= 6 ? 2 : 0),
  },
  {
    id: 'short-sweet', name: 'Short & Sweet', glyph: '✧', price: 3,
    text: '+15 chips for words of 3 or 4 letters',
    chips: ({ length }) => (length <= 4 ? 15 : 0),
  },
  {
    id: 'golden-touch', name: 'Golden Touch', glyph: '❂', price: 4,
    text: 'Two-letter tiles score triple',
    chips: ({ tiles }) => tiles.filter((t) => t.letter.length > 1).reduce((s, t) => s + 2 * LETTER_VALUES[t.letter], 0),
  },
  {
    id: 'echo', name: 'Echo', glyph: '◎', price: 4,
    text: 'The first tile scores twice',
    chips: ({ tiles }) => LETTER_VALUES[tiles[0].letter],
  },
  {
    id: 'palindrome', name: 'Mirror Glass', glyph: '⧖', price: 3,
    text: '×5 mult if the word reads the same backwards',
    xmult: ({ word }) => (word === [...word].reverse().join('') ? 5 : 0),
  },
  {
    id: 'hoarder', name: 'Dragon’s Hoard', glyph: '◈', price: 5,
    text: '+1 mult for every $3 you hold',
    mult: ({ coins }) => Math.floor(coins / 3),
  },
  {
    id: 'last-gasp', name: 'Last Gasp', glyph: '☄', price: 4,
    text: '×3 mult on the last cast of a round',
    xmult: ({ last }) => (last ? 3 : 0),
  },
  {
    id: 'opening-spell', name: 'Opening Spell', glyph: '✦', price: 3,
    text: '+25 chips on the first cast of a round',
    chips: ({ first }) => (first ? 25 : 0),
  },
  {
    id: 'rare-runes', name: 'Rare Runes', glyph: 'ᚱ', price: 4,
    text: '+6 chips for each tile worth 4 or more',
    chips: ({ tiles }) => 6 * tiles.filter((t) => LETTER_VALUES[t.letter] >= 4).length,
  },
  {
    id: 'plural-power', name: 'Many Spells', glyph: '∿', price: 3,
    text: '+3 mult if the word ends in S',
    mult: ({ word }) => (word.endsWith('s') ? 3 : 0),
  },
  {
    id: 'twin-letters', name: 'Twin Stars', glyph: '⁂', price: 4,
    text: '+4 mult if the word has a double letter, like the LL in SPELL',
    mult: ({ word }) => (/(.)\1/.test(word) ? 4 : 0),
  },
  {
    id: 'penny-pincher', name: 'Penny Pincher', glyph: '¤', price: 4,
    text: 'Earn $1 for each unused discard when you clear a round',
    roundCoins: (state) => state.discardsLeft,
  },
  {
    id: 'spare-spell', name: 'Spare Spell', glyph: '✚', price: 6,
    text: '+1 cast every round',
    extraPlays: 1,
  },
  {
    id: 'deep-pockets', name: 'Deep Pockets', glyph: '♻', price: 5,
    text: '+1 discard every round',
    extraDiscards: 1,
  },
];

export const CHARM_SLOTS = 5;
export const charmById = (id) => CHARMS.find((c) => c.id === id);

// Apply charms to a base score. Returns the new chips/mult and which charms
// fired, with a short label for each so the UI can show what happened.
export function applyCharms(base, charms, ctx) {
  let { chips, mult } = base;
  const fired = [];
  for (const c of charms) {
    const add = c.chips?.(ctx) || 0;
    if (add) { chips += add; fired.push({ id: c.id, label: `+${add} chips` }); }
  }
  for (const c of charms) {
    const add = c.mult?.(ctx) || 0;
    if (add) { mult += add; fired.push({ id: c.id, label: `+${add} mult` }); }
  }
  for (const c of charms) {
    const x = c.xmult?.(ctx) || 0;
    if (x) { mult *= x; fired.push({ id: c.id, label: `×${x} mult` }); }
  }
  return { chips, mult, total: chips * mult, fired };
}

// Pick up to n distinct charms the player doesn't own yet.
export function shopOffers(rng, owned, n = 3) {
  const pool = CHARMS.filter((c) => !owned.includes(c.id));
  const offers = [];
  while (offers.length < n && pool.length) {
    offers.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return offers;
}
