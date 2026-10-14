import {
  createRound, playWord, discardTiles, scoreTiles, tilesFromLetters, bonusRewards,
  LETTER_VALUES, ROUND_TARGETS, BONUS_AFTER_ROUND, BONUS_SECONDS, BONUS_TIERS,
} from './game.js';
import { loadDictionary, isWord } from './dictionary.js';

const $ = (id) => document.getElementById(id);
const els = {
  round: $('round-label'), goalText: $('goal-text'),
  fill: $('goal-fill'), plays: $('plays'), discards: $('discards'),
  preview: $('preview'), chips: $('preview-chips'), mult: $('preview-mult'),
  spell: $('spell'), message: $('message'), hand: $('hand'), log: $('log'),
  cast: $('btn-cast'), discard: $('btn-discard'), shuffle: $('btn-shuffle'), help: $('btn-help'),
  coach: $('coach'), coachText: $('coach-text'), coachBtn: $('coach-btn'),
  overlay: $('overlay'), overlayTitle: $('overlay-title'), overlayText: $('overlay-text'),
  overlayBtn: $('overlay-btn'), overlayCheer: $('overlay-cheer'), overlayDetails: $('overlay-details'),
  loading: $('loading'),
};

let state;
let selected = []; // tile ids in spell order
let freshIds = new Set(); // tiles that just arrived, for the drop-in animation
let busy = false;
let pendingKey = null; // second letter of a two-letter tile picked by keyboard
let run = { extraPlays: 0, extraDiscards: 0 };
let timer = null;
let bonusEndsAt = 0;
let tutorial = null; // { step } while the tutorial is running

const fmt = (n) => (n === Infinity ? '∞' : n);
const isBonus = () => state.mode === 'bonus';

// ---------- Run flow ----------

function startRun() {
  run = { extraPlays: 0, extraDiscards: 0 };
  startRound(0);
}

function startRound(roundIndex) {
  stopTimer();
  state = createRound({
    seed: (Date.now() ^ (roundIndex * 7919)) >>> 0,
    roundIndex,
    extraPlays: run.extraPlays,
    extraDiscards: run.extraDiscards,
  });
  resetView('Tap letters to weave a word');
}

function startBonus() {
  state = createRound({ seed: Date.now() >>> 0, mode: 'bonus', roundIndex: BONUS_AFTER_ROUND });
  bonusEndsAt = Date.now() + BONUS_SECONDS * 1000;
  timer = setInterval(tickBonus, 100);
  resetView(nextTierText(0));
}

function resetView(message) {
  selected = [];
  pendingKey = null;
  freshIds = new Set(state.hand.map((t) => t.id));
  setMessage(message);
  render();
}

function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}

function tickBonus() {
  const left = Math.max(0, bonusEndsAt - Date.now());
  els.goalText.textContent = `${Math.ceil(left / 1000)}s · ${state.history.length} words`;
  els.fill.style.width = `${(left / (BONUS_SECONDS * 1000)) * 100}%`;
  if (left > 0) return;
  stopTimer();
  state.status = 'won';
  busy = false;
  const reward = bonusRewards(state.history.length);
  run.extraPlays += reward.plays;
  run.extraDiscards += reward.discards;
  const parts = [];
  if (reward.plays) parts.push(`+${reward.plays} cast${reward.plays > 1 ? 's' : ''}`);
  if (reward.discards) parts.push(`+${reward.discards} discard${reward.discards > 1 ? 's' : ''}`);
  showOverlay(
    'Time’s up!',
    parts.length
      ? `You coined ${state.history.length} words and earned ${parts.join(' and ')} for every remaining round.`
      : `You coined ${state.history.length} words. Find ${BONUS_TIERS[0].words} next time to earn a reward.`,
    `On to round ${BONUS_AFTER_ROUND + 2}`,
    () => startRound(BONUS_AFTER_ROUND + 1),
    { cheer: parts.length > 0 },
  );
}

function nextTierText(count) {
  const next = BONUS_TIERS.find((t) => count < t.words);
  if (!next) return 'All rewards earned! Keep going for fun.';
  const r = [next.plays && `+${next.plays} cast`, next.discards && `+${next.discards} discard`].filter(Boolean).join(', ');
  return `Next reward at ${next.words} words: ${r}`;
}

// ---------- Rendering ----------

