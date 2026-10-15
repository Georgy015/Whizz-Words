// Removes offensive words from assets/words.txt so they aren't valid spells.
// Blocklist: tools/blocklist-en.txt (LDNOOBW, CC BY 4.0). Each listed word is
// removed along with its plain variations (plurals, -ed, -ing, -er, -y…).
// Words that only look offensive are kept via ALLOW. Safe to run repeatedly.
// Usage: node tools/filter-words.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { blocked } from './word-filter.mjs';

const root = new URL('..', import.meta.url).pathname;
const wordsPath = `${root}assets/words.txt`;

const words = readFileSync(wordsPath, 'utf8').split('\n').filter(Boolean);
const kept = words.filter((w) => !blocked.has(w));
writeFileSync(wordsPath, `${kept.join('\n')}\n`);
console.log(`words.txt: ${words.length} -> ${kept.length} words (${words.length - kept.length} removed)`);
