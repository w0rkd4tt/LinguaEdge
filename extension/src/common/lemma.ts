// Lightweight English lemmatizer. Not perfect, but good enough to deduplicate
// common inflections without shipping a 1MB dictionary. Falls back to the
// lowercased word when no rule applies.

const IRREGULAR: Record<string, string> = {
  am: 'be', is: 'be', are: 'be', was: 'be', were: 'be', been: 'be', being: 'be',
  has: 'have', had: 'have', having: 'have',
  does: 'do', did: 'do', done: 'do', doing: 'do',
  went: 'go', gone: 'go', going: 'go',
  said: 'say', saying: 'say',
  made: 'make', making: 'make',
  took: 'take', taken: 'take', taking: 'take',
  came: 'come', coming: 'come',
  saw: 'see', seen: 'see', seeing: 'see',
  knew: 'know', known: 'know', knowing: 'know',
  got: 'get', gotten: 'get', getting: 'get',
  gave: 'give', given: 'give', giving: 'give',
  found: 'find', finding: 'find',
  thought: 'think', thinking: 'think',
  told: 'tell', telling: 'tell',
  felt: 'feel', feeling: 'feel',
  brought: 'bring', bringing: 'bring',
  bought: 'buy', buying: 'buy',
  caught: 'catch', catching: 'catch',
  taught: 'teach', teaching: 'teach',
  ran: 'run', running: 'run',
  swam: 'swim', swum: 'swim', swimming: 'swim',
  ate: 'eat', eaten: 'eat', eating: 'eat',
  drove: 'drive', driven: 'drive', driving: 'drive',
  wrote: 'write', written: 'write', writing: 'write',
  read: 'read', reading: 'read',
  better: 'good', best: 'good',
  worse: 'bad', worst: 'bad',
  more: 'much', most: 'much',
  children: 'child', men: 'man', women: 'woman', people: 'person',
  feet: 'foot', teeth: 'tooth', mice: 'mouse', geese: 'goose',
};

export function lemmatize(input: string): string {
  const w = input.trim().toLowerCase();
  if (!w) return w;
  if (IRREGULAR[w]) return IRREGULAR[w];

  // -ing
  if (w.endsWith('ing') && w.length > 5) {
    const stem = w.slice(0, -3);
    if (/([^aeiou])\1$/.test(stem)) return stem.slice(0, -1); // running -> run
    if (stem.endsWith('y')) return stem;
    return stem;
  }
  // -ed
  if (w.endsWith('ied') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('ed') && w.length > 4) {
    const stem = w.slice(0, -2);
    if (/([^aeiou])\1$/.test(stem)) return stem.slice(0, -1);
    if (stem.endsWith('e')) return stem;
    return stem;
  }
  // -ies / -es / -s
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('es') && w.length > 3 && /(s|x|z|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);

  return w;
}

const SENTENCE_END = /([.!?…])(\s|$)/g;

export function extractSentence(fullText: string, target: string): string {
  if (!fullText) return target;
  const idx = fullText.toLowerCase().indexOf(target.toLowerCase());
  if (idx === -1) return target;

  const before = fullText.slice(0, idx);
  const after = fullText.slice(idx);

  let start = 0;
  let m: RegExpExecArray | null;
  SENTENCE_END.lastIndex = 0;
  while ((m = SENTENCE_END.exec(before)) !== null) {
    start = m.index + m[0].length;
  }

  SENTENCE_END.lastIndex = 0;
  const aftIdx = after.search(/[.!?…]/);
  const end = aftIdx === -1 ? fullText.length : idx + aftIdx + 1;

  return fullText.slice(start, end).trim();
}

export function looksLikeWord(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.length > 80) return false;
  return /[A-Za-z]/.test(trimmed);
}

// Accepts anything translate-worthy: single word, phrase, or paragraph.
// Caps length to keep API calls reasonable.
export function looksLikeTranslatable(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 1 || trimmed.length > 5000) return false;
  return /\p{L}/u.test(trimmed);
}
