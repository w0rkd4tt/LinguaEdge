import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/common/db';
import { uid } from '@/common/uid';

export function DecksPage() {
  const decks = useLiveQuery(() => db.decks.orderBy('createdAt').toArray(), []);
  const items = useLiveQuery(() => db.vocabulary.toArray(), []);
  const [name, setName] = useState('');

  const counts = (deckId: string) =>
    items?.filter((v) => v.decks.includes(deckId)).length ?? 0;

  const createDeck = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await db.decks.put({
      id: 'manual:' + uid(),
      name: trimmed,
      type: 'manual',
      createdAt: Date.now(),
    });
    setName('');
  };

  const removeDeck = async (id: string) => {
    if (!confirm('Xóa deck này? Các từ vẫn được giữ lại.')) return;
    await db.transaction('rw', db.decks, db.vocabulary, async () => {
      await db.decks.delete(id);
      const affected = await db.vocabulary.where('decks').equals(id).toArray();
      for (const item of affected) {
        item.decks = item.decks.filter((d) => d !== id);
        item.updatedAt = Date.now();
        await db.vocabulary.put(item);
      }
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="font-semibold mb-2">Tạo deck mới</h2>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createDeck()}
            placeholder="Ví dụ: IELTS Writing"
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-brand-500 focus:outline-none"
          />
          <button
            onClick={createDeck}
            className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600"
          >
            + Tạo
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Decks tự động (auto) được tạo theo domain mỗi khi bạn lưu từ trên một trang web mới.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Tên</th>
              <th className="px-4 py-2">Loại</th>
              <th className="px-4 py-2">Số từ</th>
              <th className="px-4 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {decks?.map((d) => (
              <tr key={d.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{d.name}</td>
                <td className="px-4 py-2 text-slate-500 text-xs">
                  {d.type === 'auto' ? '🌐 Auto' : '✋ Manual'}
                </td>
                <td className="px-4 py-2">{counts(d.id)}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => removeDeck(d.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
            {decks && decks.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-slate-400">
                  Chưa có deck nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
