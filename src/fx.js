// Visual effects: sparkle bursts, screen shake and counting numbers.
// All of them step aside when the player asks for reduced motion.

export const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export { wait };

// Little stars flying out from a point (viewport coordinates).
export function burst(x, y, { count = 12, spread = 90, colors = ['#f2c35b', '#fff3c4', '#9b7bff'] } = {}) {
  if (reducedMotion()) return;
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.className = 'spark';
    s.textContent = i % 3 ? '✦' : '•';
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = spread * (0.5 + Math.random() * 0.7);
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    s.style.color = colors[i % colors.length];
    s.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    s.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
    s.style.fontSize = `${10 + Math.random() * 10}px`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 900);
  }
}

export function burstFrom(el, opts) {
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, opts);
}

export function screenShake(el, strength = 1) {
  if (reducedMotion()) return;
  el.style.setProperty('--shake', `${4 * strength}px`);
  el.classList.remove('quake');
  void el.offsetWidth;
  el.classList.add('quake');
}

// A small label that floats up from an element, e.g. "+3" above a tile.
export function popLabel(el, text, cls = '') {
  const r = el.getBoundingClientRect();
  const p = document.createElement('div');
  p.className = `pop-label ${cls}`;
  p.textContent = text;
  p.style.left = `${r.left + r.width / 2}px`;
  p.style.top = `${r.top}px`;
  document.body.appendChild(p);
  setTimeout(() => p.remove(), 800);
}

// Count a number up over ms, calling onStep with each value.
export function countUp(from, to, ms, onStep) {
  if (reducedMotion() || ms <= 0 || from === to) { onStep(to); return Promise.resolve(); }
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - start) / ms);
      const eased = 1 - (1 - k) ** 3;
      onStep(Math.round(from + (to - from) * eased));
      if (k < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}