function tileEl(tile, onClick, extraClass = '') {
  const b = document.createElement('button');
  const duo = tile.letter.length > 1;
  const label = duo ? tile.letter[0].toUpperCase() + tile.letter.slice(1) : tile.letter.toUpperCase();
  b.className = `tile ${duo ? 'duo' : ''} ${extraClass}`;
  b.innerHTML = `${label}<span class="value">${LETTER_VALUES[tile.letter]}</span>`;
  b.setAttribute('aria-label', tile.letter);
  b.addEventListener('click', onClick);
  return b;
}

function selectedTiles() {
  return selected.map((id) => state.hand.find((t) => t.id === id));
}

function render() {
  const bonus = isBonus();
  els.round.textContent = tutorial ? 'Practice' : bonus ? 'Bonus' : `Round ${state.roundIndex + 1}`;
  els.round.classList.toggle('bonus', bonus);
  els.fill.classList.toggle('timer', bonus);
  if (!bonus) {
    els.goalText.innerHTML = tutorial
      ? `<span id="score">${state.score}</span> points`
      : `<span id="score">${state.score}</span> / <span id="target">${state.target}</span>`;
    els.fill.style.width = `${Math.min(100, (state.score / state.target) * 100)}%`;
  }
  els.plays.textContent = fmt(state.playsLeft);
  els.discards.textContent = fmt(state.discardsLeft);

  const allowed = tutorial ? (TUTORIAL_STEPS[tutorial.step].tiles ?? []) : null;
  els.hand.replaceChildren(...state.hand.map((t) => {
    const cls = [
      selected.includes(t.id) ? 'used' : '',
      freshIds.has(t.id) ? 'enter' : '',
      allowed && !allowed.includes(t.letter) ? 'locked' : '',
      allowed && allowed.includes(t.letter) && !selected.includes(t.id) ? 'hint' : '',
    ].join(' ');
    return tileEl(t, () => toggle(t.id), cls);
  }));
  freshIds = new Set();

  els.spell.replaceChildren(...selectedTiles().map((t) => tileEl(t, () => toggle(t.id))));

  const tiles = selectedTiles();
  const word = tiles.map((t) => t.letter).join('');
  if (tiles.length > 0) {
    const s = scoreTiles(tiles);
    els.chips.textContent = s.chips;
    els.mult.textContent = s.mult;
    els.preview.classList.toggle('valid', word.length >= 3 && isWord(word));
  } else {
    els.chips.textContent = 0;
    els.mult.textContent = 0;
    els.preview.classList.remove('valid');
  }

  const step = tutorial && TUTORIAL_STEPS[tutorial.step];
  els.cast.disabled = busy || word.length < 3 || (step && step.action !== 'cast');
  els.discard.disabled = busy || tiles.length === 0 || state.discardsLeft === 0 || (step && step.action !== 'discard');
  els.shuffle.disabled = busy || (step && step.action !== 'shuffle');
  els.cast.classList.toggle('hint', Boolean(step && step.action === 'cast' && word === step.word));
  els.discard.classList.toggle('hint', Boolean(step && step.action === 'discard' && tiles.length === step.tiles.length));
  els.shuffle.classList.toggle('hint', Boolean(step && step.action === 'shuffle'));

  els.log.replaceChildren(...state.history.map((h) => {
    const s = document.createElement('span');
    s.innerHTML = `${h.word.toUpperCase()} <b>${h.total}</b>`;
    return s;
  }));
}

function setMessage(text, kind = '') {
  els.message.textContent = text;
  els.message.className = `message ${kind}`;
}

function shake() {
  els.spell.classList.remove('shake');
  void els.spell.offsetWidth; // restart animation
  els.spell.classList.add('shake');
}

// ---------- Actions ----------

function toggle(id) {
  if (busy || state.status !== 'playing') return;
  selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
  render();
}

function cast() {
  if (busy || selected.length === 0 || els.cast.disabled) return;
  const before = new Set(state.hand.map((t) => t.id));
  const res = playWord(state, selected, isWord);
  if (!res.ok) {
    const msg = {
      'too-short': 'Spells need at least 3 letters',
      'not-a-word': 'That word isn’t in the spellbook',
      repeat: 'You already cast that word',
    }[res.reason] || 'The spell fizzled';
    setMessage(msg, 'bad');
    shake();
    return;
  }

  const { result } = res;
  busy = true;
  els.spell.querySelectorAll('.tile').forEach((t) => t.classList.add('cast-out'));
  floatText(`+${result.total}`);
  setMessage(
    isBonus()
      ? `${result.word.toUpperCase()}! ${nextTierText(state.history.length)}`
      : `${result.word.toUpperCase()}: ${result.chips} × ${result.mult}`,
    'good',
  );

  setTimeout(() => {
    selected = [];
    freshIds = new Set(state.hand.map((t) => t.id).filter((id) => !before.has(id)));
    busy = false;
    if (tutorial) return advanceTutorial('cast');
    render();
    checkEnd();
  }, 500);
}

