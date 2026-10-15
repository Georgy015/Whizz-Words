// CrazyGames SDK v3 wrapper. Every call is a safe no-op when the SDK isn't on
// the page (local play, the preview page), so the game runs the same anywhere.
// SDK docs: https://docs.crazygames.com/sdk/html5-v3/intro

// Basic Launch has monetization switched off, so ads stay off until Full Launch.
export const ADS_ENABLED = false;

let sdk = null;
let inGameplay = false;
const settingsListeners = [];

export async function initPlatform() {
  const S = window.CrazyGames?.SDK;
  if (!S) return false;
  try {
    await S.init();
  } catch {
    return false;
  }
  // 'disabled' means the SDK loaded outside CrazyGames.
  if (S.environment === 'disabled') return false;
  sdk = S;
  sdk.game.addSettingsChangeListener?.((settings) => settingsListeners.forEach((fn) => fn(settings)));
  return true;
}

export const onPlatform = () => sdk !== null;

const call = (fn) => { try { fn(); } catch { /* the SDK must never break the game */ } };

export const loadingStart = () => sdk && call(() => sdk.game.loadingStart());
export const loadingStop = () => sdk && call(() => sdk.game.loadingStop());
export const happytime = () => sdk && call(() => sdk.game.happytime());

// Tell CrazyGames whether the player is actively playing. Only state changes
// are sent: start on entering play, stop on every break (pop-ups, shop, pause).
export function setGameplay(active) {
  if (active === inGameplay) return;
  inGameplay = active;
  if (sdk) call(() => (active ? sdk.game.gameplayStart() : sdk.game.gameplayStop()));
}

// The site-wide mute setting, which overrides the game's own switches.
export const platformMuted = () => Boolean(sdk?.game?.settings?.muteAudio);
export const onSettingsChange = (fn) => settingsListeners.push(fn);

// Progress storage: the CrazyGames account when available, else this browser.
export function storeGet(key) {
  try { return sdk ? sdk.data.getItem(key) : localStorage.getItem(key); } catch { return null; }
}
export function storeSet(key, value) {
  try { (sdk ? sdk.data : localStorage).setItem(key, value); } catch { /* storage unavailable */ }
}

// A midgame ad between rounds. Resolves when it finishes, fails or is skipped
// (unfilled, too soon, adblock), so the game always continues.
export function midgameAd({ onStart, onEnd } = {}) {
  if (!sdk || !ADS_ENABLED) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; onEnd?.(); resolve(); };
    setTimeout(finish, 45000); // never leave the player stuck behind an ad
    call(() => sdk.ad.requestAd('midgame', {
      adStarted: () => onStart?.(),
      adFinished: finish,
      adError: finish,
    }));
  });
}
