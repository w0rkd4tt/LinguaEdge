import css from './styles.css?inline';
import type {
  KnowledgeState,
  Meaning,
  RuntimeMessage,
  Settings,
  TranslateResponse,
  VocabularyItem,
} from '@/common/types';
import { DEFAULT_SETTINGS } from '@/common/types';
import { extractSentence, looksLikeTranslatable, looksLikeWord } from '@/common/lemma';
import { DrillController } from './drill-controller';
import { PageScanner, type IndexedWord, type ScannedMatch } from './page-scanner';
import { HighlightController } from './highlight-controller';
import { ReencounterController } from './reencounter-controller';

interface TranslateReply extends TranslateResponse {
  lemma: string;
  existing?: VocabularyItem;
}

interface ContextActionMessage {
  type: 'CONTEXT_ACTION';
  action: 'TRANSLATE' | 'SAVE' | 'TRANSLATE_HOTKEY';
  text?: string;
}

interface InvalidateMessage {
  type: 'VOCAB_INVALIDATED';
}

type InboundMessage = ContextActionMessage | InvalidateMessage;

const HOST_ID = 'linguaedge-host-' + Math.random().toString(36).slice(2, 8);

class LinguaEdgeUI {
  private host: HTMLDivElement;
  private root: ShadowRoot;
  private cardEl: HTMLDivElement | null = null;
  private tooltipEl: HTMLDivElement | null = null;
  private toastTimer: number | null = null;
  private hoverTimer: number | null = null;
  private currentSelection: { text: string; rect: DOMRect; sentence: string } | null = null;
  private currentResult: TranslateReply | null = null;
  private settings = {
    hoverEnabled: false,
    hoverDelayMs: 250,
  };
  private drill: DrillController | null = null;
  private scanner: PageScanner | null = null;
  private highlighter: HighlightController | null = null;
  private reencounter: ReencounterController | null = null;
  private quizEl: HTMLDivElement | null = null;

  constructor() {
    this.host = document.createElement('div');
    this.host.id = HOST_ID;
    this.host.style.all = 'initial';
    this.host.style.position = 'fixed';
    this.host.style.top = '0';
    this.host.style.left = '0';
    this.host.style.width = '0';
    this.host.style.height = '0';
    this.host.style.zIndex = '2147483647';
    this.host.style.pointerEvents = 'none';
    this.root = this.host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = css;
    this.root.appendChild(style);
    document.documentElement.appendChild(this.host);

    this.attachEvents();
    this.drill = new DrillController(this.root, (m) => this.toast(m));
    this.highlighter = new HighlightController();
    this.highlighter.attachStyles(document);
    this.scanner = new PageScanner();
    this.reencounter = new ReencounterController((match, _host, anchor) =>
      this.openReencounterQuiz(match, anchor),
    );
    this.scanner.subscribe((matches) => {
      this.highlighter?.accumulate(matches);
      this.reencounter?.apply(matches);
    });
    this.loadSettings();
    this.attachStorageWatch();
    this.refreshIndex();
  }

  private async refreshIndex() {
    if (!this.scanner) return;
    try {
      const reply = (await chrome.runtime.sendMessage({
        type: 'GET_HIGHLIGHT_INDEX',
      })) as { ok: boolean; items: IndexedWord[] };
      if (!reply?.ok) return;
      this.scanner.setIndex(reply.items);
      this.scanner.start();
    } catch { /* ignore */ }
  }

  private async loadSettings() {
    let merged: Settings = { ...DEFAULT_SETTINGS };
    try {
      const res = await chrome.storage.local.get('linguaedge_settings_cache');
      const cached = res.linguaedge_settings_cache as Partial<Settings> | undefined;
      if (cached) merged = { ...merged, ...cached };
    } catch { /* ignore */ }
    // Pull from service worker if local cache empty (covers fresh install / page
    // navigations where the popup hasn't seeded settings yet).
    if (!('drillEnabled' in (merged as object))) {
      try {
        const reply = (await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' })) as {
          ok: boolean; settings: Settings;
        };
        if (reply?.ok) merged = reply.settings;
      } catch { /* ignore */ }
    }
    Object.assign(this.settings, merged);
    this.drill?.applySettings(merged);
    this.highlighter?.setEnabled(merged.highlightEnabled !== false);
    this.reencounter?.setEnabled(merged.reencounterEnabled !== false);
  }

