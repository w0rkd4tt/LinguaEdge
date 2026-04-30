import type { KnowledgeState } from '@/common/types';

const labels: Record<KnowledgeState, string> = {
  new: '🆕 Mới',
  learning: '📖 Học',
  reviewing: '🔁 Ôn',
  known: '✅ Thuộc',
  ignored: '🚫 Bỏ qua',
};

export function StatePill({ state }: { state: KnowledgeState }) {
  return <span className={`state-pill ${state}`}>{labels[state]}</span>;
}

export const STATE_LABELS = labels;
