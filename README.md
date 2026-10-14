# Whizz Words

A cozy wizard word roguelite for the web, targeting [CrazyGames](https://www.crazygames.com).
Build words from letter tiles, score `chips × mult`, and hit each round's target.

## Status: M1+, a playable run

- Hand of 8 tiles from a 61-tile bag, including golden two-letter tiles (**Qu, Th, Er, In, St, Ch**) that count as two letters
- 4 casts and 3 discards per round, plus a free shuffle
- Score = `(letter values + length bonus) × (word length − 2)`
- 5 rounds with targets 90 → 130 → 180 → 240 → 310
- **Bonus round** after round 3: 60 seconds of unlimited casts. Finding 3 / 6 / 10 words earns extra casts and discards for the remaining rounds.
- **Tutorial** on first visit (replay with the ? button): a scripted practice hand that teaches casting, discarding, shuffling and two-letter tiles
- Tap/click tiles, or type on a keyboard (Enter casts, Backspace undoes, Esc clears)
- Playtest shortcut: open the page with `#bonus` to jump straight to the bonus round

## Run it

No build step is needed. Serve the folder with any static server:

```sh
npm start          # http://localhost:5173
npm test           # unit tests for the game logic
npm run sim        # bot plays many rounds and reports win rate per target
```

## Layout

| Path | What |
|---|---|
| `src/game.js` | Pure game rules (no DOM): bag, scoring, rounds, seeded RNG |
| `src/main.js` | UI, input and animations |
| `src/dictionary.js` | Loads the word list into a `Set` |
| `assets/words.txt` | ENABLE word list (public domain), 3–9 letter words |
| `tools/sim.mjs` | Balance simulation |

## Roadmap

M1 core round → M2 full run (shop, charms, bosses) → M3 feel and sound → M4 meta-progression
→ M5 balance → M6 CrazyGames Basic Launch → M7 SDK, ads, saves (Full Launch).
