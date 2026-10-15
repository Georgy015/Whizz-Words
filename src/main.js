import {
  createRound, playWord, discardTiles, scoreTiles, tilesFromLetters, bonusRewards, carryOver,
  castContext, roundCoins, createRng, tileValue,
  LETTER_VALUES, ROUND_TARGETS, BONUS_AFTER, BONUS_SECONDS, BONUS_TIERS,
} from './game.js';
import { CHARM_SLOTS, charmById, shopOffers } from './charms.js';
import { BOSSES, BOSS_REWARD, applyBoss, pickBosses } from './bosses.js';

// Rounds 4 and 8 (zero-based 3 and 7) are boss rounds; round 8 is the final boss.
const BOSSES_IN_RUN = true;
const BOSS_ROUNDS = [3, 7];
// Boss Trials: a page that only plays boss rounds, picked from a list.
const BOSS_TRIALS = window.WHIZZ_BOSS_TRIALS === true || location.hash === '#bosses';
const TRIAL_CHARMS = ['vowel-hunter', 'short-sweet', 'opening-spell'];
const TRIAL_ROUND = 3;
import { loadDictionary, isWord } from './dictionary.js';
import { sfx, soundOn, setSound } from './sound.js';
import { burstFrom, screenShake, popLabel, countUp, wait, reducedMotion } from './fx.js';

const $ = (id) => document.getElementById(id);
const els = {
  round: $('round-label'), goalText: $('goal-text'),
  fill: $('goal-fill'), plays: $('plays'), discards: $('discards'),
  preview: $('preview'), chips: $('preview-chips'), mult: $('preview-mult'),
  spell: $('spell'), message: $('message'), hand: $('hand'), log: $('log'),
  cast: $('btn-cast'), discard: $('btn-discard'), shuffle: $('btn-shuffle'), help: $('btn-help'),
  restart: $('btn-restart'), pause: $('btn-pause'), overlayAlt: $('overlay-alt'),
  coach: $('coach'), coachText: $('coach-text'), coachBtn: $('coach-btn'),
  overlay: $('overlay'), overlayTitle: $('overlay-title'), overlayText: $('overlay-text'),
  overlayBtn: $('overlay-btn'), overlayCheer: $('overlay-cheer'), overlayDetails: $('overlay-details'),
  loading: $('loading'), charms: $('charms'), coins: $('coins'),
  shop: $('shop'), shopCoins: $('shop-coins'), offers: $('offers'), shopOwned: $('shop-owned'),
  shopReroll: $('shop-reroll'), shopLeave: $('shop-leave'),
  bossBadge: $('boss-badge'), picker: $('picker'), pickerList: $('picker-list'),
  game: $('game'), overlaySound: $('overlay-sound'),
};

let state;
let selected = []; // tile ids in spell order
let freshIds = new Set(); // tiles that just arrived, for the drop-in animation
let busy = false;
let pendingKey = null; // second letter of a two-letter tile picked by keyboard
let run = newRun();
let timer = null;
let bonusEndsAt = 0;
let tutorial = null; // { step } while the tutorial is running
let shownScore = null; // score shown in the header while it counts up

const fmt = (n) => (n === Infinity ? '∞' : n);

function newRun() {
  return { extraPlays: 0, extraDiscards: 0, carry: 0, coins: 0, charms: [], bosses: [] };
}
// The charms in play (none during the tutorial).
const activeCharms = () => (tutorial ? [] : run.charms.map(charmById));
const charmSum = (key) => activeCharms().reduce((s, c) => s + (c[key] || 0), 0);
const isBonus = () => state.mode === 'bonus';

// ---------- Run flow ----------

function startRun() {
  run = newRun();
  if (BOSSES_IN_RUN) run.bosses = pickBosses(createRng(Date.now() >>> 0), BOSS_ROUNDS.length);
  startRound(0);
}

function startRound(roundIndex) {
  stopTimer();
  state = createRound({
    seed: (Date.now() ^ (roundIndex * 7919)) >>> 0,
    roundIndex,
    extraPlays: run.extraPlays + charmSum('extraPlays'),
    extraDiscards: run.extraDiscards + charmSum('extraDiscards'),
    startScore: run.carry,
  });
  resetView(run.carry ? `+${run.carry} points carried over from last round` : 'Tap letters to weave a word');
  run.carry = 0;
  const bossSlot = BOSSES_IN_RUN ? BOSS_ROUNDS.indexOf(roundIndex) : -1;
  if (bossSlot >= 0) {
    // Runs pick their bosses up front; playtest shortcuts may skip that.
    if (!run.bosses.length) run.bosses = pickBosses(createRng(Date.now() >>> 0), BOSS_ROUNDS.length);
    introduceBoss(run.bosses[bossSlot]);
  }
}

