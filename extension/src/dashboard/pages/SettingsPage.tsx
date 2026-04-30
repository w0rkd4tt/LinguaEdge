import { useEffect, useState } from 'react';
import { db, getSettings, setSetting } from '@/common/db';
import type { Settings } from '@/common/types';
import { exportAll, toCsv } from '@/common/vocab-service';

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const update = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    if (!settings) return;
    const next = { ...settings, [key]: value };
    setSettings(next);
    await setSetting(key, value);
    chrome.storage.local.set({ linguaedge_settings_cache: next });
  };

  const handleExportJson = async () => {
    setBusy(true);
    try {
      const data = await exportAll();
      downloadFile(
        `linguaedge-${formatDate()}.json`,
        JSON.stringify(data, null, 2),
        'application/json',
      );
      setMessage(`Đã xuất ${data.vocabulary.length} từ.`);
    } finally {
      setBusy(false);
    }
  };

  const handleExportCsv = async () => {
    setBusy(true);
    try {
      const data = await exportAll();
      downloadFile(`linguaedge-${formatDate()}.csv`, toCsv(data.vocabulary), 'text/csv');
      setMessage(`Đã xuất CSV ${data.vocabulary.length} từ.`);
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data.vocabulary)) {
        throw new Error('File JSON không hợp lệ');
      }
      await db.transaction('rw', db.vocabulary, db.decks, async () => {
        if (Array.isArray(data.decks)) await db.decks.bulkPut(data.decks);
        await db.vocabulary.bulkPut(data.vocabulary);
      });
      setMessage(`Đã nhập ${data.vocabulary.length} từ.`);
    } catch (e) {
      setMessage('Lỗi nhập file: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleResetAll = async () => {
    if (!confirm('Xóa toàn bộ kho từ vựng? Hành động này không thể hoàn tác.')) return;
    if (!confirm('Bạn chắc chắn chứ?')) return;
    await db.transaction('rw', db.vocabulary, db.decks, db.reviewSessions, async () => {
      await db.vocabulary.clear();
      await db.decks.clear();
      await db.reviewSessions.clear();
    });
    setMessage('Đã xóa toàn bộ dữ liệu.');
  };

  if (!settings) return <div className="text-slate-500">Đang tải...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <Section title="Trải nghiệm dịch">
        <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
          Bôi đen từ / cụm / đoạn văn rồi bấm{' '}
          <kbd className="border rounded px-1 bg-white">⌥ T</kbd> (macOS) /{' '}
          <kbd className="border rounded px-1 bg-white">Alt+T</kbd> (Windows) để dịch.
          LinguaEdge không tự bật popup khi bạn chỉ bôi đen — nhờ đó bạn không bị làm phiền khi
          copy / highlight văn bản.
        </div>
        <Field label="Ngôn ngữ đích">
          <select
            value={settings.targetLang}
            onChange={(e) => update('targetLang', e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="zh-CN">中文 (giản thể)</option>
            <option value="ko">한국어</option>
          </select>
        </Field>
        <Field label="Trình độ tiếng Anh hiện tại">
          <select
            value={settings.level}
            onChange={(e) => update('level', e.target.value as Settings['level'])}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
          >
            {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Ôn tập">
        <Toggle
          label="Nhắc ôn tập"
          desc="Nhận thông báo khi có từ đến hạn ôn (kiểm tra mỗi giờ, tối đa 1 lần / 6 giờ)."
          checked={settings.notificationsEnabled}
          onChange={(v) => update('notificationsEnabled', v)}
        />
        <Field label="Số từ mới mỗi ngày">
          <input
            type="number" min={1} max={100}
            value={settings.dailyNewLimit}
            onChange={(e) => update('dailyNewLimit', Number(e.target.value))}
            className="w-24 px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
        </Field>
        <Field label="Giới hạn ôn mỗi ngày">
          <input
            type="number" min={1} max={500}
            value={settings.dailyReviewLimit}
            onChange={(e) => update('dailyReviewLimit', Number(e.target.value))}
            className="w-24 px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
        </Field>
      </Section>

      <Section title="Tổ chức">
        <Toggle
          label="Tự động tạo deck theo trang"
          desc="Khi lưu từ trên một domain mới, tự tạo deck riêng cho domain đó."
          checked={settings.autoDeckEnabled}
          onChange={(v) => update('autoDeckEnabled', v)}
        />
      </Section>

      <Section title="Dữ liệu">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportJson}
            disabled={busy}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            ⬇ Xuất JSON
          </button>
          <button
            onClick={handleExportCsv}
            disabled={busy}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            ⬇ Xuất CSV (mở được trong Excel/Anki)
          </button>
          <label className="px-3 py-2 rounded-lg border border-slate-200 text-sm hover:bg-slate-50 cursor-pointer">
            ⬆ Nhập JSON
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
            />
          </label>
          <button
            onClick={handleResetAll}
            className="px-3 py-2 rounded-lg border border-red-200 text-sm text-red-700 hover:bg-red-50"
          >
            🗑 Xóa toàn bộ dữ liệu
          </button>
        </div>
        {message && <div className="mt-2 text-sm text-slate-600">{message}</div>}
        <p className="mt-3 text-xs text-slate-500">
          Toàn bộ dữ liệu của bạn được lưu local trong trình duyệt (IndexedDB). LinguaEdge không
          gửi dữ liệu trang web ra ngoài, trừ phần văn bản bạn chủ động dịch (sẽ qua Google
          Translate).
        </p>
      </Section>

      <Section title="Phím tắt">
        <ul className="text-sm text-slate-600 space-y-1">
          <li><kbd className="border rounded px-1 mr-2">Alt+T</kbd> Dịch lựa chọn hiện tại</li>
          <li><kbd className="border rounded px-1 mr-2">Alt+Shift+D</kbd> Mở dashboard</li>
          <li><kbd className="border rounded px-1 mr-2">S</kbd> Lưu khi popup dịch đang mở</li>
          <li><kbd className="border rounded px-1 mr-2">Esc</kbd> Đóng popup dịch</li>
        </ul>
      </Section>
    </div>
  );
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-4">
      <h2 className="font-semibold mb-3">{props.title}</h2>
      <div className="space-y-3">{props.children}</div>
    </section>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm">{props.label}</span>
      <div>{props.children}</div>
    </div>
  );
}

function Toggle(props: {
  label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{props.label}</div>
        {props.desc && <div className="text-xs text-slate-500 mt-0.5">{props.desc}</div>}
      </div>
      <span
        role="switch"
        aria-checked={props.checked}
        onClick={() => props.onChange(!props.checked)}
        className={`shrink-0 w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
          props.checked ? 'bg-brand-500' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
            props.checked ? 'translate-x-5' : ''
          }`}
        />
      </span>
    </div>
  );
}

function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatDate(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}
