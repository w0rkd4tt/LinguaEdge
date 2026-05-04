export type KnowledgeState = 'new' | 'learning' | 'reviewing' | 'known' | 'ignored';

export interface Meaning {
  partOfSpeech?: string;
  definition?: string;
  translation: string;
}

export interface Pronunciation {
  ipa?: string;
  audioUrl?: string;
}

export interface VocabContext {
  sentence: string;
  sourceUrl: string;
  sourceTitle: string;
  capturedAt: number;
}

export interface SrsState {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: number;
  lastReviewedAt?: number;
  lapses: number;
}

export interface VocabularyItem {
  id: string;
  word: string;
  lemma: string;
  language: string;
  state: KnowledgeState;
  meanings: Meaning[];
  pronunciation?: Pronunciation;
  contexts: VocabContext[];
  decks: string[];
  tags: string[];
  srs: SrsState;
  createdAt: number;
  updatedAt: number;
}

export interface Deck {
  id: string;
  name: string;
  type: 'auto' | 'manual';
  sourcePattern?: string;
  color?: string;
  createdAt: number;
}

export interface ReviewSession {
  id: string;
  startedAt: number;
  endedAt?: number;
  cardsReviewed: number;
  correct: number;
  incorrect: number;
}

export interface DrillEvent {
  id: string;
  vocabularyId: string;
  word: string;
  lemma: string;
  correct: boolean;
  // 'answered' = user picked an option; 'skipped' = closed without answering.
  outcome: 'answered' | 'skipped';
  // State the word was in BEFORE this drill — useful to see if drill is moving
  // words from new → learning → reviewing.
  stateBefore: KnowledgeState;
  at: number;
}

export interface TranslationCacheEntry {
  key: string;
  sourceText: string;
  translatedText: string;
  detectedSourceLang?: string;
  engine: string;
  meanings?: Meaning[];
  pronunciation?: Pronunciation;
  cachedAt: number;
  ttl: number;
}

export interface Settings {
  targetLang: string;
  sourceLang: 'auto' | string;
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  translateEngine: 'google';
  dailyNewLimit: number;
  dailyReviewLimit: number;
  autoDeckEnabled: boolean;
  notificationsEnabled: boolean;
  drillEnabled: boolean;
  drillIntervalMinutes: number;
  drillMaxPerHour: number;
  highlightEnabled: boolean;
  reencounterEnabled: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  targetLang: 'vi',
  sourceLang: 'auto',
  level: 'B1',
  translateEngine: 'google',
  dailyNewLimit: 10,
  dailyReviewLimit: 50,
  autoDeckEnabled: true,
  notificationsEnabled: true,
  drillEnabled: true,
  drillIntervalMinutes: 10,
  drillMaxPerHour: 3,
  highlightEnabled: true,
  reencounterEnabled: true,
};

// Messaging contract between content / popup / dashboard <-> service worker
export type RuntimeMessage =
  | { type: 'TRANSLATE'; text: string; sourceLang?: string; targetLang?: string }
  | { type: 'SAVE_WORD'; payload: SaveWordPayload }
  | { type: 'GET_WORD_BY_LEMMA'; lemma: string }
  | { type: 'UPDATE_WORD_STATE'; id: string; state: KnowledgeState }
  | { type: 'GET_STATS' }
  | { type: 'OPEN_DASHBOARD'; tab?: string }
  | { type: 'GET_DRILL_CARD' }
  | { type: 'GRADE_DRILL'; id: string; correct: boolean }
  | { type: 'SKIP_DRILL'; id: string }
  | { type: 'GET_HIGHLIGHT_INDEX' }
  | { type: 'GET_SETTINGS' }
  | { type: 'PING' };

export interface SaveWordPayload {
  word: string;
  translation: string;
  meanings?: Meaning[];
  pronunciation?: Pronunciation;
  context?: {
    sentence: string;
    sourceUrl: string;
    sourceTitle: string;
  };
}

export interface TranslateResponse {
  ok: boolean;
  text: string;
  translation: string;
  detectedSourceLang?: string;
  meanings?: Meaning[];
  pronunciation?: Pronunciation;
  error?: string;
}

export interface StatsResponse {
  total: number;
  byState: Record<KnowledgeState, number>;
  dueToday: number;
  reviewedToday: number;
  streakDays: number;
}
