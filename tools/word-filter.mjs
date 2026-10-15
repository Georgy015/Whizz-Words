// Word-filter rules shared by tools/filter-words.mjs and the tests.
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;

// Innocent words that the list or its variations would otherwise catch.
export const ALLOW = new Set([
  // listed entries with innocent common meanings
  'fingering', 'escort', 'eunuch', 'scat', 'snatch', 'suck', 'sucks', 'butt', 'shrimping',
  'swinger', 'hardcore', 'bareback', 'bastinado', 'strappado', 'figging', 'voyeur', 'playboy',
  'sadism', 'fecal', 'rectum', 'genitals', 'incest', 'nudity', 'sexuality', 'sexually', 'sexual',
  // variations that are different, innocent words
  'spiced', 'spicer', 'spicers', 'spices', 'spicier', 'spiciest', 'spicing', 'spicy',
  'skeeter', 'skeeters', 'cocker', 'cockers', 'dicker', 'dickers', 'monger', 'mongers',
  'titer', 'titers', 'spunky', 'spunkier', 'spunkiest', 'booby', 'vibratory', 'sexes', 'beanery',
]);

const SUFFIXES = ['s', 'es', 'ed', 'ing', 'er', 'ers', 'y', 'ier', 'iest'];

export function variations(word) {
  const forms = [word, ...SUFFIXES.map((s) => word + s)];
  if (word.endsWith('e')) forms.push(`${word.slice(0, -1)}ing`, `${word.slice(0, -1)}ed`);
  // short words double their last consonant: smut -> smutty, shit -> shitting
  if (!/[aeiouy]$/.test(word) && word.length <= 4) {
    for (const s of ['ed', 'ing', 'y', 'ier', 'iest']) forms.push(word + word.at(-1) + s);
  }
  return forms;
}

export const listed = readFileSync(`${root}tools/blocklist-en.txt`, 'utf8')
  .split('\n')
  .map((l) => l.trim().toLowerCase())
  .filter((l) => l && !l.startsWith('#') && /^[a-z]+$/.test(l)); // single words only

export const blocked = new Set();
for (const word of listed) {
  if (ALLOW.has(word)) continue;
  for (const form of variations(word)) if (!ALLOW.has(form)) blocked.add(form);
}

