// Loads the ENABLE word list (public domain) into a Set for O(1) lookups.
let words = null;

export async function loadDictionary(url = 'assets/words.txt') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load word list (${res.status})`);
  words = new Set((await res.text()).split('\n').filter(Boolean));
  return words.size;
}

export function isWord(word) {
  return words !== null && words.has(word.toLowerCase());
}
