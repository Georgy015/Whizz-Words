import {
  createRound, playWord, discardTiles, scoreTiles, LETTER_VALUES, ROUND_TARGETS,
} from './game.js';
import { loadDictionary, isWord } from './dictionary.js';

const $ = (id) => document.getElementById(id);
const els = {
  round: $('round-label'), score: $('score'), target: $('target'), fill: $('goal-fill'),
  plays: $('plays'), discards: $('discards'),
  preview: $('preview'), chips: $('preview-chips'), mult: $('preview-mult'),
  spell: $('spell'), message: $('message'), hand: $('hand'), log: $('log'),
  cast: $('btn-cast'), discard: $('btn-discard'), shuffle: $('btn-shuffle'),
  overlay: $('overlay'), overlayTitle: $('overlay-title'), overlayText: $('overlay-text'),
  overlayBtn: $('overlay-btn'), loading: $('loading'),
};

let state;
let selected = []; // tile ids in spell order
let freshIds = new Set(); // tiles that just arrived, for the drop-in animation
let busy = false;

function startRound(roundIndex) {
  state = createRound({ seed: (Date.now() ^ (roundIndex * 7919)) >>> 0, roundIndex });
  selected = [];
  freshIds = new Set(state.hand.map((t) => t.id));
  setMessage('Tap letters to weave a word');
  render();
}

function tileEl(tile, onClick, extraClass = '') {
  const b = document.createElement('button');
  b.className = `tile ${tile.letter === 'qu' ? 'qu' : ''} ${extraClass}`;
  b.innerHTML = `${tile.letter === 'qu' ? 'Qu' : tile.letter.toUpperCase()}<span class="value">${LETTER_VALUES[tile.letter]}</span>`;
  b.setAttribute('aria-label', tile.letter);
  b.addEventListener('click', onClick);
  return b;
}

function selectedTiles() {
  return selected.map((id) => state.hand.find((t) => t.id === id));
}

function render() {
  els.round.textContent = `Round ${state.roundIndex + 1}`;
  els.score.textContent = state.score;
  els.target.textContent = state.target;
  els.fill.style.width = `${Math.min(100, (state.score / state.target) * 100)}%`;
  els.plays.textContent = state.playsLeft;
  els.discards.textContent = state.discardsLeft;

  els.hand.replaceChildren(...state.hand.map((t) => {
    const cls = [selected.includes(t.id) ? 'used' : '', freshIds.has(t.id) ? 'enter' : ''].join(' ');
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

  els.cast.disabled = busy || word.length < 3;
  els.discard.disabled = busy || tiles.length === 0 || state.discardsLeft === 0;

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

function toggle(id) {
  if (busy) return;
  selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
  render();
}

function cast() {
  if (busy || selected.length === 0) return;
  snapshotHand();
  const res = playWord(state, selected, isWord);
  if (!res.ok) {
    const msg = {
      'too-short': 'Spells need at least 3 letters',
      'not-a-word': 'That word isn’t in the spellbook',
    }[res.reason] || 'The spell fizzled';
    setMessage(msg, 'bad');
    els.spell.classList.remove('shake');
    void els.spell.offsetWidth; // restart animation
    els.spell.classList.add('shake');
    return;
  }

  const { result } = res;
  busy = true;
  // Animate the cast word flying away before refilling the view.
  els.spell.querySelectorAll('.tile').forEach((t) => t.classList.add('cast-out'));
  floatText(`+${result.total}`);
  setMessage(`${result.word.toUpperCase()}: ${result.chips} × ${result.mult}`, 'good');

  setTimeout(() => {
    selected = [];
    freshIds = new Set(state.hand.map((t) => t.id).filter((id) => !prevHandIds.has(id)));
    busy = false;
    render();
    checkEnd();
  }, 500);
}

// Track hand ids before each action so only newly drawn tiles animate in.
let prevHandIds = new Set();
function snapshotHand() { prevHandIds = new Set(state.hand.map((t) => t.id)); }

function discard() {
  if (busy) return;
  snapshotHand();
  const res = discardTiles(state, selected);
  if (!res.ok) return;
  freshIds = new Set(state.hand.map((t) => t.id).filter((id) => !prevHandIds.has(id)));
  selected = [];
  setMessage('Letters returned to the void');
  render();
  checkEnd();
}

function shuffle() {
  if (busy) return;
  for (let i = state.hand.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.hand[i], state.hand[j]] = [state.hand[j], state.hand[i]];
  }
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
  if (state.status === 'won') {
    const last = state.roundIndex >= ROUND_TARGETS.length - 1;
    showOverlay(
      last ? 'You are a true Whizz Words wizard!' : 'Round cleared!',
      last
        ? `You cleared all ${ROUND_TARGETS.length} rounds. The shop, charms and bosses come next.`
        : `You scored ${state.score} of ${state.target}. The next target is ${ROUND_TARGETS[state.roundIndex + 1]}.`,
      last ? 'Play again' : 'Next round',
      () => startRound(last ? 0 : state.roundIndex + 1),
    );
  } else if (state.status === 'lost') {
    showOverlay(
      'The spell fizzled…',
      `You reached ${state.score} of ${state.target} in round ${state.roundIndex + 1}.`,
      'Try again',
      () => startRound(0),
    );
  }
}

function showOverlay(title, text, button, onClick) {
  els.overlayTitle.textContent = title;
  els.overlayText.textContent = text;
  els.overlayBtn.textContent = button;
  els.overlayBtn.onclick = () => { els.overlay.classList.add('hidden'); onClick(); };
  els.overlay.classList.remove('hidden');
  els.overlayBtn.focus();
}

// Desktop keyboard support: type letters, Backspace, Enter to cast.
document.addEventListener('keydown', (e) => {
  if (!state || busy || !els.overlay.classList.contains('hidden')) return;
  if (e.key === 'Enter') { e.preventDefault(); cast(); return; }
  if (e.key === 'Backspace') { selected = selected.slice(0, -1); render(); return; }
  if (e.key === 'Escape') { selected = []; render(); return; }
  const key = e.key.toLowerCase();
  if (!/^[a-z]$/.test(key)) return;
  // Typing "qu" selects the single Qu tile, so swallow the "u" after it.
  if (key === 'u' && pendingQu) { pendingQu = false; return; }
  const letter = key === 'q' ? 'qu' : key;
  const tile = state.hand.find((t) => t.letter === letter && !selected.includes(t.id));
  pendingQu = Boolean(tile) && letter === 'qu';
  if (tile) toggle(tile.id);
});
let pendingQu = false;

els.cast.addEventListener('click', cast);
els.discard.addEventListener('click', discard);
els.shuffle.addEventListener('click', shuffle);

loadDictionary()
  .then(() => { els.loading.classList.add('hidden'); startRound(0); })
  .catch((err) => { els.loading.textContent = `Could not open the spellbook: ${err.message}`; });