// Turn the current round into a boss round and show the boss's intro card.
function introduceBoss(boss) {
  const detail = applyBoss(state, boss, { rng: state.rng, charms: activeCharms() });
  resetView('Tap letters to weave a word');
  showOverlay(`${boss.glyph} ${boss.name}`, `${boss.rule} ${detail}`.trim(), 'Begin', () => {}, { cheer: 'boss' });
}

function startBonus(afterIndex) {
  state = createRound({ seed: Date.now() >>> 0, mode: 'bonus', roundIndex: afterIndex });
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
  pausedLeft = null;
}

// Freeze and unfreeze the bonus clock (pause menu, start-over prompt, tab hidden).
let pausedLeft = null;
function pauseClock() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  pausedLeft = Math.max(0, bonusEndsAt - Date.now());
}
function resumeClock() {
  if (pausedLeft === null) return;
  bonusEndsAt = Date.now() + pausedLeft;
  pausedLeft = null;
  timer = setInterval(tickBonus, 100);
}

let lastCountdown = null;
function tickBonus() {
  const left = Math.max(0, bonusEndsAt - Date.now());
  const secs = Math.ceil(left / 1000);
  if (secs <= 5 && secs > 0 && secs !== lastCountdown) sfx.countdown();
  lastCountdown = secs;
  els.fill.classList.toggle('urgent', secs <= 5);
  els.goalText.textContent = `${Math.ceil(left / 1000)}s · ${state.history.length} words`;
  els.fill.style.width = `${(left / (BONUS_SECONDS * 1000)) * 100}%`;
  if (left > 0) return;
  stopTimer();
  sfx.timeUp();
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
    `On to round ${state.roundIndex + 2}`,
    ((next) => () => startRound(next))(state.roundIndex + 1),
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
  const cursed = state.rules?.cursed && tile.letter.includes(state.rules.cursed);
  if (tile.hidden) {
    b.className = `tile face-down ${extraClass}`;
    b.innerHTML = '?';
    b.setAttribute('aria-label', 'face-down tile');
  } else {
    const value = tileValue(tile, state.rules);
    b.className = `tile ${duo ? 'duo' : ''} ${cursed ? 'cursed' : ''} ${extraClass}`;
    b.innerHTML = `${label}<span class="value">${value}</span>`;
    b.setAttribute('aria-label', tile.letter);
  }
  b.addEventListener('click', onClick);
  return b;
}

function selectedTiles() {
  return selected.map((id) => state.hand.find((t) => t.id === id));
}