  private attachStorageWatch() {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.linguaedge_settings_cache) return;
      const next = changes.linguaedge_settings_cache.newValue as Settings | undefined;
      if (!next) return;
      Object.assign(this.settings, next);
      this.drill?.applySettings(next);
      this.highlighter?.setEnabled(next.highlightEnabled !== false);
      this.reencounter?.setEnabled(next.reencounterEnabled !== false);
    });
  }

  private attachEvents() {
    document.addEventListener('keydown', this.onKeyDown, true);
    document.addEventListener('mousedown', this.onMouseDown, true);
    document.addEventListener('scroll', this.dismissAll, true);
    chrome.runtime.onMessage.addListener(this.onRuntimeMessage);
  }

  private onRuntimeMessage = (msg: InboundMessage) => {
    if (msg.type === 'VOCAB_INVALIDATED') {
      this.refreshIndex();
      return;
    }
    if (msg.type !== 'CONTEXT_ACTION') return;
    if (msg.action === 'TRANSLATE_HOTKEY' || msg.action === 'TRANSLATE') {
      const sel = window.getSelection();
      const text = (msg.text ?? sel?.toString() ?? '').trim();
      if (!text || !looksLikeTranslatable(text)) return;
      const rect = sel?.rangeCount
        ? sel.getRangeAt(0).getBoundingClientRect()
        : new DOMRect(window.innerWidth / 2, window.innerHeight / 2, 0, 0);
      const sentence = this.extractSurrounding(text);
      this.openCardFor(text, rect, sentence);
    } else if (msg.action === 'SAVE') {
      const sel = window.getSelection();
      const text = (msg.text ?? sel?.toString() ?? '').trim();
      if (!text || !looksLikeWord(text)) return;
      const rect = sel?.rangeCount
        ? sel.getRangeAt(0).getBoundingClientRect()
        : new DOMRect(window.innerWidth / 2, window.innerHeight / 2, 0, 0);
      const sentence = this.extractSurrounding(text);
      this.openCardFor(text, rect, sentence, /* autoSave */ true);
    }
  };

  private extractSurrounding(text: string): string {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return text;
    const range = sel.getRangeAt(0);
    let node: Node | null = range.startContainer;
    while (node && node.nodeType !== Node.ELEMENT_NODE) node = node.parentNode;
    const block = (node as Element | null)?.closest('p, li, blockquote, h1, h2, h3, h4, h5, h6, td, dd, article, section, div');
    const fullText = (block?.textContent ?? '').replace(/\s+/g, ' ').trim();
    return extractSentence(fullText, text) || text;
  }

  private onMouseDown = (ev: MouseEvent) => {
    if (!this.cardEl) return;
    if (this.isInsideHost(ev.target)) return;
    this.dismissCard();
  };

  private onKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') {
      if (this.quizEl) {
        ev.stopPropagation();
        this.quizEl.remove();
        this.quizEl = null;
        return;
      }
      if (this.drill?.isActive()) {
        ev.stopPropagation();
        this.drill.dismiss();
        return;
      }
      if (this.cardEl) {
        ev.stopPropagation();
        this.dismissCard();
      }
      return;
    }
    if (!this.cardEl) return;
    if ((ev.key === 's' || ev.key === 'S') && !this.isFormElement(ev.target)) {
      ev.preventDefault();
      ev.stopPropagation();
      this.saveCurrent();
    }
  };

  private isFormElement(el: EventTarget | null): boolean {
    if (!(el instanceof HTMLElement)) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
  }

  private isInsideHost(target: EventTarget | null): boolean {
    if (!(target instanceof Node)) return false;
    return this.host.contains(target) || this.root.contains(target);
  }

  private async openCardFor(text: string, rect: DOMRect, sentence: string, autoSave = false) {
    this.currentSelection = { text, rect, sentence };
    this.renderCard({ loading: true, text, sentence, rect });
    try {
      const reply = (await chrome.runtime.sendMessage({
        type: 'TRANSLATE',
        text,
      } satisfies RuntimeMessage)) as TranslateReply;
      this.currentResult = reply;
      if (!reply || !reply.ok) {
        this.renderCard({ error: reply?.error ?? 'Lỗi dịch', text, sentence, rect });
        return;
      }
      this.renderCard({ result: reply, text, sentence, rect });
      if (autoSave) await this.saveCurrent();
    } catch (err) {
      this.renderCard({ error: String(err), text, sentence, rect });
    }
  }

  private renderCard(opts: {
    loading?: boolean;
    error?: string;
    result?: TranslateReply;
    text: string;
    sentence: string;
    rect: DOMRect;
  }) {
    if (!this.cardEl) {
      this.cardEl = document.createElement('div');
      this.cardEl.className = 'card';
      this.cardEl.style.pointerEvents = 'auto';
      this.root.appendChild(this.cardEl);
    }
    const card = this.cardEl;
    card.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'row';

    const word = document.createElement('div');
    word.className = 'word';
    const isSingle = looksLikeWord(opts.text) && opts.text.trim().split(/\s+/).length === 1;
    if (isSingle) {
      word.textContent = opts.text;
    } else {
      word.textContent = 'Bản dịch';
      word.style.fontSize = '13px';
      word.style.color = '#64748b';
      word.style.fontWeight = '500';
    }
    header.appendChild(word);

    if (opts.result?.pronunciation?.ipa) {
      const ipa = document.createElement('span');
      ipa.className = 'ipa';
      ipa.textContent = opts.result.pronunciation.ipa;
      header.appendChild(ipa);
    }

    const spacer = document.createElement('div');
    spacer.className = 'spacer';
    header.appendChild(spacer);

    if (opts.result?.existing) {
      header.appendChild(this.renderStatePill(opts.result.existing.state));
    }

    const close = document.createElement('button');
    close.className = 'close-btn';
    close.textContent = '×';
    close.title = 'Đóng (Esc)';
    close.addEventListener('click', () => this.dismissCard());
    header.appendChild(close);

    card.appendChild(header);

    if (opts.loading) {
      const body = document.createElement('div');
      body.className = 'row';
      body.style.marginTop = '8px';
      const sp = document.createElement('span');
      sp.className = 'loading';
      body.appendChild(sp);
      const lbl = document.createElement('span');
      lbl.style.color = '#64748b';
      lbl.textContent = 'Đang dịch…';
      body.appendChild(lbl);
      card.appendChild(body);
    } else if (opts.error) {
      const err = document.createElement('div');
      err.className = 'error';
      err.textContent = opts.error;
      card.appendChild(err);
    } else if (opts.result) {
      this.renderResultBody(card, opts.result, opts.sentence);
    }

    this.positionCard(card, opts.rect);
  }

  private renderResultBody(card: HTMLElement, result: TranslateReply, sentence: string) {
    const isSingleWord = looksLikeWord(result.text) &&
      result.text.trim().split(/\s+/).length === 1;

    if (isSingleWord && result.meanings && result.meanings.length > 1) {
      const list = document.createElement('ul');
      list.className = 'meaning-list';
      for (const m of result.meanings.slice(0, 5)) {
        const li = document.createElement('li');
        if (m.partOfSpeech) {
          const pos = document.createElement('span');
          pos.className = 'pos';
          pos.textContent = m.partOfSpeech;
          li.appendChild(pos);
        }
        const span = document.createElement('span');
        span.textContent = m.translation;
        li.appendChild(span);
        list.appendChild(li);
      }
      card.appendChild(list);
    } else {
      const tr = document.createElement('div');
      tr.className = 'translation';
      tr.textContent = result.translation || result.meanings?.[0]?.translation || '';
      card.appendChild(tr);
    }

    // Only show extracted-sentence chip for short selections; for paragraph
    // translation the source itself is already long, so the chip is redundant.
    if (isSingleWord && sentence && sentence !== result.text) {
      const ctx = document.createElement('div');
      ctx.className = 'context';
      ctx.textContent = sentence;
      card.appendChild(ctx);
    }

    const actions = document.createElement('div');
    actions.className = 'row';
    actions.style.marginTop = '10px';

    if (isSingleWord) {
      const isSaved = !!result.existing;
      const saveBtn = document.createElement('button');
      saveBtn.className = isSaved ? 'btn success' : 'btn primary';
      saveBtn.innerHTML = isSaved ? '✓ Đã lưu' : '💾 Lưu';
      saveBtn.addEventListener('click', () => this.saveCurrent());
      actions.appendChild(saveBtn);
    }

    const speakBtn = document.createElement('button');
    speakBtn.className = 'btn';
    speakBtn.textContent = '🔊';
    speakBtn.title = 'Phát âm bản gốc';
    speakBtn.addEventListener('click', () => this.speak(result.text));
    actions.appendChild(speakBtn);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn';
    copyBtn.textContent = '📋 Copy';
    copyBtn.title = 'Sao chép bản dịch';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard?.writeText(result.translation || '');
      this.toast('Đã copy bản dịch');
    });
    actions.appendChild(copyBtn);

    const sp = document.createElement('span');
    sp.className = 'spacer';
    actions.appendChild(sp);

    if (isSingleWord) {
      const sc = document.createElement('span');
      sc.className = 'shortcut';
      sc.textContent = 'S';
      actions.appendChild(sc);
    }

    card.appendChild(actions);

    if (isSingleWord && result.existing) {
      const stateRow = document.createElement('div');
      stateRow.className = 'row';
      stateRow.style.marginTop = '8px';
      stateRow.style.flexWrap = 'wrap';
      const states: KnowledgeState[] = ['new', 'learning', 'reviewing', 'known', 'ignored'];
      for (const s of states) {
        const btn = document.createElement('button');
        btn.className = 'btn';
        if (result.existing.state === s) btn.classList.add('primary');
        btn.style.fontSize = '11px';
        btn.style.padding = '3px 7px';
        btn.textContent = LinguaEdgeUI.stateLabel(s);
        btn.addEventListener('click', () => this.changeState(s));
        stateRow.appendChild(btn);
      }
      card.appendChild(stateRow);
    }
  }

  private static stateLabel(s: KnowledgeState): string {
    switch (s) {
      case 'new': return '🆕 Mới';
      case 'learning': return '📖 Học';
      case 'reviewing': return '🔁 Ôn';
      case 'known': return '✅ Thuộc';
      case 'ignored': return '🚫 Bỏ qua';
    }
  }

  private renderStatePill(state: KnowledgeState): HTMLElement {
    const pill = document.createElement('span');
    pill.className = `state-pill state-${state}`;
    pill.textContent = LinguaEdgeUI.stateLabel(state);
    return pill;
  }

  private async changeState(state: KnowledgeState) {
    if (!this.currentResult?.existing) return;
    const id = this.currentResult.existing.id;
    await chrome.runtime.sendMessage({
      type: 'UPDATE_WORD_STATE',
      id,
      state,
    } satisfies RuntimeMessage);
    this.currentResult.existing.state = state;
    if (this.currentSelection) {
      this.renderCard({
        result: this.currentResult,
        text: this.currentSelection.text,
        sentence: this.currentSelection.sentence,
        rect: this.currentSelection.rect,
      });
    }
    this.toast('Đã cập nhật trạng thái');
  }

  private async saveCurrent() {
    if (!this.currentResult || !this.currentSelection) return;
    const result = this.currentResult;
    const sel = this.currentSelection;
    const reply = (await chrome.runtime.sendMessage({
      type: 'SAVE_WORD',
      payload: {
        word: sel.text,
        translation:
          result.meanings?.[0]?.translation ?? result.translation ?? '',
        meanings: result.meanings,
        pronunciation: result.pronunciation,
        context: {
          sentence: sel.sentence,
          sourceUrl: window.location.href,
          sourceTitle: document.title,
        },
      },
    } satisfies RuntimeMessage)) as { ok: boolean; item?: VocabularyItem };
    if (reply?.ok && reply.item) {
      this.currentResult.existing = reply.item;
      this.toast('Đã lưu vào kho từ vựng');
      this.renderCard({
        result: this.currentResult,
        text: sel.text,
        sentence: sel.sentence,
        rect: sel.rect,
      });
    }
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

  // ---- Re-encounter mini quiz ----------------------------------------------

  private async openReencounterQuiz(
    match: ScannedMatch,
    anchor: { left: number; top: number },
  ) {
    if (this.quizEl) {
      this.quizEl.remove();
      this.quizEl = null;
    }

    const reply = (await chrome.runtime.sendMessage({ type: 'GET_DRILL_CARD' })) as {
      ok: boolean; card: import('@/common/drill').DrillCard | null;
    };
    // GET_DRILL_CARD bốc ngẫu nhiên — re-encounter cần đúng từ trên page. Dùng
    // distractors của card nếu có, nhưng rebuild prompt từ context trên page.
    const card = reply?.card;

    const el = document.createElement('div');
    el.className = 'card drill-card linguaedge-reenc-quiz';
    el.style.pointerEvents = 'auto';
    this.root.appendChild(el);
    this.quizEl = el;

    const correctTranslation = match.item.translation || card?.correct || '';
    const distractors = card && card.item.lemma === match.lemma
      ? card.options.filter((o) => o !== correctTranslation).slice(0, 3)
      : (card?.options.filter((o) => o !== card.correct).slice(0, 3) ?? []);
    const options = shuffle([correctTranslation, ...distractors]).slice(0, 4);

    // Header
    const header = document.createElement('div');
    header.className = 'row';
    const badge = document.createElement('div');
    badge.className = 'drill-badge';
    badge.textContent = '💡 Đã gặp từ này trước đây';
    header.appendChild(badge);
    const sp = document.createElement('div');
    sp.className = 'spacer';
    header.appendChild(sp);
    const close = document.createElement('button');
    close.className = 'close-btn';
    close.textContent = '×';
    close.title = 'Đóng (Esc)';
    close.addEventListener('click', () => this.dismissReencounter(match.lemma));
    header.appendChild(close);
    el.appendChild(header);

    // Word + IPA + speak
    const wordRow = document.createElement('div');
    wordRow.className = 'row drill-word-row';
    const word = document.createElement('div');
    word.className = 'word';
    word.textContent = match.item.word;
    wordRow.appendChild(word);
    const speakBtn = document.createElement('button');
    speakBtn.className = 'btn icon';
    speakBtn.style.marginLeft = 'auto';
    speakBtn.textContent = '🔊';
    speakBtn.title = 'Nghe phát âm';
    speakBtn.addEventListener('click', () => this.speak(match.item.word));
    wordRow.appendChild(speakBtn);
    el.appendChild(wordRow);

    // Show the actual sentence on the page (extracted from surrounding block).
    const sentence = sentenceFor(match);
    if (sentence) {
      const ctx = document.createElement('div');
      ctx.className = 'context drill-example';
      ctx.appendChild(highlightedSentence(sentence, match.word));
      el.appendChild(ctx);
    }

    const q = document.createElement('div');
    q.className = 'drill-question';
    q.textContent = 'Nghĩa của từ này là gì?';
    el.appendChild(q);

    const grid = document.createElement('div');
    grid.className = 'drill-options';
    if (options.length < 2) {
      // Not enough vocab to make a quiz — just reveal meaning.
      const reveal = document.createElement('div');
      reveal.className = 'translation';
      reveal.textContent = correctTranslation || '(không có nghĩa)';
      el.appendChild(reveal);
    } else {
      for (const opt of options) {
        const btn = document.createElement('button');
        btn.className = 'btn drill-option';
        btn.textContent = opt;
        btn.addEventListener('click', () =>
          this.handleReencounterAnswer(match, btn, opt, correctTranslation));
        grid.appendChild(btn);
      }
      el.appendChild(grid);
    }

    this.positionQuiz(el, anchor);
  }

  private async handleReencounterAnswer(
    match: ScannedMatch,
    btn: HTMLButtonElement,
    picked: string,
    correctTranslation: string,
  ) {
    if (!this.quizEl) return;
    const correct = picked === correctTranslation;
    const opts = this.quizEl.querySelectorAll<HTMLButtonElement>('.drill-option');
    opts.forEach((b) => {
      b.disabled = true;
      const txt = b.textContent ?? '';
      if (txt === correctTranslation) b.classList.add('drill-option-correct');
      else if (b === btn && !correct) b.classList.add('drill-option-wrong');
    });
    try {
      await chrome.runtime.sendMessage({
        type: 'GRADE_DRILL',
        id: match.item.id,
        correct,
      });
    } catch { /* ignore */ }
    const fb = document.createElement('div');
    fb.className = correct ? 'drill-feedback ok' : 'drill-feedback bad';
    fb.textContent = correct
      ? '✓ Chính xác — interval ôn được kéo dài.'
      : '✗ Chưa đúng — sẽ ôn lại sớm hơn.';
    this.quizEl.appendChild(fb);
    setTimeout(() => this.dismissReencounter(match.lemma), correct ? 1400 : 2400);
  }

  private dismissReencounter(lemma: string) {
    if (this.quizEl) {
      this.quizEl.remove();
      this.quizEl = null;
    }
    this.reencounter?.markCooldown(lemma);
  }

  private positionQuiz(el: HTMLElement, anchor: { left: number; top: number }) {
    el.style.position = 'fixed';
    el.style.maxWidth = '380px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    // Initial paint to measure
    el.style.visibility = 'hidden';
    el.style.left = '0px';
    el.style.top = '0px';
    const w = el.offsetWidth || 360;
    const h = el.offsetHeight || 200;
    const margin = 12;
    let left = anchor.left - w / 2;
    if (left < margin) left = margin;
    if (left + w > window.innerWidth - margin) left = window.innerWidth - margin - w;
    let top = anchor.top + 8;
    if (top + h > window.innerHeight - margin) {
      top = anchor.top - 8 - h;
      if (top < margin) top = margin;
    }
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
    el.style.visibility = 'visible';
  }

  private positionCard(card: HTMLElement, rect: DOMRect) {
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Render once to measure
    card.style.visibility = 'hidden';
    card.style.left = '0px';
    card.style.top = '0px';
    const cw = card.offsetWidth || 320;
    const ch = card.offsetHeight || 120;

    let left = rect.left + rect.width / 2 - cw / 2;
    if (left < margin) left = margin;
    if (left + cw > vw - margin) left = vw - margin - cw;

    let top = rect.bottom + margin;
    if (top + ch > vh - margin) {
      top = rect.top - margin - ch;
      if (top < margin) top = margin;
    }

    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
    card.style.visibility = 'visible';
  }

  private dismissCard = () => {
    if (this.cardEl) {
      this.cardEl.remove();
      this.cardEl = null;
    }
    this.currentResult = null;
    this.currentSelection = null;
  };

  private dismissAll = () => {
    if (this.tooltipEl) {
      this.tooltipEl.remove();
      this.tooltipEl = null;
    }
  };

  private toast(message: string) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = message;
    this.root.appendChild(t);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      t.remove();
      this.toastTimer = null;
    }, 1800);
  }
}

function shuffle<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sentenceFor(match: ScannedMatch): string {
  // Walk up to nearest block parent and extract the sentence containing the
  // matched range.
  let node: Node | null = match.range.startContainer;
  while (node && node.nodeType !== Node.ELEMENT_NODE) node = node.parentNode;
  const block = (node as Element | null)?.closest(
    'p, li, blockquote, h1, h2, h3, h4, h5, h6, td, dd, article, section, div',
  );
  const fullText = (block?.textContent ?? '').replace(/\s+/g, ' ').trim();
  return extractSentence(fullText, match.word) || match.word;
}

function highlightedSentence(sentence: string, word: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  if (!sentence) return frag;
  const re = new RegExp(`(\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b)`, 'i');
  const parts = sentence.split(re);
  for (const part of parts) {
    if (re.test(part)) {
      const m = document.createElement('span');
      m.className = 'drill-highlight';
      m.textContent = part;
      frag.appendChild(m);
    } else {
      frag.appendChild(document.createTextNode(part));
    }
  }
  return frag;
}

if (!document.getElementById(HOST_ID)) {
  // Avoid running inside extension pages or about: pages
  if (!/^chrome|^edge|^about|^moz-extension/.test(location.protocol)) {
    new LinguaEdgeUI();
  }
}
