import type { DrillCard } from '@/common/drill';
import type { Settings, VocabularyItem } from '@/common/types';

interface DrillSettings {
  drillEnabled: boolean;
  drillIntervalMinutes: number;
  drillMaxPerHour: number;
}

const STORAGE_KEY = 'linguaedge.drill.history';
const ACTIVITY_WINDOW_MS = 30_000; // user must have interacted within 30s

type ToastFn = (msg: string) => void;

// Owns: activity tracking, scheduler, popup rendering.
export class DrillController {
  private root: ShadowRoot;
  private toast: ToastFn;
  private settings: DrillSettings = {
    drillEnabled: true,
    drillIntervalMinutes: 10,
    drillMaxPerHour: 3,
  };
  private lastActivityAt = Date.now();
  private timer: number | null = null;
  private cardEl: HTMLDivElement | null = null;
  private currentCard: DrillCard | null = null;
  private resolveCurrent: ((answered: boolean) => void) | null = null;
  private answered = false;

  constructor(root: ShadowRoot, toast: ToastFn) {
    this.root = root;
    this.toast = toast;
    this.attachActivity();
    this.scheduleNext();
  }

  applySettings(s: Pick<Settings, 'drillEnabled' | 'drillIntervalMinutes' | 'drillMaxPerHour'>) {
    this.settings = {
      drillEnabled: s.drillEnabled,
      drillIntervalMinutes: Math.max(2, s.drillIntervalMinutes),
      drillMaxPerHour: Math.max(1, s.drillMaxPerHour),
    };
    this.scheduleNext();
  }

  /** True if drill popup is currently visible — caller can suppress other UI. */
  isActive(): boolean {
    return !!this.cardEl;
  }

  dismiss(): void {
    // If user closed via Esc / outside-mousedown / settings change before
    // answering, treat as a skip (doesn't grade SRS but is recorded).
    if (this.currentCard && !this.answered) {
      const id = this.currentCard.item.id;
      chrome.runtime.sendMessage({ type: 'SKIP_DRILL', id }).catch(() => {});
    }
    if (this.cardEl) {
      this.cardEl.remove();
      this.cardEl = null;
    }
    if (this.resolveCurrent) {
      this.resolveCurrent(this.answered);
      this.resolveCurrent = null;
    }
    this.currentCard = null;
    this.answered = false;
  }