function render() {
  const bonus = isBonus();
  els.round.textContent = tutorial ? 'Practice' : bonus ? 'Bonus'
    : BOSS_TRIALS ? 'Boss trial' : `Round ${state.roundIndex + 1}`;
  els.round.classList.toggle('bonus', bonus);
  els.fill.classList.toggle('timer', bonus);
  if (!bonus) updateGoal(shownScore ?? state.score);
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
  if (tiles.some((t) => t.hidden)) {
    // Face-down tiles keep their secret until the word is cast.
    els.chips.textContent = '?';
    els.mult.textContent = '?';
    els.preview.classList.remove('valid');
  } else if (tiles.length > 0) {
    const s = scoreTiles(tiles, castContext(state, activeCharms(), run.coins));
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

  renderCharms();
  const boss = state.boss && BOSSES.find((b) => b.id === state.boss);
  els.bossBadge.classList.toggle('hidden', !boss);
  if (boss) {
    els.bossBadge.textContent = `${boss.glyph} ${boss.name}: ${boss.badge?.(state) ?? boss.rule}`;
  }

  els.log.replaceChildren(...state.history.map((h) => {
    const s = document.createElement('span');
    s.innerHTML = `${h.word.toUpperCase()} <b>${h.total}</b>`;
    return s;
  }));
}

function renderCharms() {
  const owned = activeCharms();
  const slots = [];
  for (let i = 0; i < CHARM_SLOTS; i++) {
    const c = owned[i];
    const b = document.createElement('button');
    const eaten = c && c.id === state?.rules?.disabledCharm;
    b.className = c ? `charm ${eaten ? 'eaten' : ''}` : 'charm empty';
    if (c) {
      b.dataset.id = c.id;
      b.innerHTML = `<span class="glyph">${c.glyph}</span><span class="name">${c.name}</span>`;
      b.title = `${c.name}: ${c.text}`;
      b.addEventListener('click', () => setMessage(eaten ? `${c.name} was eaten by the Charm Eater this round` : `${c.name}: ${c.text}`));
    } else {
      b.setAttribute('aria-label', 'Empty charm slot');
      b.addEventListener('click', () => setMessage('Clear rounds to earn coins, then buy charms in the shop'));
    }
    slots.push(b);
  }
  els.charms.replaceChildren(...slots);
  els.coins.textContent = `$${run.coins}`;
}

function pulseCharms(fired) {
  for (const f of fired) {
    const el = els.charms.querySelector(`[data-id="${f.id}"]`);
    if (!el) continue;
    el.classList.remove('fired');
    void el.offsetWidth;
    el.classList.add('fired');
  }
}

function updateGoal(score) {
  els.goalText.innerHTML = tutorial
    ? `<span id="score">${score}</span> points`
    : `<span id="score">${score}</span> / <span id="target">${state.target}</span>`;
  els.fill.style.width = `${Math.min(100, (score / state.target) * 100)}%`;
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
  const removing = selected.includes(id);
  selected = removing ? selected.filter((x) => x !== id) : [...selected, id];
  (removing ? sfx.untap : sfx.tap)();
  render();
}

function cast() {
  if (busy || selected.length === 0 || els.cast.disabled) return;
  const before = new Set(state.hand.map((t) => t.id));
  const castTiles = selectedTiles();
  const res = playWord(state, selected, isWord, { charms: activeCharms(), coins: run.coins });
  if (!res.ok) {
    const msg = {
      'too-short': 'Spells need at least 3 letters',
      'not-a-word': 'That word isn’t in the spellbook',
      repeat: 'You already cast that word',
      'too-long': `Too long: words can be at most ${state.rules.maxLength} letters this round`,
      cursed: `The cursed letter ${state.rules.cursed?.toUpperCase()} can’t be used`,
      climb: `Each word must be longer than ${state.history[state.history.length - 1]?.word.length} letters`,
    }[res.reason] || 'The spell fizzled';
    setMessage(msg, 'bad');
    sfx.invalid();
    els.spell.querySelectorAll('.tile').forEach((t) => {
      t.classList.remove('bad-flash');
      void t.offsetWidth;
      t.classList.add('bad-flash');
    });
    shake();
    return;
  }

  const { result } = res;
  busy = true;
  shownScore = state.score - result.total;
  const charmNote = result.fired.map((f) => `${charmById(f.id).name} ${f.label}`).join(', ');
  setMessage(
    isBonus()
      ? `${result.word.toUpperCase()}! ${nextTierText(state.history.length)}`
      : `${result.word.toUpperCase()}: ${result.chips} × ${result.mult}${charmNote ? ` (${charmNote})` : ''}`,
    'good',
  );
  playCastSequence(castTiles, result).then(() => {
    shownScore = null;
    selected = [];
    freshIds = new Set(state.hand.map((t) => t.id).filter((id) => !before.has(id)));
    busy = false;
    if (tutorial) return advanceTutorial('cast');
    render();
    checkEnd();
  });
}

// The scoring show: each tile lights up with its points, then each charm that
// fired, then the total lands and the header score counts up. Faster in the
// bonus round, where the clock is running.
async function playCastSequence(tiles, result) {
  const fast = isBonus() || reducedMotion();
  const tileEls = [...els.spell.querySelectorAll('.tile')];
  for (let i = 0; i < tileEls.length; i++) {
    const el = tileEls[i];
    const t = tiles[i];
    if (t.hidden) {
      // The Ink Thief's face-down tiles are revealed as they score.
      const duo = t.letter.length > 1;
      el.className = `tile ${duo ? 'duo' : ''}`;
      el.textContent = duo ? t.letter[0].toUpperCase() + t.letter.slice(1) : t.letter.toUpperCase();
    }
    el.classList.add('scoring');
    popLabel(el, `+${tileValue(t, state.rules)}`);
    sfx.letter(i);
    await wait(fast ? 45 : 110);
  }
  for (const f of result.fired) {
    pulseCharms([f]);
    const charmEl = els.charms.querySelector(`[data-id="${f.id}"]`);
    if (charmEl) popLabel(charmEl, f.label, 'charm');
    sfx.charm();
    await wait(fast ? 70 : 240);
  }
  els.chips.textContent = result.chips;
  els.mult.textContent = result.mult;
  els.preview.classList.add('valid');
  els.preview.classList.remove('total-pop');
  void els.preview.offsetWidth;
  els.preview.classList.add('total-pop');
  floatText(`+${result.total}`);
  sfx.total(result.total >= 100);
  burstFrom(els.spell, { count: result.total >= 100 ? 18 : 10 });
  if (result.total >= 100) screenShake(els.game, result.total >= 250 ? 2 : 1);
  await wait(fast ? 120 : 260);
  tileEls.forEach((el) => el.classList.add('cast-out'));
  if (!isBonus()) {
    let lastTick = 0;
    await countUp(shownScore, state.score, fast ? 200 : 550, (v) => {
      shownScore = v;
      updateGoal(v);
      const now = performance.now();
      if (now - lastTick > 45) { sfx.tick(); lastTick = now; }
    });
  } else {
    await wait(150);
  }
}

function discard() {
  if (busy || els.discard.disabled) return;
  const before = new Set(state.hand.map((t) => t.id));
  const res = discardTiles(state, selected);
  if (!res.ok) return;
  sfx.discard();
  freshIds = new Set(state.hand.map((t) => t.id).filter((id) => !before.has(id)));
  selected = [];
  setMessage('Letters returned to the void');
  if (tutorial) return advanceTutorial('discard');
  render();
  checkEnd();
}

function shuffle() {
  if (busy || els.shuffle.disabled) return;
  sfx.shuffle();
  if (!reducedMotion()) {
    els.hand.classList.remove('shuffling');
    void els.hand.offsetWidth;
    els.hand.classList.add('shuffling');
  }
  for (let i = state.hand.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.hand[i], state.hand[j]] = [state.hand[j], state.hand[i]];
  }
  if (tutorial) return advanceTutorial('shuffle');
  render();
}

