import { db } from './db';
import { hashKey } from './uid';
import type { Meaning, Pronunciation, TranslateResponse } from './types';

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface GoogleResult {
  translation: string;
  detectedSourceLang?: string;
  meanings?: Meaning[];
  pronunciation?: Pronunciation;
}

// Uses Google's free translate.googleapis.com endpoint (also used by the
// official Translate browser extensions). No API key required.
async function callGoogle(
  text: string,
  source: string,
  target: string,
): Promise<GoogleResult> {
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', source);
  url.searchParams.set('tl', target);
  url.searchParams.set('dt', 't');     // translation
  url.searchParams.append('dt', 'bd'); // dictionary
  url.searchParams.append('dt', 'rm'); // romanisation/pronunciation
  url.searchParams.set('dj', '1');
  url.searchParams.set('q', text);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`translate failed: ${res.status}`);
  const data = (await res.json()) as {
    sentences?: Array<{ trans?: string; orig?: string; src_translit?: string }>;
    src?: string;
    dict?: Array<{
      pos?: string;
      terms?: string[];
      entry?: Array<{ word: string; reverse_translation?: string[] }>;
    }>;
  };

  const translation = (data.sentences ?? [])
    .map((s) => s.trans ?? '')
    .join('')
    .trim();

  const meanings: Meaning[] = [];
  if (data.dict) {
    for (const entry of data.dict) {
      const pos = entry.pos;
      const terms = (entry.terms ?? []).slice(0, 4).join(', ');
      if (terms) meanings.push({ partOfSpeech: pos, translation: terms });
    }
  }
  if (!meanings.length && translation) {
    meanings.push({ translation });
  }

  let pronunciation: Pronunciation | undefined;
  const translit = data.sentences?.find((s) => s.src_translit)?.src_translit;
  if (translit) pronunciation = { ipa: translit };

  return {
    translation,
    detectedSourceLang: data.src,
    meanings,
    pronunciation,
  };
}

export async function translateText(
  text: string,
  sourceLang = 'auto',
  targetLang = 'vi',
): Promise<TranslateResponse> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, text, translation: '', error: 'empty' };
  }

  const key = await hashKey(`google|${sourceLang}|${targetLang}|${trimmed}`);
  const now = Date.now();
  const hit = await db.translationCache.get(key).catch(() => undefined);
  if (hit && now - hit.cachedAt < hit.ttl) {
    return {
      ok: true,
      text: trimmed,
      translation: hit.translatedText,
      detectedSourceLang: hit.detectedSourceLang,
      meanings: hit.meanings,
      pronunciation: hit.pronunciation,
    };
  }

  try {
    const result = await callGoogle(trimmed, sourceLang, targetLang);
    await db.translationCache.put({
      key,
      sourceText: trimmed,
      translatedText: result.translation,
      detectedSourceLang: result.detectedSourceLang,
      engine: 'google',
      meanings: result.meanings,
      pronunciation: result.pronunciation,
      cachedAt: now,
      ttl: CACHE_TTL_MS,
    });
    return {
      ok: true,
      text: trimmed,
      translation: result.translation,
      detectedSourceLang: result.detectedSourceLang,
      meanings: result.meanings,
      pronunciation: result.pronunciation,
    };
  } catch (err) {
    return {
      ok: false,
      text: trimmed,
      translation: '',
      error: err instanceof Error ? err.message : 'unknown',
    };
  }
}
