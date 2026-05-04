import type { ScannedMatch } from './page-scanner';

const RE_STATES = new Set(['learning', 'reviewing']);

const QUIZ_COOLDOWN_MS = 30 * 60_000;       // don't requiz same word within 30 min
const QUIZ_MAX_PER_PAGE = 6;                // cap clickable dots per page

interface QuizCallback {
  (match: ScannedMatch, host: HTMLElement, anchor: { left: number; top: number }): void;
}

/**
 * Wraps in-viewport occurrences of learning/reviewing words with a clickable
 * marker (a tiny dot anchor). Clicking opens a mini-quiz delegated to the
 * caller (typically the same UI controller that handles drill).
 *
 * Different from HighlightController:
 *  - This DOES mutate the DOM (wrap span), because Highlight API can't accept
 *    pointer events.
 *  - Capped per page so we don't paint hundreds of dots in long articles.
 *  - Per-word cooldown so user isn't pestered repeatedly.
 */
export class ReencounterController {
  private enabled = true;
  private wraps = new Set<HTMLSpanElement>();
  private knownLemmas = new Set<string>();
  private cooldowns = new Map<string, number>();   // lemma → expires-at
  private onQuiz: QuizCallback;

  constructor(onQuiz: QuizCallback) {
    this.onQuiz = onQuiz;
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) this.clearAll();
  }

  clear(): void {
    this.knownLemmas.clear();
    this.clearAll();
  }

  /** Mark a lemma as recently quizzed so we don't dot it again immediately. */
  markCooldown(lemma: string): void {
    this.cooldowns.set(lemma, Date.now() + QUIZ_COOLDOWN_MS);
  }

  apply(matches: ScannedMatch[]): void {
    if (!this.enabled) return;
    if (!matches.length) {
      this.clearAll();
      return;
    }
    if (this.wraps.size >= QUIZ_MAX_PER_PAGE) return;

    for (const m of matches) {
      if (this.wraps.size >= QUIZ_MAX_PER_PAGE) break;
      if (!RE_STATES.has(m.item.state)) continue;
      if (this.knownLemmas.has(m.lemma)) continue;       // 1 dot per lemma per page
      const cooldownUntil = this.cooldowns.get(m.lemma);
      if (cooldownUntil && cooldownUntil > Date.now()) continue;
      try {
        this.wrapMatch(m);
      } catch { /* range may have moved, skip */ }
    }
  }

  private wrapMatch(m: ScannedMatch): void {
    const span = document.createElement('span');
    span.className = 'linguaedge-mark linguaedge-reenc';
    span.dataset.linguaedgeLemma = m.lemma;

    // Render-aware cursor + tooltip; the dot is a CSS ::after pseudo so it
    // doesn't disturb selection.
    span.title = `LinguaEdge: ôn nhanh "${m.item.word}"`;
    span.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const rect = span.getBoundingClientRect();
      this.onQuiz(m, span, { left: rect.left + rect.width / 2, top: rect.bottom });
    }, true);

    m.range.surroundContents(span);
    this.wraps.add(span);
    this.knownLemmas.add(m.lemma);
  }

  private clearAll(): void {
    for (const span of this.wraps) {
      const parent = span.parentNode;
      if (!parent) continue;
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
    }
    this.wraps.clear();
    this.knownLemmas.clear();
  }
}