function floatText(text) {
  // Rise from just above the chips × mult line so the two don't overlap.
  const rect = els.preview.getBoundingClientRect();
  const f = document.createElement('div');
  f.className = 'float';
  f.textContent = text;
  f.style.left = `${rect.left + rect.width / 2}px`;
  f.style.top = `${rect.top - 44}px`;
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1000);
}

function checkEnd() {
  if (isBonus()) return;
  if (state.boss && BOSS_TRIALS) return endTrial();
  const last = state.roundIndex >= ROUND_TARGETS.length - 1;
  if (state.status === 'won') {
    const bonusNext = BONUS_AFTER.includes(state.roundIndex);
    run.carry = last ? 0 : carryOver(state.score, state.target, ROUND_TARGETS[state.roundIndex + 1]);
    const earned = roundCoins(state, activeCharms()) + (state.boss ? BOSS_REWARD : 0);
    run.coins += earned;
    renderCharms();
    const carryText = (run.carry ? ` ${run.carry} extra points carry into the next round.` : '')
      + ` You earned $${earned}${state.boss ? `, including $${BOSS_REWARD} for beating the boss` : ''}.`;
    const index = state.roundIndex;
    const next = bonusNext ? () => startBonus(index) : () => startRound(index + 1);
    showOverlay(
      last ? 'You are a true Whizz Words wizard!' : state.boss ? `${bossName()} is beaten!` : 'Round cleared!',
      last
        ? `You beat ${bossName() || 'the final round'} and cleared all ${ROUND_TARGETS.length} rounds.`
        : bonusNext
          ? `You scored ${state.score} of ${state.target}.${carryText} After the shop: a ${BONUS_SECONDS}-second bonus round. Cast as many words as you can to earn extra casts and discards.`
          : `You scored ${state.score} of ${state.target}.${carryText} The next target is ${ROUND_TARGETS[state.roundIndex + 1]}.`,
      last ? 'Play again' : 'Visit the shop',
      () => (last ? startRun() : openShop(next)),
      {
        cheer: state.boss ? 'victory' : true,
        alt: last ? null : { label: bonusNext ? 'Continue to bonus round' : 'Continue to next round', onClick: next },
      },
    );
  } else if (state.status === 'lost') {
    showOverlay(
      'The spell fizzled…',
      `${state.boss ? `${bossName()} wins this time. ` : ''}You reached ${state.score} of ${state.target} in round ${state.roundIndex + 1}.`
        + (run.extraPlays || run.extraDiscards ? ' Your bonus rewards are lost, and the next run starts fresh.' : ''),
      'Try again',
      startRun,
      { cheer: 'sad' },
    );
  }
}

