# CrazyGames launch guide

Everything needed for **Basic Launch**: the two-week test with a limited audience and no ads. If the
game's metrics are good, CrazyGames moves it to **Full Launch**, which switches on ads and revenue share.

## What's ready

| Item | Where | Notes |
|---|---|---|
| Upload build | `whizz-words-crazygames.zip` (run `npm run build`) | About 0.3 MB, 8 files. Limits: 250 MB total, 1,500 files, 50 MB initial download (20 MB for the mobile homepage) |
| CrazyGames SDK v3 | `src/platform.js` | Loading, gameplay start/stop, happy time, site mute, progress saved to the player's account. Every call is a no-op outside CrazyGames |
| Midgame ads | `src/platform.js` | Wired in between rounds but **off** (`ADS_ENABLED = false`) for Basic Launch |
| Cover 16:9 | `store/cover-landscape-1920x1080.png` | |
| Cover 2:3 | `store/cover-portrait-800x1200.png` | |
| Cover 1:1 | `store/cover-square-800x800.png` | |
| Preview video, landscape | `store/preview-landscape-1920x1080.mp4` | 1080p 16:9, 17.8 s, silent, opens on the landscape cover |
| Preview video, portrait | `store/preview-portrait-1080x1620.mp4` | 1080p 2:3, 15.1 s, silent, opens on the portrait cover |
| Store text | Below | Title, descriptions, controls, tags |

Covers are rendered from `tools/cover.html` with `tools/store-assets.cjs`, so they can be restyled and
re-rendered. Per CrazyGames' rules they show no text except the title ("Whizz", with WORDS spelled in
tiles), no borders and no store icons. The videos follow the preview rules: 15–20 s, both orientations at
1080p, no sound, the static cover as the first frame, no black screens, no cursor and no speed-up.

## How CrazyGames sees a session

| Moment | SDK call |
|---|---|
| Page loads | `init`, then `loadingStart` / `loadingStop` around the word list |
| Player presses Play, or comes back from any pop-up | `gameplayStart` |
| Any pop-up, the shop, the pause screen, the title screen or a hidden tab | `gameplayStop` |
| Beating a boss or clearing the run | `happytime` |
| CrazyGames' mute setting | Silences all game sound and music, overriding the in-game switches |

Best run and "tutorial done" are stored with `SDK.data`, so they follow the player's CrazyGames
account. Sound and music switches stay in the browser.

## Upload steps

1. **Build:** run `npm install` once, then `npm run build`. This makes `whizz-words-crazygames.zip` in the repo folder.
2. **Developer account:** sign up or log in on the CrazyGames Developer Portal.
3. **New game:** choose an HTML5 game and upload `whizz-words-crazygames.zip`.
4. **Preview:** open the portal's preview of the uploaded build. Check that the title screen appears, Play starts the game, and the sound works after the first tap.
5. **Details:** fill in the store text below.
6. **Covers and video:** upload the three covers and the preview video from `store/`.
7. **Submit for QA.** After it passes, the game goes into Basic Launch.

## Store text

**Title:** Whizz Words

**Short description:**
Spell words from letter tiles, collect magical charms and outwit the bosses in this cozy wizard word game.

**Description:**
Whizz Words is a cozy word game with a dash of strategy. Each round you get eight letter tiles and four
casts to reach a target score. Spell a word, watch every letter light up as it scores, and see your
total climb.

Clear rounds to earn coins, then spend them in the Spell Shop on charms that bend the rules in your
favor. Bookworm doubles long words. Vowel Hunter rewards every vowel. Last Gasp turns your final cast
into a big finish. Combine them for huge scores.

Golden tiles hold two letters, like Qu, Th and St. A 60-second bonus round earns extra casts and
discards. Bosses like the Mute Owl, the Banshee and the Charm Eater each twist one rule. Can you
clear all eight rounds?

**Controls / how to play:**
- Tap or click letter tiles to spell a word, then press **Cast** to score it.
- **Discard** swaps selected tiles for new ones. **Shuffle** rearranges your hand for free.
- On a keyboard: type letters to pick tiles, **Enter** to cast, **Backspace** to undo, **Esc** to clear.
- Reach the round's target score before your casts run out.

**Suggested tags:** Word, Puzzle, Spelling, Card, Roguelike, Casual, Relaxing, Strategy

**Platforms:** desktop and mobile (portrait and landscape).

## Before you submit

- **Word filter: done.** Offensive words are removed from the word list at build time
  (`tools/filter-words.mjs`, using the CC BY 4.0 LDNOOBW list), so they aren't valid spells. Innocent
  look-alikes such as *spicy*, *scat* and *fingering* stay playable. A test fails if a blocked word
  ever returns to `assets/words.txt`.
- **Play it on a real phone** through the portal's preview, with sound on.

## For Full Launch, later

1. In `src/platform.js`, set `ADS_ENABLED = true`. A midgame ad then plays when moving to the next round,
   and the game pauses and mutes during it. CrazyGames limits how often ads actually show.
2. Consider a rewarded ad, such as "watch an ad for +1 cast".
3. Rebuild with `npm run build` and upload the new zip.
