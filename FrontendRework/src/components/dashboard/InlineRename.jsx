import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';

export default function InlineRename({ value, onSave, textClassName, inputClassName }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const start = (e) => { e.stopPropagation(); setDraft(value); setEditing(true); };
  const cancel = (e) => { e?.stopPropagation(); setEditing(false); };
  const save = async (e) => {
    e?.stopPropagation();
    const trimmed = draft.trim();
    if (!trimmed || trimmed === value) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(trimmed); } catch (_) {}
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(e); if (e.key === 'Escape') cancel(e); }}
          className={inputClassName || 'flex-1 min-w-0 bg-black/40 border border-blue-500/50 rounded-lg px-2 py-1 text-xs text-white outline-none'}
        />
        <button onClick={save} disabled={saving} className="p-1 text-emerald-400 hover:text-emerald-300 shrink-0"><Check className="w-3.5 h-3.5" /></button>
        <button onClick={cancel} className="p-1 text-slate-500 hover:text-white shrink-0"><X className="w-3.5 h-3.5" /></button>
      </div>
    );
  }

  return (
    // `flex` (not `inline-flex`) so this is a block-level flex container —
    // its width comes from the parent instead of shrink-to-fit sizing to
    // its own content, which is what let a long name push past its
    // container and sit under/over the buttons next to it instead of
    // truncating. `min-w-0` is on both the row and the text span itself
    // rather than relying on the auto-min-size-from-overflow-hidden rule.
    <span className="flex items-center gap-1.5 min-w-0" onClick={(e) => e.stopPropagation()}>
      <span className={`${textClassName} min-w-0`}>{value}</span>
      <button onClick={start} className="p-0.5 text-slate-600 hover:text-white transition-colors shrink-0" title="Rename">
        <Pencil className="w-3 h-3" />
      </button>
    </span>
  );
}