const bossName = () => BOSSES.find((b) => b.id === state.boss)?.name ?? '';

// Boss Trials: pick a boss from the list and play its round.
function startTrials() {
  stopTimer();
  run = newRun();
  run.charms = [...TRIAL_CHARMS];
  state = createRound({ seed: Date.now() >>> 0, roundIndex: TRIAL_ROUND });
  resetView('Pick a boss to face');
  showPicker();
}

function showPicker() {
  els.pickerList.replaceChildren(...BOSSES.map((boss) => {
    const card = document.createElement('div');
    card.className = 'offer';
    card.innerHTML = `<span class="glyph">${boss.glyph}</span>
      <div class="offer-text"><b>${boss.name}${boss.final ? ' · final boss' : ''}</b><span>${boss.rule}</span></div>`;
    const face = document.createElement('button');
    face.className = 'btn primary small';
    face.textContent = 'Face';
    face.addEventListener('click', () => {
      els.picker.classList.add('hidden');
      startTrialRound(boss);
    });
    card.appendChild(face);
    return card;
  }));
  els.picker.classList.remove('hidden');
}

function startTrialRound(boss) {
  run.coins = 0;
  state = createRound({
    seed: (Date.now() ^ boss.id.length * 131) >>> 0,
    roundIndex: TRIAL_ROUND,
    extraPlays: charmSum('extraPlays'),
    extraDiscards: charmSum('extraDiscards'),
  });
  state.trialBoss = boss;
  introduceBoss(boss);
}

function endTrial() {
  const boss = state.trialBoss;
  const won = state.status === 'won';
  if (!won && state.status !== 'lost') return;
  showOverlay(
    won ? `${boss.name} is beaten!` : `${boss.name} wins this time`,
    won
      ? `You scored ${state.score} of ${state.target}. In a full run this pays an extra $${BOSS_REWARD}.`
      : `You reached ${state.score} of ${state.target}.`,
    'Choose another boss',
    showPicker,
    { cheer: won ? 'victory' : 'sad', alt: { label: 'Face it again', onClick: () => startTrialRound(boss) } },
  );
}

