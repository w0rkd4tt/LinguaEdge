import { useEffect, useMemo, useState } from 'react';
import { db } from '@/common/db';
import { gradeReview, getDueItems } from '@/common/vocab-service';
import type { SrsGrade } from '@/common/srs';
import type { VocabularyItem } from '@/common/types';
import { uid } from '@/common/uid';

type Mode = 'flashcard' | 'cloze' | 'reverse' | 'mixed';
type RenderMode = 'flashcard' | 'cloze' | 'reverse';

export function ReviewPage() {
  const [mode, setMode] = useState<Mode>('mixed');
  const [queue, setQueue] = useState<VocabularyItem[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState({ correct: 0, incorrect: 0 });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pickedMode, setPickedMode] = useState<RenderMode>('flashcard');

  const startSession = async (m: Mode, limit = 20) => {
    const items = await getDueItems(limit);
    if (!items.length) {
      setQueue([]);
      setDone(true);
      return;
    }
    const id = uid();
    await db.reviewSessions.put({
      id,
      startedAt: Date.now(),
      cardsReviewed: 0,
      correct: 0,
      incorrect: 0,
    });
    setSessionId(id);
    setQueue(items);
    setMode(m);
    setIdx(0);
    setRevealed(false);
    setStats({ correct: 0, incorrect: 0 });
    setDone(false);
    pickModeForCurrent(m, items[0]);
  };

  const pickModeForCurrent = (m: Mode, item: VocabularyItem) => {
    if (m === 'mixed') {
      const hasContext = item.contexts.length > 0;
      const r = Math.random();
      if (r < 0.34) setPickedMode('reverse');
      else if (hasContext && r < 0.67) setPickedMode('cloze');
      else setPickedMode('flashcard');
    } else {
      setPickedMode(m);
    }
  };

  const current = queue && queue[idx];
  useEffect(() => {
    if (current) pickModeForCurrent(mode, current);
  }, [idx, queue, mode]);

  const grade = async (g: SrsGrade) => {
    if (!current) return;
    await gradeReview(current.id, g);
    const correct = g >= 3;
    const next = {
      correct: stats.correct + (correct ? 1 : 0),
      incorrect: stats.incorrect + (correct ? 0 : 1),
    };
    setStats(next);
    if (sessionId) {
      const session = await db.reviewSessions.get(sessionId);
      if (session) {
        session.cardsReviewed++;
        session.correct += correct ? 1 : 0;
        session.incorrect += correct ? 0 : 1;
        await db.reviewSessions.put(session);
      }
    }
    if (queue && idx + 1 >= queue.length) {
      if (sessionId) {
        const session = await db.reviewSessions.get(sessionId);
        if (session) {
          session.endedAt = Date.now();
          await db.reviewSessions.put(session);
        }
      }
      setDone(true);
    } else {
      setIdx(idx + 1);
      setRevealed(false);
    }
  };

  if (queue === null) {
    return <Welcome onStart={startSession} />;
  }
  if (done) {
    return (
      <Summary
        total={queue.length}
        correct={stats.correct}
        incorrect={stats.incorrect}
        onAgain={() => startSession(mode)}
      />
    );
  }
  if (!current) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
        Không có từ nào đến hạn ôn tập. Quay lại sau!
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-slate-600">
          {idx + 1} / {queue.length}
        </div>
        <div className="text-sm">
          <span className="text-green-600 font-medium">✓ {stats.correct}</span>{' '}
          <span className="text-red-600 font-medium ml-2">✗ {stats.incorrect}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-8 min-h-[260px]">
        {pickedMode === 'flashcard' ? (
          <FlashcardView item={current} revealed={revealed} />
        ) : pickedMode === 'reverse' ? (
          <ReverseView
            item={current}
            revealed={revealed}
            onRevealRequest={() => setRevealed(true)}
          />
        ) : (
          <ClozeView item={current} revealed={revealed} />
        )}
      </div>

      <div className="mt-6">
        {!revealed ? (
          <button
            onClick={() => setRevealed(true)}
            className="w-full py-3 rounded-xl bg-brand-500 text-white font-medium hover:bg-brand-600"
          >
            Hiện đáp án (Space)
          </button>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            <GradeButton g={0} label="Quên" hint="<1 ngày" color="bg-red-500" onClick={grade} />
            <GradeButton g={3} label="Khó" hint="ngắn" color="bg-orange-500" onClick={grade} />
            <GradeButton g={4} label="Tốt" hint="vừa" color="bg-blue-500" onClick={grade} />
            <GradeButton g={5} label="Dễ" hint="dài" color="bg-green-500" onClick={grade} />
          </div>
        )}
      </div>

      <div className="mt-3 text-center text-xs text-slate-400">
        Nguồn:{' '}
        {current.contexts[0]?.sourceUrl ? (
          <a
            href={current.contexts[0].sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="hover:underline"
          >
            {current.contexts[0].sourceTitle || current.contexts[0].sourceUrl}
          </a>
        ) : '—'}
      </div>

      <KeyboardShortcuts
        onReveal={() => !revealed && setRevealed(true)}
        onGrade={revealed ? grade : undefined}
      />
    </div>
  );
}

