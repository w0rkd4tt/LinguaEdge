import type { KnowledgeState } from '@/common/types';
import { lemmatize } from '@/common/lemma';

export interface IndexedWord {
  id: string;
  word: string;
  lemma: string;
  state: KnowledgeState;
  translation: string;
}

export interface ScannedMatch {
  range: Range;
  word: string;          // raw matched text on page (e.g. "Running")
  lemma: string;         // normalized for vocab lookup (e.g. "run")
  item: IndexedWord;
}

export type StateFilter = readonly KnowledgeState[];

interface Index {
  // Map lemma → vocab item, for O(1) lookup during DOM walk.
  byLemma: Map<string, IndexedWord>;
  // Pre-compiled regex matching any saved word (longest first, word boundaries,
  // case-insensitive). null when index empty.
  pattern: RegExp | null;
}

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'CANVAS',
  'CODE', 'PRE', 'KBD', 'SAMP', 'TT',     // don't mess with code blocks
  'INPUT', 'TEXTAREA', 'SELECT', 'OPTION',
  'TITLE', 'HEAD', 'META', 'LINK',
]);

// Listeners that want updates whenever scanner has new matches in the viewport.
type Listener = (matches: ScannedMatch[]) => void;

/**
 * PageScanner walks the DOM (lazily, by viewport) and finds occurrences of
 * vocabulary words. Designed to be cheap on large pages — uses
 * IntersectionObserver so we only scan blocks the user is actually looking at,
 * and MutationObserver so SPA navigations don't leave us out of sync.
 *
 * It does NOT modify the DOM. Subscribers receive Range objects and decide
 * how to render highlights or click-targets.
 */
export class PageScanner {
  private index: Index = { byLemma: new Map(), pattern: null };
  private listeners = new Set<Listener>();
  private observed = new WeakSet<Element>();
  private intersectionObs: IntersectionObserver | null = null;
  private mutationObs: MutationObserver | null = null;
  private rescanTimer: number | null = null;
  private filter: StateFilter = ['new', 'learning', 'reviewing'];
  private started = false;

  setFilter(filter: StateFilter): void {
    this.filter = filter;
  }

  setIndex(items: IndexedWord[]): void {
    const byLemma = new Map<string, IndexedWord>();
    const tokens = new Set<string>();
    for (const item of items) {
      if (!this.filter.includes(item.state)) continue;
      byLemma.set(item.lemma, item);
      tokens.add(escapeRegex(item.word));
      if (item.lemma !== item.word) tokens.add(escapeRegex(item.lemma));
    }
    let pattern: RegExp | null = null;
    if (tokens.size) {
      // Sort longest-first so multi-word entries (if we add them later) win.
      const sorted = Array.from(tokens).sort((a, b) => b.length - a.length);
      pattern = new RegExp(`\\b(?:${sorted.join('|')})\\b`, 'gi');
    }
    this.index = { byLemma, pattern };
    if (this.started) this.rescanAll();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.intersectionObs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) this.scanElement(entry.target);
        }
      },
      { rootMargin: '200px 0px' },
    );
    this.mutationObs = new MutationObserver((records) => {
      // Coalesce DOM changes into one rescan.
      let touched = false;
      for (const r of records) {
        if (r.type === 'childList' && r.addedNodes.length) {
          for (const node of r.addedNodes) {
            if (node instanceof Element) {
              this.observeBlocks(node);
              touched = true;
            }
          }
        } else if (r.type === 'characterData') {
          touched = true;
        }
      }
      if (touched) this.scheduleRescan();
    });
    this.observeBlocks(document.body);
    this.mutationObs.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  }

  stop(): void {
    this.intersectionObs?.disconnect();
    this.mutationObs?.disconnect();
    this.intersectionObs = null;
    this.mutationObs = null;
    this.started = false;
  }

  rescanAll(): void {
    // Re-emit matches for everything we've already seen. We emit a clear
    // signal first so subscribers can drop stale state.
    for (const fn of this.listeners) fn([]);
    if (!this.index.pattern) return;
    document.querySelectorAll<HTMLElement>('p, li, blockquote, h1, h2, h3, h4, h5, h6, td, dd, article, section, .markdown-body, [class*="content"]')
      .forEach((el) => {
        if (this.intersectionObs) this.intersectionObs.observe(el);
        else this.scanElement(el);
      });
  }

  // Walk the subtree, register block-level elements so IntersectionObserver
  // can decide when to scan them.
  private observeBlocks(root: Element): void {
    if (!this.intersectionObs) return;
    if (this.shouldSkip(root)) return;
    if (isBlock(root)) {
      if (!this.observed.has(root)) {
        this.observed.add(root);
        this.intersectionObs.observe(root);
      }
    }
    const blocks = root.querySelectorAll<HTMLElement>(
      'p, li, blockquote, h1, h2, h3, h4, h5, h6, td, dd, article, section',
    );
    blocks.forEach((b) => {
      if (this.shouldSkip(b)) return;
      if (this.observed.has(b)) return;
      this.observed.add(b);
      this.intersectionObs?.observe(b);
    });
  }

  private scheduleRescan(): void {
    if (this.rescanTimer !== null) return;
    this.rescanTimer = window.setTimeout(() => {
      this.rescanTimer = null;
      this.observeBlocks(document.body);
    }, 250);
  }

  private scanElement(el: Element): void {
    if (!this.index.pattern) return;
    if (this.shouldSkip(el)) return;
    const matches = findMatchesIn(el, this.index);
    if (!matches.length) return;
    for (const fn of this.listeners) fn(matches);
  }

  private shouldSkip(el: Element): boolean {
    if (!(el instanceof Element)) return false;
    if (SKIP_TAGS.has(el.tagName)) return true;
    if ((el as HTMLElement).isContentEditable) return true;
    // Skip our own host
    if (el.id?.startsWith('linguaedge-host-')) return true;
    return false;
  }
}

function isBlock(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  // Heuristic: known block tags + visible text content.
  return /^(P|LI|BLOCKQUOTE|H[1-6]|TD|DD|ARTICLE|SECTION|FIGCAPTION|DIV)$/.test(el.tagName) &&
    !!el.textContent && el.textContent.trim().length > 0;
}

function findMatchesIn(root: Element, index: Index): ScannedMatch[] {
  const out: ScannedMatch[] = [];
  if (!index.pattern) return out;
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
        let p: Node | null = node.parentNode;
        while (p && p instanceof Element) {
          if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
          if (p.id?.startsWith('linguaedge-host-')) return NodeFilter.FILTER_REJECT;
          if (p instanceof HTMLElement && p.classList.contains('linguaedge-mark')) {
            return NodeFilter.FILTER_REJECT;
          }
          p = p.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );
  let node = walker.nextNode() as Text | null;
  while (node) {
    const text = node.textContent ?? '';
    const re = new RegExp(index.pattern.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const surface = m[0];
      const lemma = lemmatize(surface);
      const item = index.byLemma.get(lemma) ?? index.byLemma.get(surface.toLowerCase());
      if (!item) continue;
      try {
        const range = document.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + surface.length);
        out.push({ range, word: surface, lemma: item.lemma, item });
      } catch { /* ignore */ }
    }
    node = walker.nextNode() as Text | null;
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