// With cheer, a headline pops in first and the round summary follows.
const CHEERS = { true: 'Well done!', sad: 'Bad luck!', boss: 'Boss round!', victory: 'Boss defeated!' };
let revealTimer = null;
function showOverlay(title, text, button, onClick, { cheer = false, alt = null, sound = false } = {}) {
  clearTimeout(revealTimer);
  els.overlaySound.classList.toggle('hidden', !sound);
  if (sound) renderSoundToggle();
  if (cheer === true || cheer === 'victory') {
    sfx.win();
    setTimeout(() => burstFrom(els.overlayCheer, { count: 22, spread: 140 }), 150);
  } else if (cheer === 'sad') sfx.lose();
  else if (cheer === 'boss') sfx.boss();
  els.overlayAlt.classList.toggle('hidden', !alt);
  if (alt) {
    els.overlayAlt.textContent = alt.label;
    els.overlayAlt.onclick = () => { els.overlay.classList.add('hidden'); alt.onClick?.(); };
  }
  els.overlayTitle.textContent = title;
  els.overlayText.textContent = text;
  els.overlayBtn.textContent = button;
  els.overlayBtn.onclick = () => { els.overlay.classList.add('hidden'); onClick(); };
  els.overlayCheer.classList.toggle('hidden', !cheer);
  els.overlayCheer.classList.toggle('sad', cheer === 'sad');
  els.overlayCheer.classList.toggle('boss', cheer === 'boss');
  els.overlayCheer.textContent = CHEERS[cheer] ?? '';
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

// ---------- Shop ----------

let shop = null; // { offers, rerollCost, onLeave, rng }

function openShop(onLeave) {
  const rng = createRng(Date.now() >>> 0);
  shop = { rng, offers: shopOffers(rng, run.charms), rerollCost: 1, onLeave };
  renderShop();
  els.shop.classList.remove('hidden');
  els.shopLeave.focus();
}

function renderShop() {
  const full = run.charms.length >= CHARM_SLOTS;
  els.shopCoins.textContent = `$${run.coins}`;
  els.offers.replaceChildren(...shop.offers.map((c) => {
    const card = document.createElement('div');
    card.className = 'offer';
    const afford = run.coins >= c.price;
    card.innerHTML = `<span class="glyph">${c.glyph}</span>
      <div class="offer-text"><b>${c.name}</b><span>${c.text}</span></div>`;
    const buy = document.createElement('button');
    buy.className = 'btn primary small';
    buy.textContent = `Buy $${c.price}`;
    buy.disabled = !afford || full;
    buy.title = full ? 'Your charm slots are full' : afford ? '' : 'Not enough coins';
    buy.addEventListener('click', () => {
      sfx.coin();
      burstFrom(buy, { count: 8, spread: 50 });
      run.coins -= c.price;
      run.charms.push(c.id);
      shop.offers = shop.offers.filter((o) => o.id !== c.id);
      renderShop();
      renderCharms();
    });
    card.appendChild(buy);
    return card;
  }));
  if (shop.offers.length === 0) {
    const p = document.createElement('p');
    p.className = 'offers-empty';
    p.textContent = 'Sold out. Reroll for new charms.';
    els.offers.appendChild(p);
  }
  els.shopReroll.textContent = `Reroll $${shop.rerollCost}`;
  els.shopReroll.disabled = run.coins < shop.rerollCost;
  const owned = run.charms.map(charmById);
  const heading = document.createElement('p');
  heading.className = 'owned-heading';
  heading.textContent = owned.length
    ? `Your charms (${owned.length}/${CHARM_SLOTS})${full ? '. Sell one to make room.' : ''}`
    : `Charm slots: 0/${CHARM_SLOTS}. Charms last for the whole run.`;
  els.shopOwned.replaceChildren(heading, ...owned.map((c) => {
    const row = document.createElement('div');
    row.className = 'owned-row';
    row.innerHTML = `<span class="glyph">${c.glyph}</span><span class="owned-name" title="${c.text}">${c.name}</span>`;
    const sell = document.createElement('button');
    sell.className = 'btn secondary small';
    sell.textContent = `Sell $${sellPrice(c)}`;
    sell.addEventListener('click', () => {
      sfx.coin();
      run.coins += sellPrice(c);
      run.charms = run.charms.filter((id) => id !== c.id);
      renderShop();
      renderCharms();
    });
    row.appendChild(sell);
    return row;
  }));
}

// Selling refunds half the price, rounded down (at least $1).
const sellPrice = (c) => Math.max(1, Math.floor(c.price / 2));

els.shopReroll.addEventListener('click', () => {
  if (run.coins < shop.rerollCost) return;
  run.coins -= shop.rerollCost;
  sfx.shuffle();
  shop.rerollCost += 1;
  shop.offers = shopOffers(shop.rng, run.charms);
  renderShop();
});

els.shopLeave.addEventListener('click', () => {
  els.shop.classList.add('hidden');
  const { onLeave } = shop;
  shop = null;
  onLeave();
});

// ---------- Tutorial ----------

// A fixed practice hand. Tiles are drawn from the end of the bag.
const TUTORIAL_HAND = ['c', 'a', 't', 'th', 'e', 'x', 'z', 's'];
const TUTORIAL_BAG = ['e', 'a', 'l', 'g', 'i', 'n', 'r', 'o'];

const TUTORIAL_STEPS = [
  { text: 'Welcome, apprentice! You cast spells by spelling words with your letter tiles.', button: 'Show me' },
  { text: 'Tap <b>C</b>, <b>A</b> and <b>T</b> to spell CAT, then tap <b>Cast</b>.', action: 'cast', word: 'cat', tiles: ['c', 'a', 't'] },
  { text: 'Nice! The small number on each tile is its value. Your score is <b>letter points × multiplier</b>, and the multiplier grows with longer words.', button: 'Next' },
  { text: '<b>X</b> and <b>Z</b> are tricky letters. Tap both, then tap <b>Discard</b> to swap them for new ones. You get 3 discards per round.', action: 'discard', tiles: ['x', 'z'] },
  { text: 'Stuck for ideas? Tap <b>Shuffle</b> to mix up your hand. Shuffling is free.', action: 'shuffle', tiles: [] },
  { text: 'Golden tiles hold two letters. Spell <b>THORN</b> with the <b>TH</b> tile. It counts as two letters, so THORN is a 5-letter word worth ×3.', action: 'cast', word: 'thorn', tiles: ['th', 'o', 'r', 'n'] },
  { text: `That’s it! Reach each round’s target before your casts run out. Cleared rounds earn coins to spend on charms in the shop. After rounds ${BONUS_AFTER[0] + 1} and ${BONUS_AFTER[1] + 1} there’s a ${BONUS_SECONDS}-second bonus round, and rounds ${BOSS_ROUNDS[0] + 1} and ${BOSS_ROUNDS[1] + 1} are boss rounds that bend one rule.`, button: 'Start round 1', last: true },
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
  if (!state || busy || !els.overlay.classList.contains('hidden') || !els.shop.classList.contains('hidden') || !els.picker.classList.contains('hidden')) return;
  if (e.key === 'Enter') { e.preventDefault(); castForTutorial(); return; }
  if (e.key === 'Backspace') { selected = selected.slice(0, -1); pendingKey = null; render(); return; }
  if (e.key === 'Escape') { selected = []; pendingKey = null; render(); return; }
  const key = e.key.toLowerCase();
  if (!/^[a-z]$/.test(key)) return;
  // Typing the second letter of a two-letter tile just picked does nothing.
  if (pendingKey === key) { pendingKey = null; return; }
  pendingKey = null;
  const free = state.hand.filter((t) => !t.hidden && !selected.includes(t.id) && !els.hand.children[state.hand.indexOf(t)]?.classList.contains('locked'));
  const tile = free.find((t) => t.letter === key) || free.find((t) => t.letter.length > 1 && t.letter[0] === key);
  if (!tile) return;
  if (tile.letter.length > 1) pendingKey = tile.letter.slice(1);
  toggle(tile.id);
});