function Welcome({ onStart }: { onStart: (m: Mode, limit?: number) => void }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    getDueItems(500).then((items) => setCount(items.length));
  }, []);
  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 p-8">
      <h2 className="text-2xl font-semibold mb-2">Phiên ôn tập</h2>
      <p className="text-slate-600 mb-6">
        {count === null
          ? 'Đang kiểm tra...'
          : count === 0
            ? 'Hiện không có từ nào đến hạn ôn. Hãy lưu thêm từ trên web nhé!'
            : `Bạn có ${count} từ đến hạn ôn tập.`}
      </p>
      <div className="space-y-3">
        <h3 className="font-medium text-sm text-slate-700">Chọn chế độ</h3>
        <ModeCard
          title="Flashcard"
          desc="Xem từ, tự nhớ nghĩa, lật thẻ. Phù hợp ôn nhanh."
          onClick={() => onStart('flashcard')}
          disabled={!count}
        />
        <ModeCard
          title="Cloze (điền từ)"
          desc="Câu gốc bị che một từ - bạn nhớ lại từ đã học trong ngữ cảnh."
          onClick={() => onStart('cloze')}
          disabled={!count}
        />
        <ModeCard
          title="Reverse (Vi → En)"
          desc="Hiện nghĩa tiếng Việt, gõ lại từ tiếng Anh. Quan trọng cho IELTS / TOEFL writing."
          onClick={() => onStart('reverse')}
          disabled={!count}
        />
        <ModeCard
          title="Mixed"
          desc="Trộn cả ba - thay đổi để đỡ nhàm chán."
          highlight
          onClick={() => onStart('mixed')}
          disabled={!count}
        />
      </div>
    </div>
  );
}

function ModeCard(props: {
  title: string; desc: string; onClick: () => void; disabled?: boolean; highlight?: boolean;
}) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      className={`w-full text-left p-4 rounded-xl border transition-colors ${
        props.disabled
          ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
          : props.highlight
            ? 'border-brand-300 bg-brand-50 hover:bg-brand-100'
            : 'border-slate-200 hover:border-brand-300 hover:bg-brand-50/50'
      }`}
    >
      <div className="font-medium">{props.title}</div>
      <div className="text-sm text-slate-500 mt-0.5">{props.desc}</div>
    </button>
  );
}

