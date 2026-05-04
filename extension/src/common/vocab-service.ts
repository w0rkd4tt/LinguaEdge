import { db } from './db';
import { initialSrsState, applyGrade, type SrsGrade } from './srs';
import { lemmatize } from './lemma';
import { uid } from './uid';
import type {
  Deck,
  KnowledgeState,
  SaveWordPayload,
  StatsResponse,
  VocabularyItem,
} from './types';

function todayStart(now = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export async function ensureDeckForUrl(
  sourceUrl: string,
  sourceTitle: string,
): Promise<Deck | null> {
  if (!sourceUrl) return null;
  let host = '';
  try {
    host = new URL(sourceUrl).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
  if (!host) return null;
  const id = `auto:${host}`;
  let deck = await db.decks.get(id);
  if (!deck) {
    deck = {
      id,
      name: prettyHostName(host, sourceTitle),
      type: 'auto',
      sourcePattern: host,
      createdAt: Date.now(),
    };
    await db.decks.put(deck);
  }
  return deck;
}

function prettyHostName(host: string, title: string): string {
  const base = host.split('.').slice(-2, -1)[0] || host;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export async function saveWord(payload: SaveWordPayload): Promise<VocabularyItem> {
  const word = payload.word.trim().toLowerCase();
  const lemma = lemmatize(word);
  const now = Date.now();

  let item = await db.vocabulary.where('lemma').equals(lemma).first();
  let deckId: string | undefined;
  if (payload.context?.sourceUrl) {
    const deck = await ensureDeckForUrl(
      payload.context.sourceUrl,
      payload.context.sourceTitle,
    );
    deckId = deck?.id;
  }

  if (!item) {
    item = {
      id: uid(),
      word,
      lemma,
      language: 'en',
      state: 'new',
      meanings: payload.meanings ?? [{ translation: payload.translation }],
      pronunciation: payload.pronunciation,
      contexts: payload.context
        ? [{ ...payload.context, capturedAt: now }]
        : [],
      decks: deckId ? [deckId] : [],
      tags: [],
      srs: initialSrsState(now),
      createdAt: now,
      updatedAt: now,
    };
    await db.vocabulary.put(item);
    return item;
  }

  if (payload.context) {
    const dup = item.contexts.find(
      (c) => c.sourceUrl === payload.context!.sourceUrl &&
        c.sentence === payload.context!.sentence,
    );
    if (!dup) item.contexts.unshift({ ...payload.context, capturedAt: now });
    if (item.contexts.length > 50) item.contexts.length = 50;
  }
  if (deckId && !item.decks.includes(deckId)) item.decks.push(deckId);
  if (!item.meanings.length && payload.translation) {
    item.meanings = [{ translation: payload.translation }];
  }
  item.updatedAt = now;
  await db.vocabulary.put(item);
  return item;
}

export async function getByLemma(lemma: string): Promise<VocabularyItem | undefined> {
  return db.vocabulary.where('lemma').equals(lemma.toLowerCase()).first();
}

export async function setState(id: string, state: KnowledgeState): Promise<void> {
  const now = Date.now();
  const item = await db.vocabulary.get(id);
  if (!item) return;
  item.state = state;
  item.updatedAt = now;
  if (state === 'known' || state === 'ignored') {
    item.srs = { ...item.srs, nextReviewAt: now + 365 * 24 * 60 * 60 * 1000 };
  }
  await db.vocabulary.put(item);
}

export async function gradeReview(id: string, grade: SrsGrade): Promise<VocabularyItem | null> {
  const item = await db.vocabulary.get(id);
  if (!item) return null;
  item.srs = applyGrade(item.srs, grade);
  item.updatedAt = Date.now();
  if (grade < 3 && item.state === 'reviewing') item.state = 'learning';
  if (grade >= 4 && item.state === 'new') item.state = 'learning';
  if (grade >= 4 && item.srs.repetitions >= 3 && item.state === 'learning') {
    item.state = 'reviewing';
  }
  if (grade >= 4 && item.srs.repetitions >= 6) item.state = 'known';
  await db.vocabulary.put(item);
  return item;
}

export async function getDueItems(limit = 50): Promise<VocabularyItem[]> {
  const now = Date.now();
  return db.vocabulary
    .where('srs.nextReviewAt')
    .belowOrEqual(now)
    .and((v) => v.state !== 'known' && v.state !== 'ignored')
    .limit(limit)
    .toArray();
}

export async function getStats(): Promise<StatsResponse> {
  const all = await db.vocabulary.toArray();
  const now = Date.now();
  const start = todayStart(now);
  const byState: StatsResponse['byState'] = {
    new: 0, learning: 0, reviewing: 0, known: 0, ignored: 0,
  };
  let dueToday = 0;
  let reviewedToday = 0;
  for (const v of all) {
    byState[v.state]++;
    if (v.srs.nextReviewAt <= now && v.state !== 'known' && v.state !== 'ignored') {
      dueToday++;
    }
    if (v.srs.lastReviewedAt && v.srs.lastReviewedAt >= start) reviewedToday++;
  }
  const streak = await computeStreak();
  return { total: all.length, byState, dueToday, reviewedToday, streakDays: streak };
}

async function computeStreak(): Promise<number> {
  const sessions = await db.reviewSessions.orderBy('startedAt').reverse().toArray();
  if (!sessions.length) return 0;
  let streak = 0;
  let cursor = todayStart();
  const seen = new Set<number>();
  for (const s of sessions) {
    const day = todayStart(s.startedAt);
    if (seen.has(day)) continue;
    seen.add(day);
    if (day === cursor) {
      streak++;
      cursor -= 24 * 60 * 60 * 1000;
    } else if (day < cursor) {
      break;
    }
  }
  return streak;
}

export async function exportAll(): Promise<{
  exportedAt: number;
  vocabulary: VocabularyItem[];
  decks: Deck[];
  drillEvents?: import('./types').DrillEvent[];
  reviewSessions?: import('./types').ReviewSession[];
}> {
  const [vocabulary, decks, drillEvents, reviewSessions] = await Promise.all([
    db.vocabulary.toArray(),
    db.decks.toArray(),
    db.drillEvents.toArray().catch(() => []),
    db.reviewSessions.toArray().catch(() => []),
  ]);
  return { exportedAt: Date.now(), vocabulary, decks, drillEvents, reviewSessions };
}

export function toCsv(items: VocabularyItem[]): string {
  const headers = ['word', 'lemma', 'state', 'translation', 'sentence', 'sourceUrl', 'createdAt'];
  const escape = (s: string) => '"' + s.replace(/"/g, '""') + '"';
  const rows = items.map((v) => {
    const ctx = v.contexts[0];
    return [
      v.word,
      v.lemma,
      v.state,
      v.meanings[0]?.translation ?? '',
      ctx?.sentence ?? '',
      ctx?.sourceUrl ?? '',
      new Date(v.createdAt).toISOString(),
    ].map((cell) => escape(String(cell))).join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}