function discard() {
  if (busy || els.discard.disabled) return;
  const before = new Set(state.hand.map((t) => t.id));
  const res = discardTiles(state, selected);
  if (!res.ok) return;
  freshIds = new Set(state.hand.map((t) => t.id).filter((id) => !before.has(id)));
  selected = [];
  setMessage('Letters returned to the void');
  if (tutorial) return advanceTutorial('discard');
  render();
  checkEnd();
}

function shuffle() {
  if (busy || els.shuffle.disabled) return;
  for (let i = state.hand.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.hand[i], state.hand[j]] = [state.hand[j], state.hand[i]];
  }
  if (tutorial) return advanceTutorial('shuffle');
  render();
}

function floatText(text) {
  const rect = els.spell.getBoundingClientRect();
  const f = document.createElement('div');
  f.className = 'float';
  f.textContent = text;
  f.style.left = `${rect.left + rect.width / 2}px`;
  f.style.top = `${rect.top}px`;
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1000);
}

function checkEnd() {
  if (isBonus()) return;
  const last = state.roundIndex >= ROUND_TARGETS.length - 1;
  if (state.status === 'won') {
    const bonusNext = state.roundIndex === BONUS_AFTER_ROUND;
    showOverlay(
      last ? 'You are a true Whizz Words wizard!' : 'Round cleared!',
      last
        ? `You cleared all ${ROUND_TARGETS.length} rounds. The shop, charms and bosses come next.`
        : bonusNext
          ? `You scored ${state.score} of ${state.target}. Next up: a ${BONUS_SECONDS}-second bonus round. Cast as many words as you can to earn extra casts and discards.`
          : `You scored ${state.score} of ${state.target}. The next target is ${ROUND_TARGETS[state.roundIndex + 1]}.`,
      last ? 'Play again' : bonusNext ? 'Start bonus round' : 'Next round',
      () => (last ? startRun() : bonusNext ? startBonus() : startRound(state.roundIndex + 1)),
      { cheer: true },
    );
  } else if (state.status === 'lost') {
    showOverlay(
      'The spell fizzled…',
      `You reached ${state.score} of ${state.target} in round ${state.roundIndex + 1}.`
        + (run.extraPlays || run.extraDiscards ? ' Your bonus rewards are lost, and the next run starts fresh.' : ''),
      'Try again',
      startRun,
    );
  }
}

// With cheer, "Well done!" pops in first and the round summary follows.
let revealTimer = null;
function showOverlay(title, text, button, onClick, { cheer = false } = {}) {
  clearTimeout(revealTimer);
  els.overlayTitle.textContent = title;
  els.overlayText.textContent = text;
  els.overlayBtn.textContent = button;
  els.overlayBtn.onclick = () => { els.overlay.classList.add('hidden'); onClick(); };
  els.overlayCheer.classList.toggle('hidden', !cheer);
  els.overlayDetails.classList.remove('reveal');
  els.overlayDetails.classList.toggle('waiting', cheer);
  els.overlay.classList.remove('hidden');
  const reveal = () => {
    els.overlayDetails.classList.remove('waiting');
    els.overlayDetails.classList.add('reveal');
    els.overlayBtn.focus();
  };
  if (cheer) revealTimer = setTimeout(reveal, 900);
  else reveal();
}

// ---------- Tutorial ----------

// A fixed practice hand. Tiles are drawn from the end of the bag.
const TUTORIAL_HAND = ['c', 'a', 't', 'th', 'e', 'x', 'z', 's'];
const TUTORIAL_BAG = ['e', 'a', 'l', 'g', 'i', 'n', 'r', 'o'];

