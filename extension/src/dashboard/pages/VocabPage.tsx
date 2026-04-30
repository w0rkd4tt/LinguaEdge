import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/common/db';
import type { KnowledgeState, VocabularyItem } from '@/common/types';
import { STATE_LABELS, StatePill } from '../components/StatePill';

const STATES: KnowledgeState[] = ['new', 'learning', 'reviewing', 'known', 'ignored'];

export function VocabPage() {
  const items = useLiveQuery(() => db.vocabulary.orderBy('updatedAt').reverse().toArray(), []);
  const decks = useLiveQuery(() => db.decks.toArray(), []);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<KnowledgeState | 'all'>('all');
  const [deckFilter, setDeckFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    return items.filter((v) => {
      if (stateFilter !== 'all' && v.state !== stateFilter) return false;
      if (deckFilter !== 'all' && !v.decks.includes(deckFilter)) return false;
      if (q) {
        if (
          !v.word.includes(q) &&
          !v.meanings.some((m) => m.translation.toLowerCase().includes(q)) &&
          !v.contexts.some((c) => c.sentence.toLowerCase().includes(q))
        ) return false;
      }
      return true;
    });
  }, [items, search, stateFilter, deckFilter]);

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(filtered.map((v) => v.id)) : new Set());
  };
  const toggleOne = (id: string) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelected(s);
  };

  const bulkSetState = async (state: KnowledgeState) => {
    if (!selected.size) return;
    const ids = [...selected];
    await db.transaction('rw', db.vocabulary, async () => {
      for (const id of ids) {
        const item = await db.vocabulary.get(id);
        if (!item) continue;
        item.state = state;
        item.updatedAt = Date.now();
        await db.vocabulary.put(item);
      }
    });
    setSelected(new Set());
  };

  const bulkDelete = async () => {
    if (!selected.size) return;
    if (!confirm(`Xóa ${selected.size} từ?`)) return;
    await db.vocabulary.bulkDelete([...selected]);
    setSelected(new Set());
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Tìm theo từ, nghĩa, câu..."
          className="flex-1 min-w-[240px] px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-500 focus:outline-none text-sm"
        />
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value as KnowledgeState | 'all')}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
        >
          <option value="all">Mọi trạng thái</option>
          {STATES.map((s) => (
            <option key={s} value={s}>{STATE_LABELS[s]}</option>
          ))}
        </select>
        <select
          value={deckFilter}
          onChange={(e) => setDeckFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
        >
          <option value="all">Mọi deck</option>
          {decks?.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {selected.size > 0 && (
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-brand-700">
            Đã chọn {selected.size} từ
          </span>
          <div className="flex-1" />
          <span className="text-xs text-slate-600">Đổi trạng thái:</span>
          {STATES.map((s) => (
            <button
              key={s}
              onClick={() => bulkSetState(s)}
              className="px-2 py-1 text-xs rounded border border-slate-200 bg-white hover:bg-slate-50"
            >
              {STATE_LABELS[s]}
            </button>
          ))}
          <button
            onClick={bulkDelete}
            className="px-2 py-1 text-xs rounded border border-red-200 text-red-700 bg-white hover:bg-red-50"
          >
            🗑 Xóa
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={(e) => toggleAll(e.target.checked)}
                />
              </th>
              <th className="px-3 py-2">Từ</th>
              <th className="px-3 py-2">Nghĩa</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Deck</th>
              <th className="px-3 py-2">Cập nhật</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => (
              <VocabRow
                key={v.id}
                item={v}
                decks={decks ?? []}
                checked={selected.has(v.id)}
                expanded={expanded === v.id}
                onToggle={() => toggleOne(v.id)}
                onExpand={() => setExpanded(expanded === v.id ? null : v.id)}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-12 text-center text-slate-400">
                  {items === undefined
                    ? 'Đang tải...'
                    : items.length === 0
                      ? 'Chưa có từ nào - bắt đầu bằng cách bôi đen từ trên trang web bất kỳ.'
                      : 'Không có kết quả phù hợp'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-500 text-right">
        Hiển thị {filtered.length} / {items?.length ?? 0} từ
      </div>
    </div>
  );
}

function VocabRow({
  item, decks, checked, expanded, onToggle, onExpand,
}: {
  item: VocabularyItem;
  decks: { id: string; name: string }[];
  checked: boolean;
  expanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
}) {
  const deckNames = item.decks
    .map((id) => decks.find((d) => d.id === id)?.name)
    .filter(Boolean) as string[];
  return (
    <>
      <tr className="border-t border-slate-100 hover:bg-slate-50/60">
        <td className="px-3 py-2">
          <input type="checkbox" checked={checked} onChange={onToggle} />
        </td>
        <td className="px-3 py-2">
          <button
            onClick={onExpand}
            className="font-medium text-slate-800 hover:text-brand-600"
          >
            {item.word}
          </button>
          {item.pronunciation?.ipa && (
            <span className="text-xs text-slate-400 ml-2">{item.pronunciation.ipa}</span>
          )}
        </td>
        <td className="px-3 py-2 text-slate-600 max-w-[300px] truncate">
          {item.meanings[0]?.translation}
        </td>
        <td className="px-3 py-2"><StatePill state={item.state} /></td>
        <td className="px-3 py-2 text-slate-500 text-xs">{deckNames.join(', ') || '—'}</td>
        <td className="px-3 py-2 text-slate-500 text-xs">
          {new Date(item.updatedAt).toLocaleDateString('vi-VN')}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50/60 border-t border-slate-100">
          <td colSpan={6} className="px-6 py-4">
            <VocabDetail item={item} />
          </td>
        </tr>
      )}
    </>
  );
}

function VocabDetail({ item }: { item: VocabularyItem }) {
  return (
    <div className="space-y-3">
      {item.meanings.length > 1 && (
        <div>
          <div className="text-xs uppercase text-slate-400 mb-1">Các nghĩa</div>
          <ul className="space-y-1">
            {item.meanings.map((m, i) => (
              <li key={i} className="text-sm text-slate-700">
                {m.partOfSpeech && (
                  <span className="text-brand-600 mr-2 text-xs">({m.partOfSpeech})</span>
                )}
                {m.translation}
              </li>
            ))}
          </ul>
        </div>
      )}
      {item.contexts.length > 0 && (
        <div>
          <div className="text-xs uppercase text-slate-400 mb-1">
            Đã gặp ({item.contexts.length})
          </div>
          <ul className="space-y-1.5">
            {item.contexts.slice(0, 5).map((c, i) => (
              <li
                key={i}
                className="text-sm text-slate-700 border-l-2 border-brand-300 pl-3"
              >
                <div>{c.sentence}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">
                    {c.sourceTitle || c.sourceUrl}
                  </a>{' '}
                  · {new Date(c.capturedAt).toLocaleDateString('vi-VN')}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="text-xs text-slate-500">
        SRS: ease {item.srs.easeFactor.toFixed(2)} · interval {item.srs.interval} ngày · ôn lần tới{' '}
        {new Date(item.srs.nextReviewAt).toLocaleString('vi-VN')}
      </div>
    </div>
  );
}