els.cast.addEventListener('click', castForTutorial);
els.discard.addEventListener('click', discard);
els.shuffle.addEventListener('click', shuffle);
els.help.addEventListener('click', startTutorial);

// Start over asks first, inside the game, since a run is easy to lose by a stray tap.
els.restart.addEventListener('click', () => {
  if (busy) return;
  pauseClock();
  showOverlay(
    'Start over?',
    tutorial
      ? 'This skips the rest of the tutorial and starts a new run from round 1.'
      : 'Your progress in this run will be lost, including any bonus rewards.',
    'Start over',
    () => {
      if (tutorial) {
        tutorial = null;
        els.coach.classList.add('hidden');
        try { localStorage.setItem('whizz-tutorial-done', '1'); } catch { /* storage unavailable */ }
      }
      stopTimer();
      if (BOSS_TRIALS) startTrials();
      else startRun();
    },
    { alt: { label: 'Keep playing', onClick: resumeClock } },
  );
});

// Pause: freezes the bonus clock and covers the board until Resume.
function showPause() {
  if (busy || !els.overlay.classList.contains('hidden') || !els.shop.classList.contains('hidden')) return;
  pauseClock();
  showOverlay('Paused', 'Your game is on hold. Take your time.', 'Resume', resumeClock, {
    alt: { label: 'How to play', onClick: startTutorial },
    sound: true,
  });
}

function renderSoundToggle() {
  els.overlaySound.textContent = soundOn() ? '♪ Sound: on' : '♪ Sound: off';
  els.overlaySound.setAttribute('aria-pressed', String(soundOn()));
}
els.overlaySound.addEventListener('click', () => {
  setSound(!soundOn());
  renderSoundToggle();
  sfx.tap();
});
els.pause.addEventListener('click', showPause);
// Leaving the tab pauses a running bonus clock.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && timer) showPause();
});

loadDictionary()
  .then(() => {
    els.loading.classList.add('hidden');
    let seen = false;
    try { seen = localStorage.getItem('whizz-tutorial-done') === '1'; } catch { /* storage unavailable */ }
    // Playtest shortcuts: #bonus jumps to the first bonus round, #shop opens
    // the shop with $20 before round 1.
    if (BOSS_TRIALS) startTrials();
    else if (location.hash === '#bonus') startBonus(BONUS_AFTER[0]);
    else if (location.hash === '#boss') { startRun(); startRound(BOSS_ROUNDS[0]); }
    else if (location.hash === '#shop') { startRun(); run.coins = 20; renderCharms(); openShop(() => startRound(0)); }
    else if (seen) startRun();
    else startTutorial();
  })
  .catch((err) => { els.loading.textContent = `Could not open the spellbook: ${err.message}`; });
