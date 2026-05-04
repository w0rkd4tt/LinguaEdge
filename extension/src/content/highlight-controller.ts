import type { KnowledgeState } from '@/common/types';
import type { ScannedMatch } from './page-scanner';

const HIGHLIGHT_STATES: ReadonlyArray<KnowledgeState> = [
  'new', 'learning', 'reviewing',
];

const STYLE_ID = 'linguaedge-highlight-style';

interface HighlightApi {
  Highlight: typeof window.Highlight;
  registry: HighlightRegistry;
}

function getHighlightApi(): HighlightApi | null {
  if (typeof CSS === 'undefined') return null;
  // CSS.highlights is the registry; Highlight is the constructor.
  if (!('highlights' in CSS) || typeof window.Highlight !== 'function') return null;
  return { Highlight: window.Highlight, registry: (CSS as unknown as { highlights: HighlightRegistry }).highlights };
}

/**
 * Paints saved vocabulary words on the page. Tries CSS Custom Highlight API
 * (Chromium 105+, no DOM mutation, no reflow); falls back to span-wrap when
 * the API is missing.
 *
 * Render is idempotent: each call REPLACES the highlight set per state, so
 * scrolling new content into the viewport just adds Ranges to the right
 * Highlight bucket via accumulateRanges().
 */
export class HighlightController {
  private enabled = true;
  private api: HighlightApi | null = getHighlightApi();
  private rangesByState: Record<KnowledgeState, Range[]> = emptyRangeBuckets();
  private highlights: Partial<Record<KnowledgeState, Highlight>> = {};
  private fallbackWraps: HTMLElement[] = [];
  private flushTimer: number | null = null;

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) this.clearAll();
    else this.scheduleFlush();
  }

  /** Drop all painted highlights — caller (PageScanner) emits empty list when
   * the index changes. */
  clear(): void {
    this.rangesByState = emptyRangeBuckets();
    this.scheduleFlush();
  }

  accumulate(matches: ScannedMatch[]): void {
    if (!this.enabled) return;
    if (!matches.length) {
      // Empty signal from scanner = full reset
      this.clearAll();
      return;
    }
    for (const m of matches) {
      if (!HIGHLIGHT_STATES.includes(m.item.state)) continue;
      this.rangesByState[m.item.state].push(m.range);
    }
    this.scheduleFlush();
  }

  attachStyles(targetRoot: ShadowRoot | Document): void {
    // The CSS Custom Highlight API uses pseudo-elements ::highlight(name) on
    // the *document* — these styles must live in the main document, not the
    // Shadow DOM. We add a single <style> tag in <head>, idempotently.
    const doc = (targetRoot instanceof Document) ? targetRoot : document;
    if (doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_CSS;
    doc.head?.appendChild(style) ?? doc.documentElement.appendChild(style);
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null) return;
    this.flushTimer = window.requestAnimationFrame(() => {
      this.flushTimer = null;
      this.flush();
    });
  }

  private flush(): void {
    if (this.api) this.flushHighlightApi();
    else this.flushFallback();
  }

  private flushHighlightApi(): void {
    if (!this.api) return;
    for (const state of HIGHLIGHT_STATES) {
      const ranges = this.rangesByState[state];
      const name = `linguaedge-${state}`;
      let h = this.highlights[state];
      if (!h) {
        h = new this.api.Highlight();
        this.highlights[state] = h;
        this.api.registry.set(name, h);
      } else {
        h.clear();
      }
      for (const r of ranges) {
        try { h.add(r); } catch { /* range gone */ }
      }
    }
  }

  private flushFallback(): void {
    // Wrap each range in a span. Slow on large pages, but only fires when the
    // browser doesn't support Highlight API. We accept the reflow cost there.
    this.unwrapFallback();
    for (const state of HIGHLIGHT_STATES) {
      for (const r of this.rangesByState[state]) {
        try {
          const span = document.createElement('span');
          span.className = `linguaedge-mark linguaedge-mark-${state}`;
          r.surroundContents(span);
          this.fallbackWraps.push(span);
        } catch { /* range cross-element, skip */ }
      }
    }
  }

  private unwrapFallback(): void {
    for (const span of this.fallbackWraps) {
      const parent = span.parentNode;
      if (!parent) continue;
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
    }
    this.fallbackWraps = [];
  }

  private clearAll(): void {
    this.rangesByState = emptyRangeBuckets();
    if (this.api) {
      for (const state of HIGHLIGHT_STATES) {
        const h = this.highlights[state];
        if (h) h.clear();
      }
    } else {
      this.unwrapFallback();
    }
  }
}

function emptyRangeBuckets(): Record<KnowledgeState, Range[]> {
  return { new: [], learning: [], reviewing: [], known: [], ignored: [] };
}

const STYLE_CSS = `
::highlight(linguaedge-new) {
  background-color: rgba(250, 204, 21, 0.32);
  text-decoration: underline wavy rgba(217, 119, 6, 0.55);
  text-underline-offset: 3px;
}
::highlight(linguaedge-learning) {
  background-color: rgba(251, 146, 60, 0.32);
  text-decoration: underline wavy rgba(194, 65, 12, 0.55);
  text-underline-offset: 3px;
}
::highlight(linguaedge-reviewing) {
  background-color: rgba(96, 165, 250, 0.28);
  text-decoration: underline wavy rgba(29, 78, 216, 0.50);
  text-underline-offset: 3px;
}

/* Fallback span wrap (browsers without Custom Highlight API) */
.linguaedge-mark {
  border-radius: 2px;
  padding: 0 1px;
  text-decoration: underline wavy;
  text-underline-offset: 3px;
}
.linguaedge-mark-new      { background: rgba(250, 204, 21, 0.32); text-decoration-color: rgba(217, 119, 6, 0.55); }
.linguaedge-mark-learning { background: rgba(251, 146, 60, 0.32); text-decoration-color: rgba(194, 65, 12, 0.55); }
.linguaedge-mark-reviewing{ background: rgba(96, 165, 250, 0.28); text-decoration-color: rgba(29, 78, 216, 0.50); }

/* Re-encounter: clickable dot anchor, paints alongside Custom Highlight too */
.linguaedge-reenc {
  position: relative !important;
  cursor: pointer;
  border-bottom: 2px dotted rgba(47, 123, 255, 0.55);
}
.linguaedge-reenc::after {
  content: '';
  position: absolute;
  top: -3px;
  right: -6px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #2f7bff;
  box-shadow: 0 0 0 2px rgba(47, 123, 255, 0.18);
  pointer-events: none;
  animation: linguaedge-pulse 1.4s ease-out infinite;
}
@keyframes linguaedge-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50%      { transform: scale(1.25); opacity: 0.7; }
}
.linguaedge-reenc:hover {
  background: rgba(47, 123, 255, 0.12);
}
`;
