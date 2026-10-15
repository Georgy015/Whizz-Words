// Boss definitions. A boss bends one rule for a round. Each one sets up the
// round through state.rules (read by game.js) or by changing casts/discards,
// and returns an optional detail line for the intro card.
//
// state.rules understood by game.js:
//   maxLength     words longer than this are rejected
//   climb         each word must be longer than the previous one
//   cursed        a letter that cannot appear in a cast word
//   zeroVowels    single vowel tiles score 0
//   hidden        number of face-down tiles kept in the hand
//   disabledCharm id of a charm that does nothing this round

import { enforceHidden } from './game.js';

export const BOSSES = [
  {
    id: 'mute-owl', name: 'The Mute Owl', glyph: '☾',
    rule: 'Vowel tiles score 0 points.',
    setup: (state) => { state.rules.zeroVowels = true; },
  },
  {
    id: 'shrinking-hex', name: 'The Shrinking Hex', glyph: '⬡',
    rule: 'Words can be at most 5 letters long.',
    setup: (state) => { state.rules.maxLength = 5; },
  },
  {
    id: 'frost-witch', name: 'The Frost Witch', glyph: '❄',
    rule: 'You only get 3 casts this round.',
    setup: (state) => { state.playsLeft = Math.min(state.playsLeft, 3); },
  },
  {
    id: 'greedy-goblin', name: 'The Greedy Goblin', glyph: '♣',
    rule: 'No discards this round.',
    setup: (state) => { state.discardsLeft = 0; },
  },
  {
    id: 'banshee', name: 'The Banshee', glyph: '☊',
    rule: 'One common letter is cursed and can’t be used in words.',
    badge: (state) => `The letter ${state.rules.cursed.toUpperCase()} is cursed and can’t be used.`,
    setup: (state, { rng }) => {
      const letter = ['r', 's', 't', 'n', 'l'][Math.floor(rng() * 5)];
      state.rules.cursed = letter;
      return `This round the cursed letter is ${letter.toUpperCase()}. Discard tiles that carry it.`;
    },
  },
  {
    id: 'ink-thief', name: 'The Ink Thief', glyph: '✒',
    rule: 'Two tiles in your hand are face-down until you cast them.',
    setup: (state) => { state.rules.hidden = 2; },
  },
  {
    id: 'climbing-vine', name: 'The Climbing Vine', glyph: '⚘',
    rule: 'Each word must be longer than the one before.',
    setup: (state) => { state.rules.climb = true; },
  },
  {
    id: 'charm-eater', name: 'The Charm Eater', glyph: '⊘', final: true,
    rule: 'One of your charms is switched off this round.',
    setup: (state, { rng, charms }) => {
      if (!charms.length) return 'You have no charms, so it goes hungry.';
      const eaten = charms[Math.floor(rng() * charms.length)];
      state.rules.disabledCharm = eaten.id;
      return `It ate ${eaten.name}.`;
    },
  },
];

export const bossById = (id) => BOSSES.find((b) => b.id === id);

// Bonus coins for beating a boss.
export const BOSS_REWARD = 3;

// Apply a boss to a freshly created round. Returns the intro detail text.
export function applyBoss(state, boss, { rng, charms = [] }) {
  state.boss = boss.id;
  const detail = boss.setup(state, { rng, charms }) || '';
  enforceHidden(state);
  return detail;
}

// Pick the bosses for a run: a random regular boss for each boss round, and
// the final boss for the last one.
export function pickBosses(rng, count) {
  const pool = BOSSES.filter((b) => !b.final);
  const picks = [];
  for (let i = 0; i < count - 1; i++) picks.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  picks.push(BOSSES.find((b) => b.final));
  return picks;
}
