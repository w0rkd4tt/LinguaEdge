import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/common/db';
import { getStats } from '@/common/vocab-service';
import type { StatsResponse } from '@/common/types';

const DAY_MS = 24 * 60 * 60 * 1000;

export function StatsPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const sessions = useLiveQuery(() => db.reviewSessions.toArray(), []);
  const items = useLiveQuery(() => db.vocabulary.toArray(), []);

  useEffect(() => {
    getStats().then(setStats);
  }, [sessions, items]);

  const heatmap = useHeatmap(items, sessions);

  if (!stats) return <div className="text-slate-500">Đang tải...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card label="Tổng từ" value={stats.total} />
        <Card label="Đến hạn ôn" value={stats.dueToday} highlight={stats.dueToday > 0} />
        <Card label="Đã ôn hôm nay" value={stats.reviewedToday} />
        <Card label="Streak" value={`${stats.streakDays} ngày`} />
        <Card
          label="Đã thuộc"
          value={stats.byState.known}
          accent="text-green-600"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold mb-3">Phân bố trạng thái</h3>
        <div className="space-y-2">
          {(['new', 'learning', 'reviewing', 'known', 'ignored'] as const).map((s) => {
            const n = stats.byState[s];
            const pct = stats.total ? (n / stats.total) * 100 : 0;
            const color = {
              new: 'bg-amber-400',
              learning: 'bg-orange-400',
              reviewing: 'bg-blue-400',
              known: 'bg-green-500',
              ignored: 'bg-slate-300',
            }[s];
            return (
              <div key={s}>
                <div className="flex justify-between text-xs text-slate-600 mb-0.5">
                  <span className="capitalize">{s}</span>
                  <span>{n} ({pct.toFixed(0)}%)</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold mb-3">Hoạt động 16 tuần gần nhất</h3>
        <Heatmap data={heatmap} />
      </div>
    </div>
  );
}

function Card(props: {
  label: string; value: string | number; highlight?: boolean; accent?: string;
}) {
  return (
    <div className={`rounded-xl border p-3 ${
      props.highlight
        ? 'border-brand-200 bg-brand-50'
        : 'border-slate-200 bg-white'
    }`}>
      <div className={`text-xl font-semibold ${props.accent ?? ''}`}>{props.value}</div>
      <div className="text-xs text-slate-500 mt-1">{props.label}</div>
    </div>
  );
}

interface HeatmapDay { date: number; count: number }

function useHeatmap(
  items: { createdAt: number }[] | undefined,
  sessions: { startedAt: number; cardsReviewed: number }[] | undefined,
): HeatmapDay[] {
  const days = 16 * 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = today.getTime() - (days - 1) * DAY_MS;
  const buckets: Record<number, number> = {};
  for (let i = 0; i < days; i++) buckets[start + i * DAY_MS] = 0;

  if (items) {
    for (const it of items) {
      const t = new Date(it.createdAt);
      t.setHours(0, 0, 0, 0);
      if (t.getTime() >= start) buckets[t.getTime()] = (buckets[t.getTime()] ?? 0) + 1;
    }
  }
  if (sessions) {
    for (const s of sessions) {
      const t = new Date(s.startedAt);
      t.setHours(0, 0, 0, 0);
      if (t.getTime() >= start) {
        buckets[t.getTime()] = (buckets[t.getTime()] ?? 0) + s.cardsReviewed;
      }
    }
  }
  return Object.entries(buckets)
    .map(([d, c]) => ({ date: Number(d), count: c }))
    .sort((a, b) => a.date - b.date);
}

function Heatmap({ data }: { data: HeatmapDay[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const intensity = (n: number) => {
    if (n === 0) return 'bg-slate-100';
    const ratio = n / max;
    if (ratio < 0.25) return 'bg-brand-200';
    if (ratio < 0.5) return 'bg-brand-300';
    if (ratio < 0.75) return 'bg-brand-400';
    return 'bg-brand-600';
  };
  // Column = week, row = day-of-week (Mon..Sun)
  const cols: HeatmapDay[][] = [];
  let week: HeatmapDay[] = [];
  for (const d of data) {
    week.push(d);
    if (week.length === 7) {
      cols.push(week);
      week = [];
    }
  }
  if (week.length) cols.push(week);

  return (
    <div className="flex gap-1">
      {cols.map((w, i) => (
        <div key={i} className="flex flex-col gap-1">
          {w.map((d) => (
            <div
              key={d.date}
              className={`w-3 h-3 rounded-sm ${intensity(d.count)}`}
              title={`${new Date(d.date).toLocaleDateString('vi-VN')}: ${d.count}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
