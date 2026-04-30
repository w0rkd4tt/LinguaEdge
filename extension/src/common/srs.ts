import type { SrsState } from './types';

// SM-2 (SuperMemo 2) implementation.
// Grade scale: 0=Forgot, 3=Hard, 4=Good, 5=Easy.
export type SrsGrade = 0 | 3 | 4 | 5;

const DAY_MS = 24 * 60 * 60 * 1000;

export function initialSrsState(now = Date.now()): SrsState {
  return {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewAt: now,
    lapses: 0,
  };
}

export function applyGrade(state: SrsState, grade: SrsGrade, now = Date.now()): SrsState {
  let { easeFactor, interval, repetitions, lapses } = state;

  if (grade < 3) {
    repetitions = 0;
    interval = 1;
    lapses += 1;
  } else {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetitions += 1;
  }

  // ease factor update from SM-2:
  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)),
  );

  return {
    easeFactor: Math.round(easeFactor * 1000) / 1000,
    interval,
    repetitions,
    nextReviewAt: now + interval * DAY_MS,
    lastReviewedAt: now,
    lapses,
  };
}

export function isDue(state: SrsState, now = Date.now()): boolean {
  return state.nextReviewAt <= now;
}
