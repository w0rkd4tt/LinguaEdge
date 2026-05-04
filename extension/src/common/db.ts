import Dexie, { type Table } from 'dexie';
import type {
  Deck,
  DrillEvent,
  ReviewSession,
  Settings,
  TranslationCacheEntry,
  VocabularyItem,
} from './types';
import { DEFAULT_SETTINGS } from './types';

interface SettingRow {
  key: string;
  value: unknown;
}

class LinguaEdgeDB extends Dexie {
  vocabulary!: Table<VocabularyItem, string>;
  decks!: Table<Deck, string>;
  reviewSessions!: Table<ReviewSession, string>;
  translationCache!: Table<TranslationCacheEntry, string>;
  drillEvents!: Table<DrillEvent, string>;
  settings!: Table<SettingRow, string>;

  constructor() {
    super('linguaedge');
    this.version(1).stores({
      vocabulary:
        'id, word, lemma, language, state, createdAt, updatedAt, srs.nextReviewAt, *decks, *tags',
      decks: 'id, name, type, createdAt',
      reviewSessions: 'id, startedAt, endedAt',
      translationCache: 'key, cachedAt',
      settings: 'key',
    });
    this.version(2).stores({
      drillEvents: 'id, vocabularyId, at, correct, outcome',
    });
  }
}

export const db = new LinguaEdgeDB();

export async function getSettings(): Promise<Settings> {
  const rows = await db.settings.toArray();
  const partial: Partial<Settings> = {};
  for (const row of rows) {
    (partial as Record<string, unknown>)[row.key] = row.value;
  }
  return { ...DEFAULT_SETTINGS, ...partial };
}

export async function setSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K],
): Promise<void> {
  await db.settings.put({ key, value });
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  const rows = Object.entries(patch).map(([key, value]) => ({ key, value }));
  if (rows.length) await db.settings.bulkPut(rows);
}
