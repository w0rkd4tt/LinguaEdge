import css from './styles.css?inline';
import type {
  KnowledgeState,
  Meaning,
  RuntimeMessage,
  TranslateResponse,
  VocabularyItem,
} from '@/common/types';
import { extractSentence, looksLikeTranslatable, looksLikeWord } from '@/common/lemma';

interface TranslateReply extends TranslateResponse {
  lemma: string;
  existing?: VocabularyItem;
}

interface ContextActionMessage {
  type: 'CONTEXT_ACTION';
  action: 'TRANSLATE' | 'SAVE' | 'TRANSLATE_HOTKEY';
  text?: string;
}

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
    this.loadSettings();
  }

  private async loadSettings() {
    try {
      const res = await chrome.storage.local.get('linguaedge_settings_cache');
      const cached = res.linguaedge_settings_cache as Partial<typeof this.settings> | undefined;
      if (cached) Object.assign(this.settings, cached);
    } catch { /* ignore */ }
  }

  private attachEvents() {
    document.addEventListener('keydown', this.onKeyDown, true);
    document.addEventListener('mousedown', this.onMouseDown, true);
    document.addEventListener('scroll', this.dismissAll, true);
    chrome.runtime.onMessage.addListener(this.onRuntimeMessage);
  }

  private onRuntimeMessage = (msg: ContextActionMessage) => {
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
    if (!this.cardEl) return;
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      this.dismissCard();
    } else if ((ev.key === 's' || ev.key === 'S') && !this.isFormElement(ev.target)) {
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

if (!document.getElementById(HOST_ID)) {
  // Avoid running inside extension pages or about: pages
  if (!/^chrome|^edge|^about|^moz-extension/.test(location.protocol)) {
    new LinguaEdgeUI();
  }
}