const TUTORIAL_STEPS = [
  { text: 'Welcome, apprentice! You cast spells by spelling words with your letter tiles.', button: 'Show me' },
  { text: 'Tap <b>C</b>, <b>A</b> and <b>T</b> to spell CAT, then tap <b>Cast</b>.', action: 'cast', word: 'cat', tiles: ['c', 'a', 't'] },
  { text: 'Nice! The small number on each tile is its value. Your score is <b>letter points × multiplier</b>, and the multiplier grows with longer words.', button: 'Next' },
  { text: '<b>X</b> and <b>Z</b> are tricky letters. Tap both, then tap <b>Discard</b> to swap them for new ones. You get 3 discards per round.', action: 'discard', tiles: ['x', 'z'] },
  { text: 'Stuck for ideas? Tap <b>⟳</b> to shuffle your hand. Shuffling is free.', action: 'shuffle', tiles: [] },
  { text: 'Golden tiles hold two letters. Spell <b>THORN</b> with the <b>TH</b> tile. It counts as two letters, so THORN is a 5-letter word worth ×3.', action: 'cast', word: 'thorn', tiles: ['th', 'o', 'r', 'n'] },
  { text: `That’s it! Reach each round’s target before your casts run out. After round ${BONUS_AFTER_ROUND + 1} there’s a ${BONUS_SECONDS}-second bonus round that earns extra casts and discards.`, button: 'Start round 1', last: true },
];

function startTutorial() {
  stopTimer();
  els.overlay.classList.add('hidden');
  tutorial = { step: 0 };
  state = createRound({
    hand: tilesFromLetters(TUTORIAL_HAND),
    bag: tilesFromLetters(TUTORIAL_BAG, 100),
  });
  state.target = Infinity;
  resetView('');
  showStep();
}

function showStep() {
  const step = TUTORIAL_STEPS[tutorial.step];
  els.coach.classList.remove('hidden');
  els.coachText.innerHTML = step.text;
  els.coachBtn.classList.toggle('hidden', !step.button);
  if (step.button) els.coachBtn.textContent = step.button;
  if (step.action === 'cast') setMessage(`Spell ${step.word.toUpperCase()}`);
  render();
}

function advanceTutorial(action) {
  const step = TUTORIAL_STEPS[tutorial.step];
  if (step.action && step.action !== action) return render();
  if (step.last) {
    tutorial = null;
    els.coach.classList.add('hidden');
    try { localStorage.setItem('whizz-tutorial-done', '1'); } catch { /* storage unavailable */ }
    startRun();
    return;
  }
  tutorial.step += 1;
  showStep();
}

// During the tutorial only the step's word can be cast.
const castForTutorial = () => {
  const step = tutorial && TUTORIAL_STEPS[tutorial.step];
  if (step && step.action === 'cast') {
    const word = selectedTiles().map((t) => t.letter).join('');
    if (word !== step.word) {
      setMessage(`Spell ${step.word.toUpperCase()} for now`, 'bad');
      shake();
      return;
    }
  }
  cast();
};

els.coachBtn.addEventListener('click', () => advanceTutorial('button'));

// ---------- Input ----------

// Desktop keyboard support: type letters, Backspace, Enter to cast.
document.addEventListener('keydown', (e) => {
  if (!state || busy || !els.overlay.classList.contains('hidden')) return;
  if (e.key === 'Enter') { e.preventDefault(); castForTutorial(); return; }
  if (e.key === 'Backspace') { selected = selected.slice(0, -1); pendingKey = null; render(); return; }
  if (e.key === 'Escape') { selected = []; pendingKey = null; render(); return; }
  const key = e.key.toLowerCase();
  if (!/^[a-z]$/.test(key)) return;
  // Typing the second letter of a two-letter tile just picked does nothing.
  if (pendingKey === key) { pendingKey = null; return; }
  pendingKey = null;
  const free = state.hand.filter((t) => !selected.includes(t.id) && !els.hand.children[state.hand.indexOf(t)]?.classList.contains('locked'));
  const tile = free.find((t) => t.letter === key) || free.find((t) => t.letter.length > 1 && t.letter[0] === key);
  if (!tile) return;
  if (tile.letter.length > 1) pendingKey = tile.letter.slice(1);
  toggle(tile.id);
});

els.cast.addEventListener('click', castForTutorial);
els.discard.addEventListener('click', discard);
els.shuffle.addEventListener('click', shuffle);
els.help.addEventListener('click', startTutorial);

loadDictionary()
  .then(() => {
    els.loading.classList.add('hidden');
    let seen = false;
    try { seen = localStorage.getItem('whizz-tutorial-done') === '1'; } catch { /* storage unavailable */ }
    // Playtest shortcut: open the page with #bonus to jump to the bonus round.
    if (location.hash === '#bonus') startBonus();
    else if (seen) startRun();
    else startTutorial();
  })
  .catch((err) => { els.loading.textContent = `Could not open the spellbook: ${err.message}`; });
