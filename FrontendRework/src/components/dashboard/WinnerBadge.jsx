import { useState } from 'react';
import { Trophy } from 'lucide-react';
import { creativesApi } from '../../lib/api';

// "Winner" is a normal workspace tag under the hood — reuses the same
// CreativeTag model, gallery ?tags= filter, and the lightbox's existing
// model/aspect-ratio/fingerprint detail panel, so marking a creative a
// winner immediately makes it filterable and its generation settings
// inspectable with zero extra backend work. This component is just a
// one-click, visually distinct shortcut for toggling that one specific
// tag — the full tag picker still handles everything else.
export const WINNER_TAG_NAME = 'Winner';
const WINNER_TAG_COLOR = '#f59e0b'; // amber — matches the existing star-rating color

export default function WinnerBadge({ creativeId, currentTags = [], allTags = [], onChange, onTagCreated }) {
  const [saving, setSaving] = useState(false);
  const winnerTag = allTags.find(t => t.name === WINNER_TAG_NAME);
  const isWinner = currentTags.some(t => t.name === WINNER_TAG_NAME);

  const toggle = async (e) => {
    e.stopPropagation();
    if (saving) return;
    setSaving(true);
    try {
      // Created once per workspace, then reused — get_or_create on the
      // backend makes calling this every time harmless even if it already
      // exists (the common case).
      let tag = winnerTag;
      if (!tag) {
        tag = await creativesApi.createTag(WINNER_TAG_NAME, WINNER_TAG_COLOR);
        onTagCreated?.(tag);
      }
      const currentIds = currentTags.map(t => t.id);
      const nextIds = isWinner ? currentIds.filter(id => id !== tag.id) : [...currentIds, tag.id];
      const updated = await creativesApi.assignTags(creativeId, nextIds);
      onChange?.(updated);
    } catch (_) {}
    setSaving(false);
  };

  return (
    <button
      onClick={toggle}
      disabled={saving}
      title={isWinner ? 'Winner — click to remove' : 'Mark as winner'}
      className={`absolute top-3 right-3 z-10 p-1.5 rounded-full backdrop-blur-md border transition-all ${
        isWinner
          ? 'bg-amber-500 border-amber-300 text-white shadow-lg shadow-amber-500/40'
          : 'bg-black/40 border-white/15 text-white/50 opacity-0 group-hover:opacity-100 hover:text-amber-400 hover:border-amber-400/60'
      } ${saving ? 'opacity-70' : ''}`}
    >
      <Trophy className={`w-3.5 h-3.5 ${isWinner ? 'fill-current' : ''}`} />
    </button>
  );
}