function FlashcardView({ item, revealed }: { item: VocabularyItem; revealed: boolean }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-semibold text-slate-900">{item.word}</div>
      {item.pronunciation?.ipa && (
        <div className="text-slate-400 mt-1">{item.pronunciation.ipa}</div>
      )}
      {revealed && (
        <div className="mt-6 space-y-2 border-t border-slate-100 pt-4">
          {item.meanings.map((m, i) => (
            <div key={i} className="text-slate-700">
              {m.partOfSpeech && (
                <span className="text-brand-600 text-xs mr-2">({m.partOfSpeech})</span>
              )}
              {m.translation}
            </div>
          ))}
          {item.contexts[0]?.sentence && (
            <div className="mt-4 text-sm text-slate-500 italic">
              "{item.contexts[0].sentence}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ClozeView({ item, revealed }: { item: VocabularyItem; revealed: boolean }) {
  const ctx = item.contexts[0];
  const sentence = ctx?.sentence ?? '';
  const blanked = useMemo(() => {
    if (!sentence) return '';
    const re = new RegExp(`\\b${item.word}\\b`, 'i');
    return sentence.replace(re, '_____');
  }, [sentence, item.word]);

  if (!ctx) {
    // Fallback to flashcard if no context
    return <FlashcardView item={item} revealed={revealed} />;
  }
  return (
    <div>
      <div className="text-lg leading-relaxed text-slate-800">
        {revealed ? (
          <span>
            {sentence.split(new RegExp(`(\\b${item.word}\\b)`, 'i')).map((part, i) =>
              part.toLowerCase() === item.word.toLowerCase() ? (
                <span key={i} className="bg-amber-100 text-amber-900 px-1 rounded font-semibold">
                  {part}
                </span>
              ) : (
                <span key={i}>{part}</span>
              ),
            )}
          </span>
        ) : (
          blanked
        )}
      </div>
      {revealed && (
        <div className="mt-4 pt-4 border-t border-slate-100 text-slate-700">
          <span className="font-semibold text-slate-900 mr-2">{item.word}</span>
          {item.meanings[0]?.translation}
        </div>
      )}
    </div>
  );
}

function ReverseView({
  item, revealed, onRevealRequest,
}: {
  item: VocabularyItem;
  revealed: boolean;
  onRevealRequest: () => void;
}) {
  const [input, setInput] = useState('');
  const [judged, setJudged] = useState<null | 'exact' | 'close' | 'wrong'>(null);

  // Reset input each time the card changes
  useEffect(() => {
    setInput('');
    setJudged(null);
  }, [item.id]);

  const handleCheck = () => {
    if (!input.trim()) return;
    const normalized = input.trim().toLowerCase();
    const target = item.word.toLowerCase();
    if (normalized === target) {
      setJudged('exact');
    } else if (
      normalized === item.lemma.toLowerCase() ||
      Math.abs(normalized.length - target.length) <= 1 &&
        levenshtein(normalized, target) <= 1
    ) {
      setJudged('close');
    } else {
      setJudged('wrong');
    }
    onRevealRequest();
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleCheck();
    }
  };

  const meaning = item.meanings[0]?.translation ?? '';

  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">
        Nghĩa tiếng Việt
      </div>
      <div className="text-2xl font-medium text-slate-900 mb-1">{meaning}</div>
      {item.meanings[0]?.partOfSpeech && (
        <div className="text-xs text-brand-600 mb-4">
          ({item.meanings[0].partOfSpeech})
        </div>
      )}

      <div className="mt-6 space-y-2">
        <label className="text-sm text-slate-600 block">Gõ từ tiếng Anh:</label>
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          disabled={revealed}
          placeholder="..."
          className={`w-full px-4 py-3 rounded-lg border text-lg font-medium focus:outline-none transition-colors ${
            judged === 'exact'
              ? 'border-green-400 bg-green-50 text-green-800'
              : judged === 'close'
                ? 'border-amber-400 bg-amber-50 text-amber-800'
                : judged === 'wrong'
                  ? 'border-red-400 bg-red-50 text-red-800'
                  : 'border-slate-200 focus:border-brand-500'
          }`}
        />
        {!revealed && (
          <button
            onClick={handleCheck}
            disabled={!input.trim()}
            className="w-full py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50"
          >
            Kiểm tra (Enter)
          </button>
        )}
      </div>

      {revealed && (
        <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
          <div>
            <span className="text-xs text-slate-500 mr-2">Từ đúng:</span>
            <span className="font-semibold text-slate-900">{item.word}</span>
            {item.pronunciation?.ipa && (
              <span className="text-slate-400 ml-2">{item.pronunciation.ipa}</span>
            )}
          </div>
          {item.contexts[0]?.sentence && (
            <div className="text-sm text-slate-600 italic">
              "{item.contexts[0].sentence}"
            </div>
          )}
          {judged === 'exact' && (
            <div className="text-sm text-green-700">✓ Chính xác. Chọn "Tốt" hoặc "Dễ".</div>
          )}
          {judged === 'close' && (
            <div className="text-sm text-amber-700">
              ≈ Gần đúng (sai chính tả nhỏ). Chọn "Tốt" hoặc "Khó".
            </div>
          )}
          {judged === 'wrong' && (
            <div className="text-sm text-red-700">✗ Chưa đúng. Chọn "Quên".</div>
          )}
        </div>
      )}
    </div>
  );
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  for (let i = 0; i <= b.length; i++) prev[i] = i;
  for (let i = 1; i <= a.length; i++) {
    let cur = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = cur;
      cur = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], cur);
      prev[j - 1] = tmp;
    }
    prev[b.length] = cur;
  }
  return prev[b.length];
}

function GradeButton(props: {
  g: SrsGrade; label: string; hint: string; color: string;
  onClick: (g: SrsGrade) => void;
}) {
  return (
    <button
      onClick={() => props.onClick(props.g)}
      className={`py-3 rounded-xl text-white font-medium hover:opacity-90 ${props.color}`}
    >
      <div>{props.label}</div>
      <div className="text-[10px] opacity-80">{props.hint}</div>
    </button>
  );
}

function Summary(props: { total: number; correct: number; incorrect: number; onAgain: () => void }) {
  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 p-8 text-center">
      <h2 className="text-2xl font-semibold mb-2">🎉 Hoàn thành!</h2>
      <p className="text-slate-600 mb-6">
        Bạn đã ôn {props.total} từ — {props.correct} đúng / {props.incorrect} sai
      </p>
      <button
        onClick={props.onAgain}
        className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600"
      >
        Bắt đầu phiên mới
      </button>
    </div>
  );
}

function KeyboardShortcuts(props: {
  onReveal: () => void;
  onGrade?: (g: SrsGrade) => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (props.onGrade) {
          // grade with "Good" by default
          props.onGrade(4);
        } else {
          props.onReveal();
        }
      } else if (props.onGrade) {
        if (e.key === '1') props.onGrade(0);
        if (e.key === '2') props.onGrade(3);
        if (e.key === '3') props.onGrade(4);
        if (e.key === '4') props.onGrade(5);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [props.onReveal, props.onGrade]);
  return null;
}