  private attachActivity() {
    const mark = () => { this.lastActivityAt = Date.now(); };
    document.addEventListener('mousemove', mark, { passive: true });
    document.addEventListener('keydown', mark, { passive: true });
    document.addEventListener('scroll', mark, { passive: true, capture: true });
    document.addEventListener('click', mark, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.lastActivityAt = Date.now();
        this.scheduleNext();
      }
    });
  }

  private scheduleNext() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.settings.drillEnabled) return;
    const intervalMs = this.settings.drillIntervalMinutes * 60_000;
    this.timer = window.setTimeout(() => this.tick(), intervalMs);
  }

  private async tick() {
    this.timer = null;
    if (!this.settings.drillEnabled) return;
    if (document.visibilityState !== 'visible') {
      // Defer until tab is visible again — visibility handler will reschedule.
      return;
    }
    if (Date.now() - this.lastActivityAt > ACTIVITY_WINDOW_MS) {
      // User went idle; reschedule and try again later.
      this.scheduleNext();
      return;
    }
    if (!(await this.allowedByQuota())) {
      this.scheduleNext();
      return;
    }
    if (this.cardEl) {
      this.scheduleNext();
      return;
    }

    const card = await this.requestCard();
    if (!card) {
      this.scheduleNext();
      return;
    }
    await this.recordTrigger();
    await this.show(card);
    this.scheduleNext();
  }

  private async requestCard(): Promise<DrillCard | null> {
    try {
      const reply = (await chrome.runtime.sendMessage({ type: 'GET_DRILL_CARD' })) as {
        ok: boolean; card: DrillCard | null;
      };
      return reply?.ok ? reply.card : null;
    } catch {
      return null;
    }
  }

  private async allowedByQuota(): Promise<boolean> {
    const history = await this.loadHistory();
    const cutoff = Date.now() - 60 * 60_000;
    const recent = history.filter((t) => t > cutoff);
    return recent.length < this.settings.drillMaxPerHour;
  }

  private async recordTrigger() {
    const history = await this.loadHistory();
    history.push(Date.now());
    const cutoff = Date.now() - 24 * 60 * 60_000;
    const trimmed = history.filter((t) => t > cutoff);
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: trimmed });
    } catch { /* ignore */ }
  }

  private async loadHistory(): Promise<number[]> {
    try {
      const res = await chrome.storage.local.get(STORAGE_KEY);
      const v = res[STORAGE_KEY];
      return Array.isArray(v) ? (v as number[]) : [];
    } catch {
      return [];
    }
  }

  private show(card: DrillCard): Promise<boolean> {
    this.currentCard = card;
    return new Promise((resolve) => {
      this.resolveCurrent = resolve;
      this.render();
    });
  }

  private render() {
    if (!this.currentCard) return;
    if (!this.cardEl) {
      this.cardEl = document.createElement('div');
      this.cardEl.className = 'card drill-card';
      this.cardEl.style.pointerEvents = 'auto';
      this.root.appendChild(this.cardEl);
    }
    const card = this.cardEl;
    const data = this.currentCard;
    card.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'row';
    const badge = document.createElement('div');
    badge.className = 'drill-badge';
    badge.textContent = '🎯 Học nhanh 1 từ';
    header.appendChild(badge);

    const sp = document.createElement('div');
    sp.className = 'spacer';
    header.appendChild(sp);

    const skip = document.createElement('button');
    skip.className = 'btn';
    skip.style.fontSize = '11px';
    skip.style.padding = '3px 7px';
    skip.textContent = 'Bỏ qua';
    skip.title = 'Đóng (Esc)';
    skip.addEventListener('click', () => this.handleSkip());
    header.appendChild(skip);
    card.appendChild(header);

    // Word + IPA
    const wordRow = document.createElement('div');
    wordRow.className = 'row drill-word-row';
    const word = document.createElement('div');
    word.className = 'word';
    word.textContent = data.item.word;
    wordRow.appendChild(word);
    if (data.item.pronunciation?.ipa) {
      const ipa = document.createElement('span');
      ipa.className = 'ipa';
      ipa.textContent = data.item.pronunciation.ipa;
      wordRow.appendChild(ipa);
    }
    const speakBtn = document.createElement('button');
    speakBtn.className = 'btn icon';
    speakBtn.style.marginLeft = 'auto';
    speakBtn.textContent = '🔊';
    speakBtn.title = 'Nghe phát âm';
    speakBtn.addEventListener('click', () => this.speak(data.item.word));
    wordRow.appendChild(speakBtn);
    card.appendChild(wordRow);

    // Example sentence with target word highlighted
    const example = document.createElement('div');
    example.className = 'context drill-example';
    example.appendChild(this.highlightedSentence(data.prompt, data.highlightWord));
    card.appendChild(example);

    // Question
    const q = document.createElement('div');
    q.className = 'drill-question';
    q.textContent = 'Nghĩa của từ này là gì?';
    card.appendChild(q);

    // Options
    const grid = document.createElement('div');
    grid.className = 'drill-options';
    for (const opt of data.options) {
      const btn = document.createElement('button');
      btn.className = 'btn drill-option';
      btn.textContent = opt;
      btn.addEventListener('click', () => this.handleAnswer(btn, opt));
      grid.appendChild(btn);
    }
    card.appendChild(grid);

    this.position(card);
  }

  private highlightedSentence(sentence: string, word: string): DocumentFragment {
    const frag = document.createDocumentFragment();
    if (!sentence) {
      frag.appendChild(document.createTextNode(''));
      return frag;
    }
    const re = new RegExp(`(\\b${escapeRegex(word)}\\b|\\b${escapeRegex(word)}s?\\b)`, 'i');
    const parts = sentence.split(re);
    for (const part of parts) {
      if (re.test(part)) {
        const mark = document.createElement('span');
        mark.className = 'drill-highlight';
        mark.textContent = part;
        frag.appendChild(mark);
      } else {
        frag.appendChild(document.createTextNode(part));
      }
    }
    return frag;
  }

  private async handleAnswer(btn: HTMLButtonElement, picked: string) {
    if (!this.currentCard) return;
    this.answered = true;
    const correct = picked === this.currentCard.correct;
    // Disable all options, color picked vs correct
    const options = this.cardEl?.querySelectorAll<HTMLButtonElement>('.drill-option');
    options?.forEach((b) => {
      b.disabled = true;
      const txt = b.textContent ?? '';
      if (txt === this.currentCard!.correct) b.classList.add('drill-option-correct');
      else if (b === btn && !correct) b.classList.add('drill-option-wrong');
    });

    try {
      await chrome.runtime.sendMessage({
        type: 'GRADE_DRILL',
        id: this.currentCard.item.id,
        correct,
      });
    } catch { /* ignore */ }

    // Show feedback row, then auto-close after a short delay.
    const feedback = document.createElement('div');
    feedback.className = correct ? 'drill-feedback ok' : 'drill-feedback bad';
    feedback.textContent = correct
      ? '✓ Chính xác — interval ôn được kéo dài.'
      : '✗ Chưa đúng — sẽ ôn lại sớm hơn.';
    this.cardEl?.appendChild(feedback);

    setTimeout(() => {
      this.dismiss();
    }, correct ? 1400 : 2400);
  }

  private handleSkip() {
    // Skipping doesn't grade SRS. dismiss() handles recording the skip event.
    this.dismiss();
  }

  private speak(text: string) {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.95;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch { /* ignore */ }
  }

  private position(card: HTMLElement) {
    // Bottom-right corner, with margin
    card.style.position = 'fixed';
    card.style.right = '20px';
    card.style.bottom = '20px';
    card.style.left = 'auto';
    card.style.top = 'auto';
    card.style.maxWidth = '380px';
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
