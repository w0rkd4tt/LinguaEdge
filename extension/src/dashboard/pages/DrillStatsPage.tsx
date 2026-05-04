import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/common/db';
import type { DrillEvent, KnowledgeState } from '@/common/types';
import { STATE_LABELS } from '../components/StatePill';

const DAY_MS = 24 * 60 * 60 * 1000;
type Range = 7 | 14 | 30 | 90;

export function DrillStatsPage() {
  const [range, setRange] = useState<Range>(14);
  const events = useLiveQuery(
    () => db.drillEvents.orderBy('at').reverse().toArray(),
    [],
  );

  if (events === undefined) {
    return <div className="text-slate-500">Đang tải...</div>;
  }

  const now = Date.now();
  const cutoff = startOfDay(now) - (range - 1) * DAY_MS;
  const inRange = events.filter((e) => e.at >= cutoff);

  if (events.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <div className="text-3xl mb-3">🎯</div>
        <h3 className="font-semibold text-lg mb-2">Chưa có drill nào</h3>
        <p className="text-slate-500 text-sm max-w-md mx-auto">
          Drill sẽ tự bật khi bạn đang đọc web — popup nhỏ ở góc dưới-phải hỏi nghĩa của 1 từ
          ngẫu nhiên kèm câu ví dụ. Đảm bảo Drill đang bật trong Settings và bạn đã lưu vài từ.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Drill stats</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Theo dõi popup học nhanh khi đọc web. Trả lời đúng → SRS Tốt; sai → SRS Quên.
          </p>
        </div>
        <div className="flex gap-1 bg-white rounded-lg border border-slate-200 p-1">
          {([7, 14, 30, 90] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                range === r
                  ? 'bg-brand-50 text-brand-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </header>

      <SummaryCards events={inRange} allEvents={events} />
      <DailyChart events={inRange} range={range} now={now} />
      <div className="grid lg:grid-cols-2 gap-6">
        <TopMissed events={events} />
        <StateDistribution events={inRange} />
      </div>
      <RecentList events={events.slice(0, 50)} />
    </div>
  );
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function SummaryCards({
  events, allEvents,
}: { events: DrillEvent[]; allEvents: DrillEvent[] }) {
  const answered = events.filter((e) => e.outcome === 'answered');
  const correct = answered.filter((e) => e.correct).length;
  const skipped = events.filter((e) => e.outcome === 'skipped').length;
  const accuracy = answered.length ? (correct / answered.length) * 100 : 0;
  const uniqueWords = new Set(answered.map((e) => e.lemma)).size;
  const drillStreak = computeDrillStreak(allEvents);

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Card label="Tổng drill" value={events.length} />
      <Card label="Đã trả lời" value={answered.length} />
      <Card
        label="Accuracy"
        value={`${accuracy.toFixed(0)}%`}
        accent={accuracy >= 70 ? 'text-green-600' : accuracy >= 50 ? 'text-amber-600' : 'text-red-600'}
      />
      <Card label="Bỏ qua" value={skipped} accent="text-slate-500" />
      <Card label="Streak (ngày)" value={drillStreak} accent="text-brand-600" />
      <Card label="Từ duy nhất đã drill" value={uniqueWords} />
    </div>
  );
}

function Card(props: {
  label: string; value: string | number; accent?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className={`text-xl font-semibold ${props.accent ?? ''}`}>{props.value}</div>
      <div className="text-xs text-slate-500 mt-1">{props.label}</div>
    </div>
  );
}

function computeDrillStreak(events: DrillEvent[]): number {
  if (!events.length) return 0;
  const days = new Set<number>();
  for (const e of events) {
    if (e.outcome !== 'answered') continue;
    days.add(startOfDay(e.at));
  }
  if (!days.size) return 0;
  let streak = 0;
  let cursor = startOfDay(Date.now());
  while (days.has(cursor)) {
    streak++;
    cursor -= DAY_MS;
  }
  return streak;
}

function DailyChart({
  events, range, now,
}: { events: DrillEvent[]; range: number; now: number }) {
  const bins = useMemo(() => {
    const start = startOfDay(now) - (range - 1) * DAY_MS;
    const buckets: Array<{ date: number; correct: number; wrong: number; skipped: number }> =
      [];
    for (let i = 0; i < range; i++) {
      buckets.push({
        date: start + i * DAY_MS,
        correct: 0,
        wrong: 0,
        skipped: 0,
      });
    }
    for (const e of events) {
      const day = startOfDay(e.at);
      const idx = Math.round((day - start) / DAY_MS);
      if (idx < 0 || idx >= buckets.length) continue;
      if (e.outcome === 'skipped') buckets[idx].skipped++;
      else if (e.correct) buckets[idx].correct++;
      else buckets[idx].wrong++;
    }
    return buckets;
  }, [events, range, now]);

  const max = Math.max(1, ...bins.map((b) => b.correct + b.wrong + b.skipped));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Hoạt động {range} ngày gần nhất</h3>
        <Legend />
      </div>
      <div className="flex items-end gap-1 h-40">
        {bins.map((b, i) => {
          const total = b.correct + b.wrong + b.skipped;
          const h = (total / max) * 100;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col-reverse h-full justify-start group relative"
              style={{ minWidth: 0 }}
              title={`${formatShortDate(b.date)} · ✓${b.correct} ✗${b.wrong} ⊘${b.skipped}`}
            >
              <div className="flex flex-col-reverse" style={{ height: `${h}%` }}>
                {b.correct > 0 && (
                  <div
                    className="bg-green-500 rounded-t-sm"
                    style={{ height: `${(b.correct / total) * 100}%` }}
                  />
                )}
                {b.wrong > 0 && (
                  <div
                    className="bg-red-400"
                    style={{ height: `${(b.wrong / total) * 100}%` }}
                  />
                )}
                {b.skipped > 0 && (
                  <div
                    className="bg-slate-300 rounded-b-sm"
                    style={{ height: `${(b.skipped / total) * 100}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
        <span>{formatShortDate(bins[0]?.date)}</span>
        <span>{formatShortDate(bins[Math.floor(bins.length / 2)]?.date)}</span>
        <span>{formatShortDate(bins[bins.length - 1]?.date)}</span>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-xs text-slate-600">
      <span className="flex items-center gap-1">
        <span className="w-2.5 h-2.5 rounded-sm bg-green-500" /> Đúng
      </span>
      <span className="flex items-center gap-1">
        <span className="w-2.5 h-2.5 rounded-sm bg-red-400" /> Sai
      </span>
      <span className="flex items-center gap-1">
        <span className="w-2.5 h-2.5 rounded-sm bg-slate-300" /> Bỏ qua
      </span>
    </div>
  );
}

function formatShortDate(ts: number | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

interface MissedRow {
  word: string;
  lemma: string;
  total: number;
  wrong: number;
  accuracy: number;
}

function TopMissed({ events }: { events: DrillEvent[] }) {
  const rows = useMemo(() => {
    const map = new Map<string, MissedRow>();
    for (const e of events) {
      if (e.outcome !== 'answered') continue;
      const cur = map.get(e.lemma) ?? {
        word: e.word,
        lemma: e.lemma,
        total: 0,
        wrong: 0,
        accuracy: 0,
      };
      cur.total++;
      if (!e.correct) cur.wrong++;
      map.set(e.lemma, cur);
    }
    const arr = Array.from(map.values()).map((r) => ({
      ...r,
      accuracy: r.total ? ((r.total - r.wrong) / r.total) * 100 : 0,
    }));
    return arr
      .filter((r) => r.total >= 2 && r.wrong > 0)
      .sort((a, b) => b.wrong - a.wrong || a.accuracy - b.accuracy)
      .slice(0, 10);
  }, [events]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="font-semibold">Top từ hay sai</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Các từ trả lời sai từ 2 lần trở lên — nên ôn thủ công thêm.
        </p>
      </div>
      {rows.length ? (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Từ</th>
              <th className="px-4 py-2 text-right">Sai / Tổng</th>
              <th className="px-4 py-2 text-right">Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.lemma} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{r.word}</td>
                <td className="px-4 py-2 text-right text-slate-600">
                  <span className="text-red-600 font-medium">{r.wrong}</span> / {r.total}
                </td>
                <td className="px-4 py-2 text-right">
                  <span className={r.accuracy >= 50 ? 'text-amber-600' : 'text-red-600'}>
                    {r.accuracy.toFixed(0)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="px-4 py-8 text-center text-sm text-slate-400">
          Chưa có từ nào sai ≥ 2 lần. 🎉
        </div>
      )}
    </div>
  );
}

function StateDistribution({ events }: { events: DrillEvent[] }) {
  const counts = useMemo(() => {
    const c: Record<KnowledgeState, { answered: number; correct: number }> = {
      new: { answered: 0, correct: 0 },
      learning: { answered: 0, correct: 0 },
      reviewing: { answered: 0, correct: 0 },
      known: { answered: 0, correct: 0 },
      ignored: { answered: 0, correct: 0 },
    };
    for (const e of events) {
      if (e.outcome !== 'answered') continue;
      c[e.stateBefore].answered++;
      if (e.correct) c[e.stateBefore].correct++;
    }
    return c;
  }, [events]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold mb-1">Drill theo trạng thái từ</h3>
      <p className="text-xs text-slate-500 mb-3">
        Trạng thái <em>trước khi</em> drill — cho biết drill đang giúp dịch chuyển từ Mới → Học
        → Ôn ra sao.
      </p>
      <div className="space-y-2">
        {(['new', 'learning', 'reviewing', 'known'] as const).map((s) => {
          const { answered, correct } = counts[s];
          const acc = answered ? (correct / answered) * 100 : 0;
          const max = Math.max(1, ...Object.values(counts).map((c) => c.answered));
          const w = (answered / max) * 100;
          const color = {
            new: 'bg-amber-400',
            learning: 'bg-orange-400',
            reviewing: 'bg-blue-400',
            known: 'bg-green-500',
          }[s];
          return (
            <div key={s}>
              <div className="flex justify-between text-xs text-slate-600 mb-0.5">
                <span>{STATE_LABELS[s]}</span>
                <span>
                  {answered}{' '}
                  {answered > 0 && (
                    <span className="text-slate-400">· {acc.toFixed(0)}%</span>
                  )}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${w}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecentList({ events }: { events: DrillEvent[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="font-semibold">50 drill gần nhất</h3>
      </div>
      <ul className="divide-y divide-slate-100">
        {events.map((e) => (
          <li key={e.id} className="px-4 py-2 flex items-center gap-3 text-sm">
            <span className="w-6 text-center">
              {e.outcome === 'skipped' ? '⊘' : e.correct ? '✓' : '✗'}
            </span>
            <span className="font-medium text-slate-800 min-w-[120px]">{e.word}</span>
            <span className="text-xs text-slate-500">{STATE_LABELS[e.stateBefore]}</span>
            <span className="flex-1" />
            <span className="text-xs text-slate-400">{relativeTime(e.at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'vừa xong';
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)} phút trước`;
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / (60 * 60_000))} giờ trước`;
  return new Date(ts).toLocaleDateString('vi-VN');
}
