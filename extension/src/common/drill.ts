import { db } from './db';
import type { VocabularyItem } from './types';

export interface DrillCard {
  item: VocabularyItem;
  prompt: string;          // example sentence with target word highlighted
  highlightWord: string;   // exact form to highlight in prompt
  correct: string;         // correct meaning
  options: string[];       // 4 options (shuffled)
}

const MIN_POOL = 4;

// Pick a random word that the user is actively learning. Bias: 70% to new,
// 30% to learning. Skips known/ignored. Returns null if not enough vocabulary
// to construct distractors.
export async function pickDrillCard(): Promise<DrillCard | null> {
  const pool = await db.vocabulary
    .where('state')
    .anyOf('new', 'learning', 'reviewing')
    .toArray();
  if (pool.length === 0) return null;

  // Need >= MIN_POOL items overall (any state) to construct distractors.
  const allWithMeaning = await db.vocabulary
    .filter((v) => !!v.meanings[0]?.translation)
    .toArray();
  if (allWithMeaning.length < MIN_POOL) return null;

  const newOrLearning = pool.filter((v) => v.state === 'new' || v.state === 'learning');
  const reviewing = pool.filter((v) => v.state === 'reviewing');
  const bucket = newOrLearning.length && Math.random() < 0.75
    ? newOrLearning
    : (reviewing.length ? reviewing : pool);

  // Bias toward least-recently-drilled / oldest-updated within the bucket.
  bucket.sort((a, b) => a.updatedAt - b.updatedAt);
  // Pick from the older half with some randomness.
  const half = bucket.slice(0, Math.max(1, Math.ceil(bucket.length / 2)));
  const item = half[Math.floor(Math.random() * half.length)];

  const correct = item.meanings[0]?.translation;
  if (!correct) return null;

  const distractors = pickDistractors(allWithMeaning, item, correct);
  if (distractors.length < 3) return null;

  const options = shuffle([correct, ...distractors.slice(0, 3)]);

  // Prefer a saved context sentence; fall back to fetching one.
  let prompt = item.contexts[0]?.sentence ?? '';
  if (!prompt || !containsWord(prompt, item.word)) {
    const fetched = await fetchExampleSentence(item.word);
    prompt = fetched ?? buildSyntheticPrompt(item.word);
  }

  return {
    item,
    prompt,
    highlightWord: item.word,
    correct,
    options,
  };
}

function pickDistractors(
  all: VocabularyItem[],
  target: VocabularyItem,
  correct: string,
): string[] {
  // Prefer same-deck distractors, fall back to global, dedupe by translation.
  const sameDeck = all.filter(
    (v) =>
      v.id !== target.id &&
      v.decks.some((d) => target.decks.includes(d)) &&
      v.meanings[0]?.translation &&
      v.meanings[0].translation !== correct,
  );
  const others = all.filter(
    (v) =>
      v.id !== target.id &&
      !sameDeck.includes(v) &&
      v.meanings[0]?.translation &&
      v.meanings[0].translation !== correct,
  );
  const ordered = [...shuffle(sameDeck), ...shuffle(others)];
  const seen = new Set<string>([correct]);
  const out: string[] = [];
  for (const v of ordered) {
    const t = v.meanings[0]!.translation;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length === 3) break;
  }
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function containsWord(sentence: string, word: string): boolean {
  return new RegExp(`\\b${escapeRegex(word)}\\b`, 'i').test(sentence);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSyntheticPrompt(word: string): string {
  return `____ — bạn còn nhớ nghĩa của "${word}"?`;
}

const EXAMPLE_CACHE_KEY_PREFIX = 'drill.example:';
const EXAMPLE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface DictionaryEntry {
  meanings?: Array<{
    definitions?: Array<{
      definition?: string;
      example?: string;
    }>;
  }>;
}

// Fetches an example sentence from dictionaryapi.dev (free, no key). Caches
// results in chrome.storage.local for 30 days; misses are remembered too so we
// don't hammer the endpoint for words it doesn't know.
export async function fetchExampleSentence(word: string): Promise<string | null> {
  const key = EXAMPLE_CACHE_KEY_PREFIX + word.toLowerCase();
  try {
    const cached = (await chrome.storage.local.get(key))[key] as
      | { example: string | null; at: number }
      | undefined;
    if (cached && Date.now() - cached.at < EXAMPLE_TTL_MS) {
      return cached.example;
    }
  } catch { /* ignore */ }

  let example: string | null = null;
  try {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
    const res = await fetch(url);
    if (res.ok) {
      const entries = (await res.json()) as DictionaryEntry[];
      for (const entry of entries ?? []) {
        for (const m of entry.meanings ?? []) {
          for (const def of m.definitions ?? []) {
            if (def.example && def.example.length > 8) {
              example = def.example;
              break;
            }
          }
          if (example) break;
        }
        if (example) break;
      }
    }
  } catch { /* network error → null */ }

  try {
    await chrome.storage.local.set({ [key]: { example, at: Date.now() } });
  } catch { /* ignore */ }
  return example;
}
