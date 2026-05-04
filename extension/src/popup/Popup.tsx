import { useEffect, useState } from 'react';
import type { Settings, StatsResponse } from '@/common/types';
import { getSettings, setSetting } from '@/common/db';

export function Popup() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    (async () => {
      const s = await getSettings();
      setSettings(s);
      const reply = (await chrome.runtime.sendMessage({ type: 'GET_STATS' })) as {
        ok: boolean;
        stats: StatsResponse;
      };
      if (reply?.ok) setStats(reply.stats);
    })();
  }, []);

  const update = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    if (!settings) return;
    const next = { ...settings, [key]: value };
    setSettings(next);
    await setSetting(key, value);
    chrome.storage.local.set({ linguaedge_settings_cache: next });
  };

  const open = (tab?: string) => {
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD', tab });
    window.close();
  };

  return (
    <div className="w-[320px] bg-white p-4 text-slate-800">
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-500 text-white flex items-center justify-center font-bold">
            L
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">LinguaEdge</div>
            <div className="text-[11px] text-slate-500">Đọc → Dịch → Lưu → Ôn</div>
          </div>
        </div>
        <button
          className="text-xs text-brand-600 hover:underline"
          onClick={() => open()}
        >
          Mở dashboard
        </button>
      </header>

      {stats && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Stat label="Tổng từ" value={stats.total} />
          <Stat label="Đến hạn" value={stats.dueToday} highlight={stats.dueToday > 0} />
          <Stat label="Streak" value={`${stats.streakDays}d`} />
        </div>
      )}

      {stats && stats.dueToday > 0 && (
        <button
          onClick={() => open('review')}
          className="w-full mb-3 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600"
        >
          Ôn {stats.dueToday} từ ngay
        </button>
      )}

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3 text-xs text-slate-600 leading-relaxed">
        Bôi đen từ / cụm / đoạn rồi bấm{' '}
        <kbd className="border rounded px-1 bg-white">⌥ T</kbd> để dịch.
        Khi popup mở: <kbd className="border rounded px-1 bg-white">S</kbd> lưu từ ·{' '}
        <kbd className="border rounded px-1 bg-white">Esc</kbd> đóng.
      </div>

      <div className="space-y-2 mb-3">
        <Toggle
          label="Tô màu từ đã lưu trên web"
          checked={settings?.highlightEnabled ?? true}
          onChange={(v) => update('highlightEnabled', v)}
        />
        <Toggle
          label="Re-encounter mini quiz"
          checked={settings?.reencounterEnabled ?? true}
          onChange={(v) => update('reencounterEnabled', v)}
        />
        <Toggle
          label="Drill khi đọc web"
          checked={settings?.drillEnabled ?? true}
          onChange={(v) => update('drillEnabled', v)}
        />
        <Toggle
          label="Tự động auto-deck theo trang"
          checked={settings?.autoDeckEnabled ?? true}
          onChange={(v) => update('autoDeckEnabled', v)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <button
          className="py-2 rounded-lg border border-slate-200 hover:bg-slate-50"
          onClick={() => open('vocab')}
        >
          📚 Kho từ
        </button>
        <button
          className="py-2 rounded-lg border border-slate-200 hover:bg-slate-50"
          onClick={() => open('settings')}
        >
          ⚙️ Cài đặt
        </button>
      </div>

      <div className="mt-3 text-[10px] text-slate-400 text-center">
        Phím tắt: <kbd className="border rounded px-1">⌥ T</kbd> dịch ·{' '}
        <kbd className="border rounded px-1">⌥ ⇧ D</kbd> dashboard
      </div>
    </div>
  );
}

function Stat(props: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div
      className={`rounded-lg p-2 text-center ${
        props.highlight
          ? 'bg-brand-50 text-brand-700 border border-brand-200'
          : 'bg-slate-50 border border-slate-200'
      }`}
    >
      <div className="text-base font-semibold leading-tight">{props.value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{props.label}</div>
    </div>
  );
}

function Toggle(props: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer text-sm">
      <span>{props.label}</span>
      <span
        role="switch"
        aria-checked={props.checked}
        onClick={() => props.onChange(!props.checked)}
        className={`w-9 h-5 rounded-full transition-colors relative ${
          props.checked ? 'bg-brand-500' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
            props.checked ? 'translate-x-4' : ''
          }`}
        />
      </span>
    </label>
  );
}
