import { translateText } from '@/common/translate';
import {
  getByLemma,
  gradeReview,
  getStats,
  saveWord,
  setState,
} from '@/common/vocab-service';
import { lemmatize } from '@/common/lemma';
import { db, getSettings } from '@/common/db';
import { pickDrillCard } from '@/common/drill';
import { uid } from '@/common/uid';
import type { RuntimeMessage, TranslateResponse } from '@/common/types';

const ALARM_REVIEW_REMINDER = 'linguaedge.reviewReminder';

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  }

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'linguaedge.translate',
      title: 'LinguaEdge: Dịch "%s"',
      contexts: ['selection'],
    });
    chrome.contextMenus.create({
      id: 'linguaedge.save',
      title: 'LinguaEdge: Lưu "%s" vào kho từ vựng',
      contexts: ['selection'],
    });
    chrome.contextMenus.create({
      id: 'linguaedge.openDashboard',
      title: 'Mở LinguaEdge Dashboard',
      contexts: ['action'],
    });
  });

  await chrome.alarms.create(ALARM_REVIEW_REMINDER, {
    when: Date.now() + 60 * 1000,
    periodInMinutes: 60,
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === 'linguaedge.openDashboard') {
    openDashboard();
    return;
  }
  if (!info.selectionText) return;
  const action = info.menuItemId === 'linguaedge.save' ? 'SAVE' : 'TRANSLATE';
  chrome.tabs.sendMessage(tab.id, {
    type: 'CONTEXT_ACTION',
    action,
    text: info.selectionText,
  });
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'open-dashboard') {
    openDashboard();
    return;
  }
  if (command === 'translate-selection' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'CONTEXT_ACTION', action: 'TRANSLATE_HOTKEY' });
  }
});

chrome.action.onClicked.addListener(() => {
  // Only fires if no popup defined; we have one, so this is a fallback.
  openDashboard();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_REVIEW_REMINDER) return;
  const settings = await getSettings();
  if (!settings.notificationsEnabled) return;
  const stats = await getStats();
  if (stats.dueToday < 5) return;

  // Throttle to at most once per 6 hours.
  const last = (await chrome.storage.local.get('lastReviewNotif')).lastReviewNotif as
    | number
    | undefined;
  if (last && Date.now() - last < 6 * 60 * 60 * 1000) return;
  await chrome.storage.local.set({ lastReviewNotif: Date.now() });

  chrome.notifications.create('linguaedge.review', {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('public/icons/icon-128.png'),
    title: 'LinguaEdge',
    message: `Bạn có ${stats.dueToday} từ đến hạn ôn tập`,
    priority: 1,
  });
});

chrome.notifications.onClicked.addListener((id) => {
  if (id.startsWith('linguaedge.')) {
    openDashboard('review');
    chrome.notifications.clear(id);
  }
});

chrome.runtime.onMessage.addListener((msg: RuntimeMessage, _sender, sendResponse) => {
  handleMessage(msg)
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, error: String(err) }));
  return true; // keep channel open for async response
});

async function handleMessage(msg: RuntimeMessage): Promise<unknown> {
  switch (msg.type) {
    case 'PING':
      return { ok: true };
    case 'TRANSLATE': {
      const settings = await getSettings();
      const result = await translateText(
        msg.text,
        msg.sourceLang ?? settings.sourceLang,
        msg.targetLang ?? settings.targetLang,
      );
      const lemma = lemmatize(msg.text);
      const existing = await getByLemma(lemma);
      return { ...result, lemma, existing } satisfies TranslateResponse & {
        lemma: string;
        existing?: unknown;
      };
    }
    case 'SAVE_WORD': {
      const item = await saveWord(msg.payload);
      broadcastInvalidate();
      return { ok: true, item };
    }
    case 'GET_WORD_BY_LEMMA': {
      const item = await getByLemma(msg.lemma);
      return { ok: true, item };
    }
    case 'UPDATE_WORD_STATE': {
      await setState(msg.id, msg.state);
      broadcastInvalidate();
      return { ok: true };
    }
    case 'GET_STATS': {
      const stats = await getStats();
      return { ok: true, stats };
    }
    case 'GET_SETTINGS': {
      const settings = await getSettings();
      return { ok: true, settings };
    }
    case 'GET_DRILL_CARD': {
      const card = await pickDrillCard();
      return { ok: true, card };
    }
    case 'GRADE_DRILL': {
      const before = await db.vocabulary.get(msg.id);
      // SM-2 grade: correct → 4 (Good), wrong → 0 (Forgot).
      await gradeReview(msg.id, msg.correct ? 4 : 0);
      if (before) {
        await db.drillEvents.put({
          id: uid(),
          vocabularyId: before.id,
          word: before.word,
          lemma: before.lemma,
          correct: msg.correct,
          outcome: 'answered',
          stateBefore: before.state,
          at: Date.now(),
        });
      }
      broadcastInvalidate();
      return { ok: true };
    }
    case 'GET_HIGHLIGHT_INDEX': {
      // Lightweight projection — only what content script needs to highlight
      // and quiz. Keeps the message payload small.
      const items = await db.vocabulary
        .where('state')
        .anyOf('new', 'learning', 'reviewing')
        .toArray();
      return {
        ok: true,
        items: items.map((v) => ({
          id: v.id,
          word: v.word,
          lemma: v.lemma,
          state: v.state,
          translation: v.meanings[0]?.translation ?? '',
        })),
      };
    }
    case 'SKIP_DRILL': {
      const item = await db.vocabulary.get(msg.id);
      if (item) {
        await db.drillEvents.put({
          id: uid(),
          vocabularyId: item.id,
          word: item.word,
          lemma: item.lemma,
          correct: false,
          outcome: 'skipped',
          stateBefore: item.state,
          at: Date.now(),
        });
      }
      return { ok: true };
    }
    case 'OPEN_DASHBOARD':
      openDashboard(msg.tab);
      return { ok: true };
    default:
      return { ok: false, error: 'unknown_message' };
  }
}

function openDashboard(tab?: string): void {
  const url = chrome.runtime.getURL('dashboard.html') + (tab ? `#${tab}` : '');
  chrome.tabs.create({ url });
}

// Notify all content scripts that the vocabulary index changed so they can
// refresh page highlights / re-encounter dots without polling.
let invalidateCoalesce: number | null = null;
function broadcastInvalidate(): void {
  if (invalidateCoalesce !== null) return;
  invalidateCoalesce = setTimeout(() => {
    invalidateCoalesce = null;
    chrome.tabs.query({}, (tabs) => {
      for (const t of tabs) {
        if (!t.id) continue;
        chrome.tabs.sendMessage(t.id, { type: 'VOCAB_INVALIDATED' }).catch(() => {});
      }
    });
  }, 250) as unknown as number;
}
