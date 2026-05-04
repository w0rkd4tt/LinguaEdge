import { useEffect, useState } from 'react';
import { getSettings, setSettings as saveSettings } from '@/common/db';
import { saveWord } from '@/common/vocab-service';
import type { Settings } from '@/common/types';

export function Welcome() {
  const [step, setStep] = useState(0);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => { getSettings().then(setSettings); }, []);

  const update = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    if (!settings) return;
    const next = { ...settings, [key]: value };
    setSettings(next);
    await saveSettings({ [key]: value } as Partial<Settings>);
    chrome.storage.local.set({ linguaedge_settings_cache: next });
  };

  const finish = () => {
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
    window.close();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <header className="flex items-center gap-3 mb-10">
          <div className="w-12 h-12 rounded-xl bg-brand-500 text-white flex items-center justify-center font-bold text-xl">
            L
          </div>
          <div>
            <div className="text-2xl font-semibold">LinguaEdge</div>
            <div className="text-sm text-slate-500">Đọc → Dịch → Lưu → Ôn, không rời trang.</div>
          </div>
        </header>

        <Progress step={step} total={4} />

        <div className="bg-white rounded-2xl border border-slate-200 p-8 mt-6 shadow-sm">
          {step === 0 && <StepIntro onNext={() => setStep(1)} />}
          {step === 1 && settings && (
            <StepLanguage
              settings={settings}
              onChange={update}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && settings && (
            <StepBehavior
              settings={settings}
              onChange={update}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && <StepDemo onFinish={finish} />}
        </div>
      </div>
    </div>
  );
}

function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`flex-1 h-1.5 rounded-full transition-colors ${
            i <= step ? 'bg-brand-500' : 'bg-slate-200'
          }`}
        />
      ))}
    </div>
  );
}

function StepIntro({ onNext }: { onNext: () => void }) {
  return (
    <div>
      <h1 className="text-3xl font-semibold mb-2">Chào mừng đến với LinguaEdge 👋</h1>
      <p className="text-slate-600 mb-6">
        Mỗi trang web tiếng Anh bạn đọc đều có thể trở thành phòng học cá nhân. LinguaEdge giúp:
      </p>
      <ul className="space-y-3 mb-8">
        <Bullet icon="🔍" title="Dịch ngữ cảnh khi bôi đen từ — không cần mở tab mới." />
        <Bullet icon="💾" title="Lưu từ vào kho cá nhân kèm câu gốc, nguồn, thời gian." />
        <Bullet icon="🔁" title="Ôn tập bằng SRS (Spaced Repetition System) đã được khoa học chứng minh." />
        <Bullet icon="📤" title="Xuất ra JSON/CSV bất cứ lúc nào — dữ liệu là của bạn." />
      </ul>
      <button
        onClick={onNext}
        className="px-5 py-2.5 rounded-xl bg-brand-500 text-white font-medium hover:bg-brand-600"
      >
        Bắt đầu thiết lập →
      </button>
    </div>
  );
}

function Bullet({ icon, title }: { icon: string; title: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="text-xl">{icon}</span>
      <span className="text-slate-700">{title}</span>
    </li>
  );
}

