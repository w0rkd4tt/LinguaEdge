import { useEffect, useState } from 'react';
import { VocabPage } from './pages/VocabPage';
import { ReviewPage } from './pages/ReviewPage';
import { DecksPage } from './pages/DecksPage';
import { StatsPage } from './pages/StatsPage';
import { SettingsPage } from './pages/SettingsPage';

const tabs = [
  { id: 'vocab', label: 'Kho từ vựng' },
  { id: 'review', label: 'Ôn tập' },
  { id: 'decks', label: 'Decks' },
  { id: 'stats', label: 'Thống kê' },
  { id: 'settings', label: 'Cài đặt' },
] as const;

type TabId = (typeof tabs)[number]['id'];

export function Dashboard() {
  const [tab, setTab] = useState<TabId>(() => (location.hash.replace('#', '') as TabId) || 'vocab');

  useEffect(() => {
    const onHash = () => {
      const h = location.hash.replace('#', '');
      if (tabs.some((t) => t.id === h)) setTab(h as TabId);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (location.hash.replace('#', '') !== tab) {
      history.replaceState(null, '', `#${tab}`);
    }
  }, [tab]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500 text-white flex items-center justify-center font-bold">
              L
            </div>
            <div>
              <div className="font-semibold leading-tight">LinguaEdge</div>
              <div className="text-[11px] text-slate-500 leading-tight">
                Đọc → Dịch → Lưu → Ôn
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-1 ml-4">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  tab === t.id
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {tab === 'vocab' && <VocabPage />}
        {tab === 'review' && <ReviewPage />}
        {tab === 'decks' && <DecksPage />}
        {tab === 'stats' && <StatsPage />}
        {tab === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}
