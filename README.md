# Whizz Words

A cozy wizard word roguelite for the web, targeting [CrazyGames](https://www.crazygames.com).
Build words from letter tiles, score `chips × mult`, and hit each round's target.

## Status: M1, the core round

- Hand of 8 letter tiles from a 56-tile bag (with a single **Qu** tile)
- 4 casts and 3 discards per round
- Score = `(letter values + length bonus) × (word length − 2)`
- 5 rounds with rising targets. There's no shop, charms or bosses yet (that's M2).
- Tap/click tiles, or type on a keyboard (Enter casts, Backspace undoes, Esc clears)

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