function StepLanguage({
  settings, onChange, onNext,
}: {
  settings: Settings;
  onChange: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  onNext: () => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">Ngôn ngữ và trình độ</h2>
      <p className="text-sm text-slate-500 mb-6">Để cá nhân hóa kho từ và đề xuất.</p>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium block mb-1">Ngôn ngữ mẹ đẻ (đích dịch)</label>
          <select
            value={settings.targetLang}
            onChange={(e) => onChange('targetLang', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200"
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="zh-CN">中文 (giản thể)</option>
            <option value="ko">한국어</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Trình độ tiếng Anh hiện tại</label>
          <div className="grid grid-cols-6 gap-2">
            {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((l) => (
              <button
                key={l}
                onClick={() => onChange('level', l)}
                className={`py-2 rounded-lg border text-sm font-medium ${
                  settings.level === l
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
      <button
        onClick={onNext}
        className="mt-6 px-5 py-2.5 rounded-xl bg-brand-500 text-white font-medium hover:bg-brand-600"
      >
        Tiếp tục →
      </button>
    </div>
  );
}

function StepBehavior({
  settings, onChange, onNext,
}: {
  settings: Settings;
  onChange: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  onNext: () => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">Thiết lập trải nghiệm</h2>
      <p className="text-sm text-slate-500 mb-6">Có thể đổi sau trong Settings.</p>
      <div className="space-y-4">
        <div className="p-4 rounded-xl border border-brand-200 bg-brand-50/60 text-sm text-slate-700">
          <div className="font-medium text-slate-800 mb-1">Cách dùng</div>
          Bôi đen từ / cụm từ / đoạn văn rồi bấm{' '}
          <kbd className="border rounded px-1 bg-white">⌥ T</kbd> (macOS) hoặc{' '}
          <kbd className="border rounded px-1 bg-white">Alt+T</kbd> (Windows) để mở popup dịch.
          Không có popup tự động — bạn chủ động khi muốn dịch.
        </div>
        <ToggleRow
          label="Drill khi đọc web"
          desc="Mỗi 10 phút active trên 1 tab, hiện popup nhỏ ở góc dưới-phải hỏi nghĩa của 1 từ ngẫu nhiên (ưu tiên từ Mới / đang Học) kèm câu ví dụ. Tối đa 3 lần/giờ/tab."
          checked={settings.drillEnabled}
          onChange={(v) => onChange('drillEnabled', v)}
        />
        <ToggleRow
          label="Tự tạo deck theo trang web"
          desc="Mỗi domain mới sẽ có deck riêng (ví dụ: medium, bbc, mdn-docs)."
          checked={settings.autoDeckEnabled}
          onChange={(v) => onChange('autoDeckEnabled', v)}
        />
        <ToggleRow
          label="Nhận thông báo nhắc ôn"
          desc="Khi có nhiều từ đến hạn, LinguaEdge sẽ ping nhẹ nhàng."
          checked={settings.notificationsEnabled}
          onChange={(v) => onChange('notificationsEnabled', v)}
        />
      </div>
      <button
        onClick={onNext}
        className="mt-6 px-5 py-2.5 rounded-xl bg-brand-500 text-white font-medium hover:bg-brand-600"
      >
        Tiếp tục →
      </button>
    </div>
  );
}

function StepDemo({ onFinish }: { onFinish: () => void }) {
  const [saved, setSaved] = useState(false);
  const trySave = async () => {
    await saveWord({
      word: 'ubiquitous',
      translation: 'phổ biến, có mặt khắp nơi',
      meanings: [{ partOfSpeech: 'adj', translation: 'phổ biến, có mặt khắp nơi' }],
      pronunciation: { ipa: '/juːˈbɪkwɪtəs/' },
      context: {
        sentence: 'AI is now ubiquitous in modern web applications.',
        sourceUrl: 'https://linguaedge.app/welcome',
        sourceTitle: 'LinguaEdge — chào mừng',
      },
    });
    setSaved(true);
  };
  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">Thử ngay</h2>
      <p className="text-sm text-slate-500 mb-6">
        Bôi đen từ <strong className="bg-amber-100 px-1 rounded">ubiquitous</strong> trong câu bên
        dưới rồi bấm <kbd className="border rounded px-1 bg-white">⌥ T</kbd> (macOS) /{' '}
        <kbd className="border rounded px-1 bg-white">Alt+T</kbd> (Windows) để mở popup dịch
        (popup chỉ hiện khi bạn nhấn hotkey, không tự động). Hoặc bấm "Lưu thử" để có sẵn 1 từ
        trong kho:
      </p>
      <blockquote className="border-l-4 border-brand-300 pl-4 py-2 mb-6 text-slate-700 bg-slate-50 rounded-r">
        "AI is now <span className="bg-amber-100 px-1 rounded">ubiquitous</span> in modern web applications."
      </blockquote>
      <div className="flex gap-2">
        <button
          onClick={trySave}
          disabled={saved}
          className={`px-4 py-2 rounded-lg font-medium ${
            saved ? 'bg-green-500 text-white' : 'bg-slate-100 hover:bg-slate-200'
          }`}
        >
          {saved ? '✓ Đã lưu' : '💾 Lưu thử'}
        </button>
        <button
          onClick={onFinish}
          className="px-4 py-2 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600"
        >
          Mở Dashboard →
        </button>
      </div>
      <p className="mt-6 text-xs text-slate-500">
        Phím tắt mặc định: <kbd className="border rounded px-1">Alt+T</kbd> dịch lựa chọn,{' '}
        <kbd className="border rounded px-1">S</kbd> lưu khi popup mở,{' '}
        <kbd className="border rounded px-1">Alt+Shift+D</kbd> mở dashboard.
      </p>
    </div>
  );
}

function ToggleRow(props: {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded-xl border border-slate-200">
      <div>
        <div className="font-medium text-slate-800">{props.label}</div>
        <div className="text-xs text-slate-500 mt-0.5">{props.desc}</div>
      </div>
      <span
        role="switch"
        aria-checked={props.checked}
        onClick={() => props.onChange(!props.checked)}
        className={`shrink-0 w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
          props.checked ? 'bg-brand-500' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
            props.checked ? 'translate-x-5' : ''
          }`}
        />
      </span>
    </div>
  );
}
