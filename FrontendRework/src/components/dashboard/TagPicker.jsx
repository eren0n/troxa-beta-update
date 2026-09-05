import { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Tag, Plus, Check } from 'lucide-react';
import { creativesApi } from '../../lib/api';
import { getPortalRoot } from '../../lib/portalRoot';
import { hexToRgba } from './TagBadge';

const PALETTE = ['#6366f1', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#64748b'];
const PANEL_WIDTH = 224; // w-56

export default function TagPicker({ creativeId, currentTags = [], allTags = [], onChange, onTagCreated, align = 'right', triggerClassName }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const buttonRef = useRef(null);

  const currentIds = currentTags.map(t => t.id);

  const updatePosition = () => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const left = align === 'right' ? rect.right - PANEL_WIDTH : rect.left;
    setPos({
      top: rect.bottom + 8,
      left: Math.max(8, Math.min(left, window.innerWidth - PANEL_WIDTH - 8)),
    });
  };

  const toggleOpen = () => {
    if (!open) updatePosition();
    setOpen(v => !v);
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggleTag = async (tag) => {
    if (saving) return;
    setSaving(true);
    const nextIds = currentIds.includes(tag.id) ? currentIds.filter(id => id !== tag.id) : [...currentIds, tag.id];
    try {
      const updated = await creativesApi.assignTags(creativeId, nextIds);
      onChange?.(updated);
    } catch (_) {}
    setSaving(false);
  };

  const createAndAssign = async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const tag = await creativesApi.createTag(name, newColor);
      onTagCreated?.(tag);
      const updated = await creativesApi.assignTags(creativeId, [...currentIds, tag.id]);
      onChange?.(updated);
      setNewName('');
      setCreating(false);
    } catch (_) {}
    setSaving(false);
  };

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        onClick={toggleOpen}
        className={triggerClassName || 'p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-500 hover:text-white transition-colors'}
        title="Tags"
      >
        <Tag className="w-3.5 h-3.5" />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setCreating(false); }} />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 6 }}
                className="fixed w-56 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 p-3 space-y-2"
                style={{ background: 'var(--dropdown-bg)', top: pos.top, left: pos.left }}
              >
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-1">Tags</p>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {allTags.length === 0 && !creating && (
                  <p className="text-[10px] text-slate-600 px-1 py-1">No tags yet</p>
                )}
                {allTags.map(tag => {
                  const checked = currentIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag)}
                      disabled={saving}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-left disabled:opacity-50"
                    >
                      <span
                        className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${checked ? '' : 'border-white/15'}`}
                        style={checked ? { background: tag.color, borderColor: tag.color } : undefined}
                      >
                        {checked && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tag.color }} />
                      <span className="text-xs text-slate-300 truncate">{tag.name}</span>
                    </button>
                  );
                })}
              </div>

              {creating ? (
                <div className="space-y-2 pt-2 border-t border-white/8">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && createAndAssign()}
                    placeholder="Tag name..."
                    className="w-full bg-black/40 border border-white/10 focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none transition-all"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {PALETTE.map(c => (
                      <button
                        key={c}
                        onClick={() => setNewColor(c)}
                        className="w-5 h-5 rounded-full border-2 transition-all"
                        style={{ background: c, borderColor: newColor === c ? '#fff' : hexToRgba(c, 0.4) }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={createAndAssign} disabled={saving || !newName.trim()}
                      className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold transition-all">
                      Create
                    </button>
                    <button onClick={() => { setCreating(false); setNewName(''); }}
                      className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg text-[10px] font-bold transition-all">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-blue-400 hover:bg-blue-500/10 transition-colors"
                >
                  <Plus className="w-3 h-3" /> New tag
                </button>
              )}
            </motion.div>
            </>
          )}
        </AnimatePresence>,
        getPortalRoot()
      )}
    </div>
  );
}
