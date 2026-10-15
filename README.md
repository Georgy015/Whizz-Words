# Whizz Words

A cozy wizard word roguelite for the web, targeting [CrazyGames](https://www.crazygames.com).
Build words from letter tiles, score `chips × mult`, and hit each round's target.

## Status: M3 in progress, feel and sound

- **8 rounds** with targets 60 → 85 → 115 → 150 → 190 → 240 → 300 → 370
- Hand of 8 tiles from a 61-tile bag, including golden two-letter tiles (**Qu, Th, Er, In, St, Ch**) that count as two letters
- 4 casts and 3 discards per round, plus a free shuffle
- Score = `(letter values + length bonus) × (word length − 2)`, then charms
- Points above a round's target carry into the next round, capped at half of its target
- **Coins:** clearing a round pays $3 + $1 per unused cast
- **Spell Shop** after every cleared round: 3 random charms, reroll for $1 (+$1 each time)
- **15 charms**, up to 5 at once, kept for the whole run (`src/charms.js`)
- **Bonus rounds** after rounds 3 and 6: 60 seconds of unlimited casts. 3 / 6 / 10 words earn extra casts and discards for the rest of the run.
- **Boss rounds** on rounds 4 and 8: a random boss bends one rule (7 regular bosses), and round 8 is always the final boss, the Charm Eater. Beating a boss pays an extra $3. Play any boss on its own with `#bosses` (Boss Trials).
- **Title screen** with logo, Play, How to play, Music/Sound switches and your best run
- **Background music:** a lo-fi, funky loop synthesized live (no audio files). It plays only during rounds and stops on every pop-up, the shop, the title screen and when the tab is hidden.
- **Fonts:** Cinzel Decorative for the logo and headlines, Fredoka for everything else (bundled in `assets/fonts`, SIL Open Font License)
- **Sound and animation:** synthesized sound effects (no audio files) and a letter-by-letter scoring show with sparkles, pops and a counting score. Sound can be switched off in the pause menu; animations respect the device's reduce-motion setting.
- **Tutorial** on first visit (replay with ?), **Start over** with ↺, **Pause** with ❚❚ (also freezes the bonus clock, and pauses automatically when you leave the tab)
- After a win: **Continue to next round** or **Visit the shop**; in the shop you can **sell** a charm for half its price to free a slot
- Tap/click tiles, or type on a keyboard (Enter casts, Backspace undoes, Esc clears)
- Playtest shortcuts: open the page with `#bonus` (a bonus round), `#shop` (start with $20 in the shop) or `#boss` (jump to the round 4 boss)

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
| `src/game.js` | Pure game rules (no DOM): bag, scoring, rounds, coins, seeded RNG |
| `src/charms.js` | Charm definitions, charm scoring and shop offers |
| `src/bosses.js` | Boss definitions and how they set up a round |
| `src/sound.js` | Sound effects, synthesized with the Web Audio API |
| `src/music.js` | Background music: a lo-fi loop sequenced live with Web Audio |
| `src/fx.js` | Sparkles, screen shake, floating labels and counting numbers |
| `src/main.js` | UI, input and animations |
| `src/dictionary.js` | Loads the word list into a `Set` |
| `assets/words.txt` | ENABLE word list (public domain), 3–9 letter words |
| `tools/sim.mjs` | Balance simulation: full runs with and without charms |

## Roadmap

M1 core round → M2 full run (shop, charms, bosses) → M3 feel and sound → M4 meta-progression
→ M5 balance → M6 CrazyGames Basic Launch → M7 SDK, ads, saves (Full Launch).
