import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Palette, Upload, Plus, Trash2, MessageSquareQuote,
  Edit2, Check, X, FolderKanban, Image, ShieldCheck, Loader2, Star, Users, ChevronDown, ChevronUp, Ban,
  Mountain, MousePointerClick, Pipette, Type, Sparkles, Copy, BadgePercent,
  ChevronLeft, ChevronRight, Images, Wand2, ImagePlus,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBrandIdentity } from '../../contexts/BrandIdentityContext';
import { brandKitApi, fingerprintApi } from '../../lib/api';
import { FONT_OPTIONS, PALETTE_ROLES, fontStack, ensureFontLoaded, getContrastText } from '../../lib/brandIdentity';
import LockedFeature from '../../components/dashboard/LockedFeature';
import { GLASS_STYLE } from '../../components/ui/GlassCard';
import { Skeleton } from '../../components/ui/Skeleton';

function SectionHeader({ icon: Icon, iconColor, title, desc, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-xl ${iconColor} flex items-center justify-center shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h3 className="font-black text-white">{title}</h3>
          {desc && <p className="text-[11px] text-slate-600 mt-0.5">{desc}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// Reveals items in pages instead of mounting the whole collection at once — the DOM/image cost
// that made these sections slower to work with as they grew. Auto-grows via IntersectionObserver
// in HorizontalGallery, so in practice it just feels instant instead of a manual "load more" click.
function useIncrementalReveal(total, pageSize = 12) {
  const [visible, setVisible] = useState(pageSize);
  return {
    visible: Math.min(visible, total),
    hasMore: visible < total,
    reveal: () => setVisible((v) => v + pageSize),
  };
}

// Shared horizontal-scroll shell for every asset grid in Brand Kit — arrow buttons + edge fades
// for discoverability, and a trailing sentinel that fires onLoadMore just before it scrolls into
// view so more items (or the next backend page) are ready before the user reaches the end.
function HorizontalGallery({ children, hasMore, loadingMore, onLoadMore, emptyState }) {
  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!hasMore || !onLoadMore) return;
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) onLoadMore(); },
      { root, rootMargin: '0px 320px 0px 0px' }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMore, onLoadMore]);

  const scrollBy = (dx) => scrollRef.current?.scrollBy({ left: dx, behavior: 'smooth' });

  if (emptyState) return emptyState;

  return (
    <div className="group/gallery relative">
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-1 scroll-smooth snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
        {hasMore && (
          <div ref={sentinelRef} className="shrink-0 w-20 flex items-center justify-center">
            {loadingMore && <Loader2 className="w-4 h-4 text-slate-600 animate-spin" />}
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute inset-y-0 -left-1 w-8 bg-gradient-to-r from-[var(--glass-bg)] to-transparent opacity-70" />
      <div className="pointer-events-none absolute inset-y-0 -right-1 w-8 bg-gradient-to-l from-[var(--glass-bg)] to-transparent opacity-70" />
      <button
        onClick={() => scrollBy(-260)}
        className="hidden sm:flex absolute -left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full items-center justify-center bg-[#0b0e1a] border border-white/10 text-slate-400 hover:text-white opacity-0 group-hover/gallery:opacity-100 transition-all shadow-lg z-10"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => scrollBy(260)}
        className="hidden sm:flex absolute -right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full items-center justify-center bg-[#0b0e1a] border border-white/10 text-slate-400 hover:text-white opacity-0 group-hover/gallery:opacity-100 transition-all shadow-lg z-10"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// Shared tile for Logo/CTA/Promo — full-bleed image so the asset itself reads first, name in its
// own footer strip (never overlaid on the artwork), actions floating on the image in one small
// always-visible toolbar instead of the cramped corner buttons this replaced.
function AssetTile({ item, icon: Icon, isEditing, editingValue, onEditingChange, onSaveEdit, onCancelEdit, isEditor, isAdmin, onStartEdit, onSetPrimary, onDelete }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`group relative w-40 shrink-0 snap-start rounded-2xl overflow-hidden border bg-white/3 transition-all ${item.is_primary ? 'border-amber-500/40' : 'border-white/8 hover:border-white/20'}`}
    >
      <div className="aspect-square bg-white/8 flex items-center justify-center p-3">
        {item.url ? (
          <img src={item.url} alt={item.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
        ) : (
          <Icon className="w-8 h-8 text-slate-700" />
        )}
      </div>

      {item.is_primary && (
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-white bg-amber-500 px-1.5 py-0.5 rounded-full shadow-lg shadow-black/30">
          <Star className="w-2 h-2 fill-white" /> Default
        </span>
      )}

      {isEditor && (
        <div className="absolute top-2 right-2 flex gap-1">
          <button onClick={onStartEdit} className="p-1.5 bg-black/60 backdrop-blur-sm text-white/70 hover:text-white rounded-lg transition-all">
            <Edit2 className="w-3 h-3" />
          </button>
          {!item.is_primary && (
            <button onClick={onSetPrimary} title="Set as default" className="p-1.5 bg-black/60 backdrop-blur-sm text-white/70 hover:text-amber-400 rounded-lg transition-all">
              <Star className="w-3 h-3" />
            </button>
          )}
          {isAdmin && (
            <button onClick={onDelete} className="p-1.5 bg-black/60 backdrop-blur-sm text-white/70 hover:text-red-400 rounded-lg transition-all">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      <div className="px-2.5 py-2 border-t border-white/6">
        {isEditing ? (
          <input
            value={editingValue}
            onChange={onEditingChange}
            onKeyDown={(e) => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onCancelEdit(); }}
            onBlur={onSaveEdit}
            className="w-full bg-[#0c0f1a] border border-blue-500/50 rounded-lg px-2 py-1 text-xs text-white outline-none"
            autoFocus
          />
        ) : (
          <p className="text-xs font-black text-white truncate">{item.name}</p>
        )}
      </div>
    </motion.div>
  );
}

function AssetUploadTile({ onClick, uploading }) {
  return (
    <button
      onClick={onClick}
      disabled={uploading}
      className="w-40 shrink-0 snap-start rounded-2xl border-2 border-dashed border-white/10 hover:border-blue-500/30 hover:bg-blue-500/4 transition-all group flex flex-col disabled:opacity-60"
    >
      <div className="aspect-square flex flex-col items-center justify-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-white/4 group-hover:bg-blue-500/10 border border-white/6 group-hover:border-blue-500/20 flex items-center justify-center transition-all">
          {uploading ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" /> : <Upload className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors" />}
        </div>
        <span className="text-[9px] font-black text-slate-700 group-hover:text-blue-400 uppercase tracking-widest transition-colors">{uploading ? 'Uploading…' : 'Upload'}</span>
      </div>
      <div className="py-2" />
    </button>
  );
}

function ModelSelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-white/4 border border-white/8 rounded-xl w-fit">
      {[
        { id: 'nano-banana', label: 'Nano Banana' },
        { id: 'gpt-image-2', label: 'GPT Image 2' },
      ].map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onChange(m.id)}
          className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${value === m.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

const CREATE_MENTION_REGEX = /@\[Reference:([^\]]+)\]/g;

function renderCreatePromptHighlight(text) {
  if (!text) return null;
  const nodes = [];
  let lastIndex = 0;
  let m;
  let i = 0;
  CREATE_MENTION_REGEX.lastIndex = 0;
  while ((m = CREATE_MENTION_REGEX.exec(text))) {
    if (m.index > lastIndex) nodes.push(<span key={i++}>{text.slice(lastIndex, m.index)}</span>);
    nodes.push(<span key={i++} className="inline rounded-md border px-1 bg-blue-500/15 text-blue-300 border-blue-400/40">{m[0]}</span>);
    lastIndex = CREATE_MENTION_REGEX.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(<span key={i++}>{text.slice(lastIndex)}</span>);
  return nodes;
}

// Shared by the Environment and Character "Create" tabs — a prompt + reference photos is all we
// collect for now; the actual generation happens in the backend later (explicitly out of scope here).
// selectedRefs is the small working set for this one create request — a mix of freshly-uploaded
// local files and photos pulled in from the Troxa reference library via the picker modal. Only
// these (not the whole library) are shown here or mentionable in the prompt.
function CreateTabContent({ name, setName, nameLabel, namePlaceholder, prompt, setPrompt, selectedRefs, onUploadFiles, onRemoveRef, onOpenLibrary, refsRequired }) {
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const [mentionIdx, setMentionIdx] = useState(0);
  const promptRef = useRef(null);
  const backdropRef = useRef(null);
  const uploadInputRef = useRef(null);

  const matches = selectedRefs.filter(r => r.name?.toLowerCase().startsWith(mentionQuery.toLowerCase())).slice(0, 6);

  const insertMention = (ref) => {
    const before = prompt.slice(0, mentionStart);
    const after = prompt.slice(mentionStart + 1 + mentionQuery.length);
    setPrompt(`${before}@[Reference:${ref.name}] ${after}`);
    setMentionOpen(false);
    setTimeout(() => promptRef.current?.focus(), 0);
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setPrompt(val);
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const m = before.match(/@(\w*)$/);
    if (m) {
      setMentionStart(before.length - m[0].length);
      setMentionQuery(m[1]);
      setMentionOpen(true);
      setMentionIdx(0);
    } else {
      setMentionOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">{nameLabel} <span className="text-red-400">*</span></label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={namePlaceholder}
          className="w-full bg-[#0c0f1a] border border-white/8 focus:border-blue-500/50 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-600"
          autoFocus
        />
      </div>

      <div>
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
          Prompt <span className="normal-case font-normal text-slate-600">— type @ to mention a reference photo</span>
        </label>
        <div className="relative h-24 rounded-xl border border-white/8 focus-within:border-blue-500/50 bg-[#0c0f1a] transition-all">
          <div
            ref={backdropRef}
            aria-hidden="true"
            className="absolute inset-0 px-3 py-2.5 text-xs leading-relaxed whitespace-pre-wrap break-words overflow-y-auto pointer-events-none"
          >
            {renderCreatePromptHighlight(prompt)}
          </div>
          <textarea
            ref={promptRef}
            value={prompt}
            onChange={handleChange}
            onKeyDown={(e) => {
              if (!mentionOpen) return;
              if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, Math.max(matches.length - 1, 0))); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); }
              else if (e.key === 'Enter' && matches.length > 0) { e.preventDefault(); insertMention(matches[mentionIdx]); }
              else if (e.key === 'Escape') setMentionOpen(false);
            }}
            onScroll={(e) => { if (backdropRef.current) backdropRef.current.scrollTop = e.target.scrollTop; }}
            onBlur={() => setTimeout(() => setMentionOpen(false), 150)}
            placeholder="Describe what you'd like generated — e.g. a sun-drenched studio backdrop with soft shadows…"
            className="absolute inset-0 w-full h-full bg-transparent px-3 py-2.5 text-xs leading-relaxed outline-none resize-none placeholder:text-slate-600"
            style={{ color: 'transparent', caretColor: 'var(--text-primary)' }}
          />
          {mentionOpen && (
            <div className="absolute z-50 top-full left-0 mt-1.5 w-full bg-[#0c0f1a] border border-white/12 rounded-xl overflow-hidden shadow-xl shadow-black/40">
              {matches.length > 0 ? matches.map((r, i) => (
                <button
                  key={r.id}
                  onMouseDown={(e) => { e.preventDefault(); insertMention(r); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${i === mentionIdx ? 'bg-white/8 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                >
                  <div className="w-6 h-6 rounded-md overflow-hidden bg-white/5 border border-white/8 shrink-0 flex items-center justify-center">
                    {r.url ? <img src={r.url} alt="" className="w-full h-full object-cover" /> : <Images className="w-3 h-3 text-slate-700" />}
                  </div>
                  <span className="text-xs font-bold truncate">{r.name}</span>
                </button>
              )) : (
                <div className="px-3 py-2.5 text-[11px] text-slate-600">No reference photos added — upload one below.</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
          Reference Images {refsRequired ? <span className="text-red-400">*</span> : <span className="normal-case font-normal text-slate-600">(optional)</span>}
        </label>
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { onUploadFiles(Array.from(e.target.files || [])); e.target.value = ''; }}
        />
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {selectedRefs.map((r) => (
            <div key={r.id} className="group relative w-16 h-16 shrink-0 rounded-lg overflow-hidden border-2 border-blue-500/50">
              {r.url ? (
                <img src={r.url} alt={r.name} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full bg-white/5 flex items-center justify-center"><Images className="w-4 h-4 text-slate-700" /></div>
              )}
              <button
                onClick={() => onRemoveRef(r.id)}
                className="absolute top-0.5 right-0.5 p-0.5 bg-black/70 text-red-400 rounded-md opacity-0 group-hover:opacity-100 transition-all"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
          <button
            onClick={() => uploadInputRef.current?.click()}
            className="w-16 h-16 shrink-0 border-2 border-dashed border-white/8 hover:border-blue-500/40 hover:bg-blue-500/5 rounded-lg flex flex-col items-center justify-center gap-1 transition-all group"
          >
            <Upload className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-400 transition-colors" />
            <span className="text-[8px] font-black text-slate-700 group-hover:text-blue-400 uppercase tracking-wider transition-colors">Upload</span>
          </button>
          <button
            onClick={onOpenLibrary}
            className="w-16 h-16 shrink-0 border-2 border-dashed border-white/8 hover:border-blue-500/40 hover:bg-blue-500/5 rounded-lg flex flex-col items-center justify-center gap-1 transition-all group"
          >
            <Images className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-400 transition-colors" />
            <span className="text-[8px] font-black text-slate-700 group-hover:text-blue-400 uppercase tracking-wider transition-colors text-center leading-tight">Library</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Full-screen so existing reference photos are big enough to tell apart — opened from the Create
// tab's "Library" button when the user wants to reuse something already in Brand Kit instead of
// uploading a fresh file.
function ReferenceLibraryModal({ references, referencesLoading, alreadySelectedIds, onClose, onConfirm }) {
  const [draft, setDraft] = useState([]);
  const toggle = (id) => setDraft((prev) => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  const selectable = references.filter(r => !alreadySelectedIds.includes(r.id));

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
        className="w-full max-w-2xl max-h-[80vh] rounded-2xl border border-white/8 flex flex-col overflow-hidden"
        style={{ background: 'var(--dropdown-bg)', backdropFilter: 'blur(20px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center border bg-blue-500/10 border-blue-500/15 text-blue-400">
              <Images className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-black text-white">Reference Library</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Reuse a photo already in Brand Kit</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-600 hover:text-white hover:bg-white/8 rounded-lg transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {referencesLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
            </div>
          ) : selectable.length === 0 ? (
            <div className="text-center py-16 text-slate-600">
              <Images className="w-9 h-9 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No more reference photos available.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4">
              {selectable.map((r) => {
                const active = draft.includes(r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => toggle(r.id)}
                    className={`relative rounded-xl border p-2 text-left transition-all ${active ? 'border-blue-500/50 bg-blue-500/8' : 'border-white/6 bg-white/3 hover:border-white/10'}`}
                  >
                    <div className="aspect-square rounded-lg overflow-hidden bg-white/4 mb-1.5 border border-white/5 flex items-center justify-center">
                      {r.url ? <img src={r.url} alt={r.name} className="w-full h-full object-cover" loading="lazy" /> : <Images className="w-5 h-5 text-slate-700" />}
                    </div>
                    <p className="text-[10px] font-bold text-white truncate">{r.name}</p>
                    {active && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center bg-blue-500 ring-2 ring-[var(--dropdown-bg)]">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/6 shrink-0">
          <p className="text-[11px] text-slate-500">{draft.length} selected</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-white/8 text-slate-400 hover:text-white text-sm font-black transition-all hover:bg-white/5">
              Cancel
            </button>
            <button
              onClick={() => onConfirm(draft)}
              disabled={draft.length === 0}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-black transition-all"
            >
              Add{draft.length ? ` (${draft.length})` : ''}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ModalTabs({ tab, onChange }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-white/4 border border-white/6 rounded-xl w-fit">
      <button
        onClick={() => onChange('create')}
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${tab === 'create' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
      >
        <Wand2 className="w-3 h-3" /> Create
      </button>
      <button
        onClick={() => onChange('upload')}
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${tab === 'upload' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
      >
        <ImagePlus className="w-3 h-3" /> Direct Upload
      </button>
    </div>
  );
}

function BrandKitPage() {
  const { activeWorkspace, isEditor, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('assets');

  const LOGO_PAGE_SIZE = 12;
  const [logos, setLogos] = useState([]);
  const [logoHasMore, setLogoHasMore] = useState(false);
  const [logoLoadingMore, setLogoLoadingMore] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [disclaimers, setDisclaimers] = useState([]);
  const [forbiddenKeywords, setForbiddenKeywords] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newDisclaimer, setNewDisclaimer] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [newCampaign, setNewCampaign] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [campaignEditFields, setCampaignEditFields] = useState({ target_audience: '', target_region: '', objective: '', campaign_brief: '' });
  const logoInputRef = useRef(null);

  useEffect(() => {
    if (!activeWorkspace) return;
    (async () => {
      const [logosRes, campsRes, disclaimersRes, keywordsRes, envsRes, ctasRes, promosRes] = await Promise.allSettled([
        brandKitApi.logosPage(LOGO_PAGE_SIZE, 0),
        brandKitApi.campaigns(),
        brandKitApi.disclaimers(),
        brandKitApi.forbiddenKeywords(),
        brandKitApi.environments(),
        brandKitApi.ctas(),
        brandKitApi.promos(),
      ]);
      if (logosRes.status === 'fulfilled') {
        setLogos(logosRes.value?.results || []);
        setLogoHasMore(!!logosRes.value?.has_more);
      }
      if (campsRes.status === 'fulfilled') setCampaigns(campsRes.value?.results || campsRes.value || []);
      if (disclaimersRes.status === 'fulfilled') setDisclaimers(disclaimersRes.value?.results || disclaimersRes.value || []);
      if (keywordsRes.status === 'fulfilled') setForbiddenKeywords(keywordsRes.value?.results || keywordsRes.value || []);
      if (envsRes.status === 'fulfilled') setEnvironments(envsRes.value || []);
      if (ctasRes.status === 'fulfilled') setCtas(ctasRes.value || []);
      if (promosRes.status === 'fulfilled') setPromos(promosRes.value || []);
      setLoading(false);
    })();
  }, [activeWorkspace]);

  const loadMoreLogos = async () => {
    if (logoLoadingMore) return;
    setLogoLoadingMore(true);
    try {
      const res = await brandKitApi.logosPage(LOGO_PAGE_SIZE, logos.length);
      setLogos((prev) => [...prev, ...(res?.results || [])]);
      setLogoHasMore(!!res?.has_more);
    } catch (_) {}
    setLogoLoadingMore(false);
  };

  const addCampaign = async () => {
    if (!newCampaign.trim()) return;
    try {
      const created = await brandKitApi.createCampaign(newCampaign.trim());
      setCampaigns((prev) => [...prev, created]);
      setNewCampaign('');
    } catch (_) {}
  };

  const removeCampaign = async (id) => {
    try {
      await brandKitApi.deleteCampaign(id);
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
    } catch (_) {}
  };

  const startEditing = (c) => {
    setEditingId(c.id);
    setEditingValue(c.name);
    setCampaignEditFields({
      target_audience: c.target_audience || '',
      target_region  : c.target_region   || '',
      objective      : c.objective        || '',
      campaign_brief : c.campaign_brief   || '',
    });
  };
  const cancelEditing = () => { setEditingId(null); setEditingValue(''); };

  const saveEditing = async (id) => {
    if (!editingValue.trim()) return cancelEditing();
    try {
      const updated = await brandKitApi.updateCampaign(id, { name: editingValue.trim(), ...campaignEditFields });
      setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, ...updated, name: updated.name || editingValue.trim() } : c));
    } catch (_) {}
    cancelEditing();
  };

  const addDisclaimer = async () => {
    if (!newDisclaimer.trim()) return;
    try {
      const created = await brandKitApi.createDisclaimer(newDisclaimer.trim());
      setDisclaimers((prev) => [...prev, created]);
      setNewDisclaimer('');
    } catch (_) {}
  };

  const removeDisclaimer = async (id) => {
    try {
      await brandKitApi.deleteDisclaimer(id);
      setDisclaimers((prev) => prev.filter((d) => d.id !== id));
    } catch (_) {}
  };

  const setDefaultDisclaimer = async (id) => {
    try {
      await brandKitApi.setDefaultDisclaimer(id);
      setDisclaimers((prev) => prev.map((d) => ({ ...d, is_default: d.id === id })));
    } catch (_) {}
  };

  const addForbiddenKeyword = async () => {
    const kw = newKeyword.trim();
    if (!kw) return;
    try {
      const created = await brandKitApi.addForbiddenKeyword(kw);
      setForbiddenKeywords((prev) => [...prev, created].sort((a, b) => a.keyword.localeCompare(b.keyword)));
      setNewKeyword('');
    } catch (_) {}
  };

  const removeForbiddenKeyword = async (id) => {
    try {
      await brandKitApi.deleteForbiddenKeyword(id);
      setForbiddenKeywords((prev) => prev.filter((k) => k.id !== id));
    } catch (_) {}
  };

  const setPrimaryLogo = async (id) => {
    try {
      await brandKitApi.setPrimaryLogo(id);
      setLogos((prev) => prev.map((l) => ({ ...l, is_primary: l.id === id })));
    } catch (_) {}
  };

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoEditingId, setLogoEditingId] = useState(null);
  const [logoEditingName, setLogoEditingName] = useState('');

  // Local-only rename: the logo PATCH endpoint only accepts is_primary today, so this doesn't
  // persist to the backend yet — same honesty tradeoff as Environment/CTA/Promo names.
  const startLogoEditing = (l) => { setLogoEditingId(l.id); setLogoEditingName(l.name); };
  const saveLogoEditing = (id) => {
    if (logoEditingName.trim()) setLogos((prev) => prev.map((l) => l.id === id ? { ...l, name: logoEditingName.trim() } : l));
    setLogoEditingId(null);
  };

  const CHARACTER_PAGE_SIZE = 6;
  const [characters, setCharacters] = useState([]);
  const [charactersHasMore, setCharactersHasMore] = useState(false);
  const [charactersLoadingMore, setCharactersLoadingMore] = useState(false);
  const [expandedChar, setExpandedChar] = useState(null);
  const [editingCharId, setEditingCharId] = useState(null);
  const [editingCharName, setEditingCharName] = useState('');
  const [uploadingCharImg, setUploadingCharImg] = useState(null);
  const [charModal, setCharModal] = useState(false);
  const [charModalTab, setCharModalTab] = useState('create');
  const [charModalName, setCharModalName] = useState('');
  const [charModalFiles, setCharModalFiles] = useState([]);
  const [charModalPreviews, setCharModalPreviews] = useState([]);
  const [charModalSaving, setCharModalSaving] = useState(false);
  const [charModalError, setCharModalError] = useState('');
  const [charCreatePrompt, setCharCreatePrompt] = useState('');
  const [charCreateRefs, setCharCreateRefs] = useState([]);
  const [charCreateModel, setCharCreateModel] = useState('nano-banana');
  const charImgInputRef = useRef(null);
  const charImgCharIdRef = useRef(null);
  const charModalFileInputRef = useRef(null);

  useEffect(() => {
    if (!activeWorkspace) return;
    brandKitApi.charactersPage(CHARACTER_PAGE_SIZE, 0).then((res) => {
      setCharacters(res?.results || []);
      setCharactersHasMore(!!res?.has_more);
    }).catch(() => {});
  }, [activeWorkspace]);

  const loadMoreCharacters = async () => {
    if (charactersLoadingMore) return;
    setCharactersLoadingMore(true);
    try {
      const res = await brandKitApi.charactersPage(CHARACTER_PAGE_SIZE, characters.length);
      setCharacters((prev) => [...prev, ...(res?.results || [])]);
      setCharactersHasMore(!!res?.has_more);
    } catch (_) {}
    setCharactersLoadingMore(false);
  };

  // A character's reference images all arrive nested in one fetch, so "loading more" here is a
  // client-side reveal (like Environment/CTA/Promo) rather than a separate paginated request.
  const CHAR_IMG_PAGE_SIZE = 12;
  const [charImgVisible, setCharImgVisible] = useState({});
  const getCharImgVisible = (charId, total) => Math.min(charImgVisible[charId] ?? CHAR_IMG_PAGE_SIZE, total);
  const revealMoreCharImages = (charId) => setCharImgVisible((prev) => ({ ...prev, [charId]: (prev[charId] ?? CHAR_IMG_PAGE_SIZE) + CHAR_IMG_PAGE_SIZE }));

  const openCharModal = () => {
    setCharModalName('');
    setCharModalFiles([]);
    setCharModalPreviews([]);
    setCharModalError('');
    setCharModalTab('create');
    setCharCreatePrompt('');
    setCharCreateRefs([]);
    setCharCreateModel('nano-banana');
    setCharModal(true);
    ensureReferencesLoaded();
  };

  const closeCharModal = () => {
    setCharModal(false);
    charModalPreviews.forEach(p => URL.revokeObjectURL(p));
    charCreateRefs.forEach(r => { if (r.isLocal) URL.revokeObjectURL(r.url); });
  };

  const handleCharModalFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (charModalTab === 'upload') {
      charModalPreviews.forEach(p => URL.revokeObjectURL(p));
      setCharModalFiles([files[0]]);
      setCharModalPreviews([URL.createObjectURL(files[0])]);
    } else {
      const previews = files.map(f => URL.createObjectURL(f));
      setCharModalFiles(prev => [...prev, ...files]);
      setCharModalPreviews(prev => [...prev, ...previews]);
    }
    e.target.value = '';
  };

  const removeCharModalFile = (idx) => {
    URL.revokeObjectURL(charModalPreviews[idx]);
    setCharModalFiles(prev => prev.filter((_, i) => i !== idx));
    setCharModalPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const saveCharModal = async () => {
    if (!charModalName.trim()) { setCharModalError('Name is required.'); return; }
    if (!charModalFiles[0]) { setCharModalError('Character image is required.'); return; }
    setCharModalSaving(true);
    setCharModalError('');
    try {
      const created = await brandKitApi.createCharacter(charModalName.trim(), '');
      const fd = new FormData();
      fd.append('file', charModalFiles[0]);
      const img = await brandKitApi.uploadCharacterImage(created.id, fd);
      setCharacters(prev => [{ ...created, images: [img] }, ...prev]);
      setExpandedChar(created.id);
      closeCharModal();
    } catch (e) {
      setCharModalError(e.message || 'Something went wrong.');
    }
    setCharModalSaving(false);
  };

  // Replaces @[Reference:name] tokens in a prompt with #Image{1-based-index}.
  // Order must match the backend: statics first (in refs order), then local files.
  const transformMentions = (prompt, refs) => {
    const staticRefs = refs.filter(r => !r.isLocal);
    const fileRefs = refs.filter(r => r.isLocal);
    const indexMap = {};
    staticRefs.forEach((r, i) => { indexMap[r.name] = i + 1; });
    fileRefs.forEach((r, i) => { indexMap[r.name] = staticRefs.length + i + 1; });
    return prompt.replace(/@\[Reference:([^\]]+)\]/g, (match, name) => {
      const idx = indexMap[name];
      return idx !== undefined ? `#Image${idx}` : match;
    });
  };

  const generateCharModal = async () => {
    if (!charModalName.trim()) { setCharModalError('Name is required.'); return; }
    setCharModalSaving(true);
    setCharModalError('');
    try {
      const fd = new FormData();
      fd.append('name', charModalName.trim());
      fd.append('prompt', transformMentions(charCreatePrompt.trim(), charCreateRefs));
      fd.append('model', charCreateModel);
      charCreateRefs.filter(r => !r.isLocal).forEach(ref => fd.append('static_ids', ref.id));
      charCreateRefs.filter(r => r.isLocal && r.file).forEach(ref => fd.append('files', ref.file));
      const created = await brandKitApi.generateCharacter(fd);
      setCharacters(prev => [created, ...prev]);
      setExpandedChar(created.id);
      closeCharModal();
    } catch (e) {
      setCharModalError(e.message || 'Generation failed. Please try again.');
    }
    setCharModalSaving(false);
  };

  const removeCharacter = async (id) => {
    try {
      await brandKitApi.deleteCharacter(id);
      setCharacters(prev => prev.filter(c => c.id !== id));
      if (expandedChar === id) setExpandedChar(null);
    } catch (_) {}
  };

  const saveCharName = async (id) => {
    if (!editingCharName.trim()) { setEditingCharId(null); return; }
    try {
      await brandKitApi.updateCharacter(id, { name: editingCharName.trim() });
      setCharacters(prev => prev.map(c => c.id === id ? { ...c, name: editingCharName.trim() } : c));
    } catch (_) {}
    setEditingCharId(null);
  };

  const handleCharImgUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !charImgCharIdRef.current) return;
    const charId = charImgCharIdRef.current;
    setUploadingCharImg(charId);
    try {
      for (const f of files) {
        const fd = new FormData();
        fd.append('file', f);
        const img = await brandKitApi.uploadCharacterImage(charId, fd);
        setCharacters(prev => prev.map(c =>
          c.id === charId ? { ...c, images: [img, ...(c.images || [])] } : c
        ));
      }
    } catch (_) {}
    e.target.value = '';
    charImgCharIdRef.current = null;
    setUploadingCharImg(null);
  };

  const deleteCharImg = async (charId, imgId) => {
    try {
      await brandKitApi.deleteCharacterImage(charId, imgId);
      setCharacters(prev => prev.map(c =>
        c.id === charId ? { ...c, images: c.images.filter(i => i.id !== imgId) } : c
      ));
    } catch (_) {}
  };

  const handleLogoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingLogo(true);
    const fd = new FormData();
    files.forEach((f) => fd.append('file', f));
    try {
      const created = await brandKitApi.uploadLogo(fd);
      // Prepended, not appended — the list is ordered newest-first, so a fresh upload belongs at the start.
      setLogos((prev) => [...(Array.isArray(created) ? created : [created]), ...prev]);
    } catch (_) {}
    e.target.value = '';
    setUploadingLogo(false);
  };

  // Reference photos (Winning Statics) — the full library backing the Environment/Character
  // "Create" tabs' Library picker. Fetched lazily on first use of either Create tab, not on page load.
  const [references, setReferences] = useState(null);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const ensureReferencesLoaded = async () => {
    if (references !== null || referencesLoading) return;
    setReferencesLoading(true);
    try {
      const res = await brandKitApi.statics();
      const list = res?.results || res || [];
      setReferences(list.map((r, i) => ({ id: r.id, name: r.name || `Reference ${i + 1}`, url: r.url || r.file_url })));
    } catch (_) {
      setReferences([]);
    }
    setReferencesLoading(false);
  };

  // Which Create tab's Library picker is open, if any — 'environment' | 'character' | null.
  const [libraryPickerFor, setLibraryPickerFor] = useState(null);

  const addLocalRefs = (setter) => (files) => {
    const added = files.map((f) => ({ id: crypto.randomUUID(), name: f.name.replace(/\.[^/.]+$/, ''), url: URL.createObjectURL(f), isLocal: true, file: f }));
    setter((prev) => [...prev, ...added]);
  };
  const removeCreateRef = (setter) => (id) => {
    setter((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target?.isLocal) URL.revokeObjectURL(target.url);
      return prev.filter((r) => r.id !== id);
    });
  };
  const addLibraryRefs = (setter) => (ids) => {
    const picked = (references || []).filter((r) => ids.includes(r.id));
    setter((prev) => [...prev, ...picked.filter((p) => !prev.some((r) => r.id === p.id))]);
  };

  // Environment — named custom background images.
  const [environments, setEnvironments] = useState([]);
  const [envModal, setEnvModal] = useState(false);
  const [envModalTab, setEnvModalTab] = useState('create');
  const [envName, setEnvName] = useState('');
  const [envFile, setEnvFile] = useState(null);
  const [envPreview, setEnvPreview] = useState('');
  const [envCreatePrompt, setEnvCreatePrompt] = useState('');
  const [envCreateRefs, setEnvCreateRefs] = useState([]);
  const [envCreateModel, setEnvCreateModel] = useState('nano-banana');
  const [envModalSaving, setEnvModalSaving] = useState(false);
  const [envModalError, setEnvModalError] = useState('');
  const [envEditingId, setEnvEditingId] = useState(null);
  const [envEditingName, setEnvEditingName] = useState('');
  const envModalFileRef = useRef(null);

  const openEnvModal = () => {
    setEnvName(''); setEnvFile(null); setEnvPreview('');
    setEnvModalTab('create'); setEnvCreatePrompt(''); setEnvCreateRefs([]); setEnvCreateModel('nano-banana');
    setEnvModalError('');
    setEnvModal(true);
    ensureReferencesLoaded();
  };
  const closeEnvModal = () => {
    setEnvModal(false);
    if (envPreview) URL.revokeObjectURL(envPreview);
    envCreateRefs.forEach(r => { if (r.isLocal) URL.revokeObjectURL(r.url); });
  };

  const handleEnvModalFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (envPreview) URL.revokeObjectURL(envPreview);
    setEnvFile(file);
    setEnvPreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  const saveEnvModal = async () => {
    if (!envName.trim() || !envFile) return;
    setEnvModalSaving(true);
    setEnvModalError('');
    try {
      const fd = new FormData();
      fd.append('file', envFile);
      fd.append('name', envName.trim());
      fd.append('category', 'environment');
      const [created] = await brandKitApi.uploadEnvironment(fd);
      setEnvironments((prev) => [created, ...prev]);
      closeEnvModal();
    } catch (e) {
      setEnvModalError(e.message || 'Upload failed. Please try again.');
    }
    setEnvModalSaving(false);
  };

  const generateEnvModal = async () => {
    if (!envName.trim()) { setEnvModalError('Name is required.'); return; }
    setEnvModalSaving(true);
    setEnvModalError('');
    try {
      const fd = new FormData();
      fd.append('name', envName.trim());
      fd.append('prompt', transformMentions(envCreatePrompt.trim(), envCreateRefs));
      fd.append('model', envCreateModel);
      envCreateRefs.filter(r => !r.isLocal).forEach(ref => fd.append('static_ids', ref.id));
      envCreateRefs.filter(r => r.isLocal && r.file).forEach(ref => fd.append('files', ref.file));
      const created = await brandKitApi.generateStatic(fd);
      setEnvironments(prev => [created, ...prev]);
      closeEnvModal();
    } catch (e) {
      setEnvModalError(e.message || 'Generation failed. Please try again.');
    }
    setEnvModalSaving(false);
  };

  const removeEnvironment = (id) => {
    setEnvironments((prev) => prev.filter((e) => e.id !== id));
    brandKitApi.deleteStatic(id).catch(() => {});
  };

  const startEnvEditing = (env) => { setEnvEditingId(env.id); setEnvEditingName(env.name); };
  const saveEnvEditing = (id) => {
    if (envEditingName.trim()) setEnvironments((prev) => prev.map((e) => e.id === id ? { ...e, name: envEditingName.trim() } : e));
    setEnvEditingId(null);
  };

  // CTAs — call-to-action assets, mirrors Logo Management. Frontend-only for now; backend wiring comes later.
  const [ctas, setCtas] = useState([]);
  const [uploadingCta, setUploadingCta] = useState(false);
  const [ctaEditingId, setCtaEditingId] = useState(null);
  const [ctaEditingName, setCtaEditingName] = useState('');
  const ctaInputRef = useRef(null);

  const handleCtaUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingCta(true);
    const fd = new FormData();
    files.forEach((f) => fd.append('file', f));
    try {
      const created = await brandKitApi.uploadCta(fd);
      setCtas((prev) => [...(Array.isArray(created) ? created : [created]), ...prev]);
    } catch (_) {}
    e.target.value = '';
    setUploadingCta(false);
  };

  const removeCta = (id) => {
    setCtas((prev) => prev.filter((c) => c.id !== id));
    brandKitApi.deleteCta(id).catch(() => {});
  };

  const setPrimaryCta = async (id) => {
    setCtas((prev) => prev.map((c) => ({ ...c, is_primary: c.id === id })));
    try { await brandKitApi.setPrimaryCta(id); } catch (_) {}
  };
  const startCtaEditing = (c) => { setCtaEditingId(c.id); setCtaEditingName(c.name); };
  const saveCtaEditing = (id) => {
    if (ctaEditingName.trim()) {
      setCtas((prev) => prev.map((c) => c.id === id ? { ...c, name: ctaEditingName.trim() } : c));
      brandKitApi.updateCta(id, { name: ctaEditingName.trim() }).catch(() => {});
    }
    setCtaEditingId(null);
  };

  // Promo — discount badges and promotional stickers, mirrors CTAs. Frontend-only for now; backend wiring comes later.
  const [promos, setPromos] = useState([]);
  const [uploadingPromo, setUploadingPromo] = useState(false);
  const [promoEditingId, setPromoEditingId] = useState(null);
  const [promoEditingName, setPromoEditingName] = useState('');
  const promoInputRef = useRef(null);

  const handlePromoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingPromo(true);
    const fd = new FormData();
    files.forEach((f) => fd.append('file', f));
    try {
      const created = await brandKitApi.uploadPromo(fd);
      setPromos((prev) => [...(Array.isArray(created) ? created : [created]), ...prev]);
    } catch (_) {}
    e.target.value = '';
    setUploadingPromo(false);
  };

  const removePromo = (id) => {
    setPromos((prev) => prev.filter((p) => p.id !== id));
    brandKitApi.deletePromo(id).catch(() => {});
  };

  const setPrimaryPromo = async (id) => {
    setPromos((prev) => prev.map((p) => ({ ...p, is_primary: p.id === id })));
    try { await brandKitApi.setPrimaryPromo(id); } catch (_) {}
  };
  const startPromoEditing = (p) => { setPromoEditingId(p.id); setPromoEditingName(p.name); };
  const savePromoEditing = (id) => {
    if (promoEditingName.trim()) {
      setPromos((prev) => prev.map((p) => p.id === id ? { ...p, name: promoEditingName.trim() } : p));
      brandKitApi.updatePromo(id, { name: promoEditingName.trim() }).catch(() => {});
    }
    setPromoEditingId(null);
  };

  // Color Palette / Typography presets live in BrandIdentityContext now — shared with Prompt
  // Studio, which needs to pick (and lightly edit) the same presets per generation.
  const {
    palettePresets, addPalettePreset, removePalettePreset, toggleActivePalettePreset, renamePalettePreset,
    setColorRole, setColorHex, removeColor, addColor,
    typographyPresets, addTypographyPreset, removeTypographyPreset, toggleActiveTypographyPreset, renameTypographyPreset,
    setTypographyFont,
  } = useBrandIdentity();

  const [expandedPaletteId, setExpandedPaletteId] = useState(null);
  const [paletteEditingId, setPaletteEditingId] = useState(null);
  const [paletteEditingName, setPaletteEditingName] = useState('');
  const [copiedColorId, setCopiedColorId] = useState(null);

  const startPaletteRename = (p) => { setPaletteEditingId(p.id); setPaletteEditingName(p.name); };
  const savePaletteRename = (id) => { renamePalettePreset(id, paletteEditingName); setPaletteEditingId(null); };
  const createPalettePreset = async () => setExpandedPaletteId(await addPalettePreset());
  const copyHex = (colorId, hex) => {
    navigator.clipboard?.writeText(hex);
    setCopiedColorId(colorId);
    setTimeout(() => setCopiedColorId((cur) => (cur === colorId ? null : cur)), 1200);
  };

  const [expandedTypographyId, setExpandedTypographyId] = useState(null);
  const [typographyEditingId, setTypographyEditingId] = useState(null);
  const [typographyEditingName, setTypographyEditingName] = useState('');

  useEffect(() => {
    typographyPresets.forEach((t) => { ensureFontLoaded(t.heading); ensureFontLoaded(t.body); });
  }, [typographyPresets]);

  const startTypographyRename = (t) => { setTypographyEditingId(t.id); setTypographyEditingName(t.name); };
  const saveTypographyRename = (id) => { renameTypographyPreset(id, typographyEditingName); setTypographyEditingId(null); };
  const createTypographyPreset = async () => setExpandedTypographyId(await addTypographyPreset());

  // Environment/CTA/Promo are local-only, so "loading more" just reveals items already
  // in memory — still real savings once a session accumulates a few dozen of any of these.
  const envReveal = useIncrementalReveal(environments.length);
  const ctaReveal = useIncrementalReveal(ctas.length);
  const promoReveal = useIncrementalReveal(promos.length);

  const tabs = [
    { id: 'assets',      label: 'Assets'      },
    { id: 'scenes',      label: 'Scenes'      },
    { id: 'identity',    label: 'Identity'    },
    { id: 'campaigns',   label: 'Campaigns'   },
    { id: 'compliance',  label: 'Compliance'  },
    { id: 'fingerprint', label: '✦ Fingerprint' },
  ];

  const headerActions = {
    campaigns:  isEditor ? <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => document.getElementById('new-campaign-input')?.focus()} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20"><Plus className="w-4 h-4" /> New Campaign</motion.button> : null,
    compliance: isEditor ? <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => document.getElementById('new-disclaimer-input')?.focus()} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20"><Plus className="w-4 h-4" /> Add Disclaimer</motion.button> : null,
  };

  return (
    <div className="space-y-8 pb-20">
      <input ref={logoInputRef} type="file" accept="image/*,.svg" multiple className="hidden" onChange={handleLogoUpload} />
      <input ref={charImgInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleCharImgUpload} />
      <input ref={charModalFileInputRef} type="file" accept="image/*" multiple={charModalTab !== 'upload'} className="hidden" onChange={handleCharModalFiles} />
      <input ref={envModalFileRef} type="file" accept="image/*" className="hidden" onChange={handleEnvModalFile} />
      <input ref={ctaInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleCtaUpload} />
      <input ref={promoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePromoUpload} />

      {/* New Character Modal */}
      <AnimatePresence>
        {charModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
            onClick={e => { if (e.target === e.currentTarget) closeCharModal(); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="w-full max-w-lg rounded-2xl border border-white/8 p-6 space-y-5"
              style={{ background: 'var(--dropdown-bg)', backdropFilter: 'blur(20px)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                    <Users className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">New Character</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Upload reference images directly, or describe one to create later</p>
                  </div>
                </div>
                <button onClick={closeCharModal} className="p-1.5 text-slate-600 hover:text-white transition-colors rounded-lg hover:bg-white/8">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <ModalTabs tab={charModalTab} onChange={setCharModalTab} />

              {charModalTab === 'upload' ? (
                <>
                  {/* Name */}
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Character Name <span className="text-red-400">*</span></label>
                    <input
                      value={charModalName}
                      onChange={e => { setCharModalName(e.target.value); setCharModalError(''); }}
                      onKeyDown={e => e.key === 'Enter' && saveCharModal()}
                      placeholder="e.g. Sarah, The Hero, Brand Mascot…"
                      className="w-full bg-[#0c0f1a] border border-white/8 focus:border-blue-500/50 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-600"
                      autoFocus
                    />
                  </div>

                  {/* Single character image — required */}
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Character Image <span className="text-red-400">*</span></label>
                    {charModalPreviews[0] ? (
                      <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-white/8 bg-white/3 group">
                        <img src={charModalPreviews[0]} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => removeCharModalFile(0)}
                          className="absolute top-1 right-1 p-1 bg-black/70 text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => charModalFileInputRef.current?.click()}
                        className="w-32 h-32 border-2 border-dashed border-white/8 hover:border-blue-500/40 hover:bg-blue-500/5 rounded-xl flex flex-col items-center justify-center gap-2 transition-all group"
                      >
                        <Upload className="w-5 h-5 text-slate-600 group-hover:text-blue-400 transition-colors" />
                        <span className="text-[9px] font-black text-slate-700 group-hover:text-blue-400 uppercase tracking-widest transition-colors">Upload Image</span>
                      </button>
                    )}
                  </div>

                  {charModalError && <p className="text-xs text-red-400">{charModalError}</p>}
                </>
              ) : (
                <>
                  <ModelSelector value={charCreateModel} onChange={setCharCreateModel} />
                  <CreateTabContent
                    name={charModalName}
                    setName={(v) => { setCharModalName(v); setCharModalError(''); }}
                    nameLabel="Character Name"
                    namePlaceholder="e.g. Sarah, The Hero, Brand Mascot…"
                    prompt={charCreatePrompt}
                    setPrompt={setCharCreatePrompt}
                    selectedRefs={charCreateRefs}
                    onUploadFiles={addLocalRefs(setCharCreateRefs)}
                    onRemoveRef={removeCreateRef(setCharCreateRefs)}
                    onOpenLibrary={() => setLibraryPickerFor('character')}
                  />
                  {charModalError && <p className="text-xs text-red-400">{charModalError}</p>}
                </>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button onClick={closeCharModal} className="flex-1 py-2.5 rounded-xl border border-white/8 text-slate-400 hover:text-white text-sm font-black transition-all hover:bg-white/5">
                  Cancel
                </button>
                {charModalTab === 'upload' ? (
                  <button
                    onClick={saveCharModal}
                    disabled={charModalSaving || !charModalName.trim() || !charModalFiles[0]}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-black transition-all flex items-center justify-center gap-2"
                  >
                    {charModalSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save Character'}
                  </button>
                ) : (
                  <button
                    onClick={generateCharModal}
                    disabled={charModalSaving || !charModalName.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-black transition-all flex items-center justify-center gap-2"
                  >
                    {charModalSaving
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating… (30-60s)</>
                      : <><Wand2 className="w-4 h-4" /> Generate Character</>}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Environment Modal */}
      <AnimatePresence>
        {envModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
            onClick={e => { if (e.target === e.currentTarget) closeEnvModal(); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="w-full max-w-lg rounded-2xl border border-white/8 p-6 space-y-5"
              style={{ background: 'var(--dropdown-bg)', backdropFilter: 'blur(20px)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                    <Mountain className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">New Environment</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Upload a backdrop directly, or describe one to create later</p>
                  </div>
                </div>
                <button onClick={closeEnvModal} className="p-1.5 text-slate-600 hover:text-white transition-colors rounded-lg hover:bg-white/8">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <ModalTabs tab={envModalTab} onChange={setEnvModalTab} />

              {envModalTab === 'upload' ? (
                <>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Environment Name <span className="text-red-400">*</span></label>
                    <input
                      value={envName}
                      onChange={e => setEnvName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && envFile && saveEnvModal()}
                      placeholder="e.g. Studio White, Beach Sunset, Office Desk…"
                      className="w-full bg-[#0c0f1a] border border-white/8 focus:border-blue-500/50 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-600"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Background Image <span className="text-red-400">*</span></label>
                    {envPreview ? (
                      <div className="relative aspect-video rounded-xl overflow-hidden border border-white/8 bg-white/3">
                        <img src={envPreview} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => { URL.revokeObjectURL(envPreview); setEnvFile(null); setEnvPreview(''); }}
                          className="absolute top-2 right-2 p-1 bg-black/70 text-red-400 rounded-lg transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => envModalFileRef.current?.click()}
                        className="w-full aspect-video border-2 border-dashed border-white/8 hover:border-blue-500/40 hover:bg-blue-500/5 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all group"
                      >
                        <Upload className="w-5 h-5 text-slate-600 group-hover:text-blue-400 transition-colors" />
                        <span className="text-[9px] font-black text-slate-700 group-hover:text-blue-400 uppercase tracking-widest transition-colors">Choose Image</span>
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <ModelSelector value={envCreateModel} onChange={setEnvCreateModel} />
                  <CreateTabContent
                    name={envName}
                    setName={setEnvName}
                    nameLabel="Environment Name"
                    namePlaceholder="e.g. Studio White, Beach Sunset, Office Desk…"
                    prompt={envCreatePrompt}
                    setPrompt={setEnvCreatePrompt}
                    selectedRefs={envCreateRefs}
                    onUploadFiles={addLocalRefs(setEnvCreateRefs)}
                    onRemoveRef={removeCreateRef(setEnvCreateRefs)}
                    onOpenLibrary={() => setLibraryPickerFor('environment')}
                  />
                  {envModalError && <p className="text-xs text-red-400">{envModalError}</p>}
                </>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={closeEnvModal} className="flex-1 py-2.5 rounded-xl border border-white/8 text-slate-400 hover:text-white text-sm font-black transition-all hover:bg-white/5">
                  Cancel
                </button>
                {envModalTab === 'upload' ? (
                  <button
                    onClick={saveEnvModal}
                    disabled={envModalSaving || !envName.trim() || !envFile}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-black transition-all flex items-center justify-center gap-2"
                  >
                    {envModalSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Add Environment'}
                  </button>
                ) : (
                  <button
                    onClick={generateEnvModal}
                    disabled={envModalSaving || !envName.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-black transition-all flex items-center justify-center gap-2"
                  >
                    {envModalSaving
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating… (30-60s)</>
                      : <><Wand2 className="w-4 h-4" /> Generate Environment</>
                    }
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reference Library picker — opened from either Create tab's "Library" button */}
      <AnimatePresence>
        {libraryPickerFor && (
          <ReferenceLibraryModal
            references={references || []}
            referencesLoading={referencesLoading}
            alreadySelectedIds={(libraryPickerFor === 'environment' ? envCreateRefs : charCreateRefs).map(r => r.id)}
            onClose={() => setLibraryPickerFor(null)}
            onConfirm={(ids) => {
              (libraryPickerFor === 'environment' ? addLibraryRefs(setEnvCreateRefs) : addLibraryRefs(setCharCreateRefs))(ids);
              setLibraryPickerFor(null);
            }}
          />
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Brand Kit</h1>
          <p className="text-slate-500 text-sm mt-1">Logos, scenes, identity, campaigns, and compliance guardrails</p>
        </div>
        {headerActions[activeTab]}
      </div>

      <div className="flex items-center gap-1 p-1 bg-blue-500/10 border border-white/6 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-5 py-2 rounded-lg text-sm font-black transition-all ${activeTab === tab.id ? 'text-white' : 'text-slate-400 hover:text-slate-300'}`}
          >
            {activeTab === tab.id && (
              <motion.div layoutId="brandkit-tab" className="absolute inset-0 bg-blue-500/10 border border-blue-500/20 rounded-lg" />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'assets' && (
          <motion.div key="assets" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
            {/* Logo Management */}
            <div style={GLASS_STYLE} className="rounded-2xl p-6">
              <SectionHeader
                icon={Palette}
                iconColor="bg-blue-500/10 border border-blue-500/15 text-blue-400"
                title="Logo Management"
                desc="Brand identity assets used in creative generation"
                action={isEditor && (
                  <button onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo} className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20">
                    {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload Logo
                  </button>
                )}
              />
              {loading ? (
                <div className="flex gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="w-40 shrink-0 p-4 border border-white/6 bg-white/3 rounded-xl">
                      <Skeleton className="aspect-square rounded-xl w-full mb-3" />
                      <Skeleton className="h-3 w-3/4 rounded-md" />
                    </div>
                  ))}
                </div>
              ) : (
                <HorizontalGallery hasMore={logoHasMore} loadingMore={logoLoadingMore} onLoadMore={loadMoreLogos}>
                  <AnimatePresence>
                    {logos.map((logo) => (
                      <AssetTile
                        key={logo.id}
                        item={{ ...logo, url: logo.file_url || logo.url }}
                        icon={Image}
                        isEditor={isEditor}
                        isAdmin={isAdmin}
                        isEditing={logoEditingId === logo.id}
                        editingValue={logoEditingName}
                        onEditingChange={e => setLogoEditingName(e.target.value)}
                        onStartEdit={() => startLogoEditing(logo)}
                        onSaveEdit={() => saveLogoEditing(logo.id)}
                        onCancelEdit={() => setLogoEditingId(null)}
                        onSetPrimary={() => setPrimaryLogo(logo.id)}
                        onDelete={() => { brandKitApi.deleteLogo(logo.id).then(() => setLogos((p) => p.filter((l) => l.id !== logo.id))).catch(() => {}); }}
                      />
                    ))}
                  </AnimatePresence>
                  {isEditor && <AssetUploadTile onClick={() => logoInputRef.current?.click()} uploading={uploadingLogo} />}
                </HorizontalGallery>
              )}
            </div>

            {/* CTAs */}
            <div style={GLASS_STYLE} className="rounded-2xl p-6">
              <SectionHeader
                icon={MousePointerClick}
                iconColor="bg-blue-500/10 border border-blue-500/15 text-blue-400"
                title="CTAs"
                desc="Call-to-action assets — buttons, badges, banners used in creative generation"
                action={isEditor && (
                  <button onClick={() => ctaInputRef.current?.click()} disabled={uploadingCta} className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20">
                    {uploadingCta ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload CTA
                  </button>
                )}
              />
              <HorizontalGallery hasMore={ctaReveal.hasMore} onLoadMore={ctaReveal.reveal}>
                <AnimatePresence>
                  {ctas.slice(0, ctaReveal.visible).map((cta) => (
                    <AssetTile
                      key={cta.id}
                      item={{ ...cta, url: cta.file_url || cta.url }}
                      icon={MousePointerClick}
                      isEditor={isEditor}
                      isAdmin={isAdmin}
                      isEditing={ctaEditingId === cta.id}
                      editingValue={ctaEditingName}
                      onEditingChange={e => setCtaEditingName(e.target.value)}
                      onStartEdit={() => startCtaEditing(cta)}
                      onSaveEdit={() => saveCtaEditing(cta.id)}
                      onCancelEdit={() => setCtaEditingId(null)}
                      onSetPrimary={() => setPrimaryCta(cta.id)}
                      onDelete={() => removeCta(cta.id)}
                    />
                  ))}
                </AnimatePresence>
                {isEditor && <AssetUploadTile onClick={() => ctaInputRef.current?.click()} uploading={uploadingCta} />}
              </HorizontalGallery>
            </div>

            {/* Promo */}
            <div style={GLASS_STYLE} className="rounded-2xl p-6">
              <SectionHeader
                icon={BadgePercent}
                iconColor="bg-blue-500/10 border border-blue-500/15 text-blue-400"
                title="Promo"
                desc="Discount badges and promotional stickers used in creative generation"
                action={isEditor && (
                  <button onClick={() => promoInputRef.current?.click()} disabled={uploadingPromo} className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20">
                    {uploadingPromo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload Promo
                  </button>
                )}
              />
              <HorizontalGallery hasMore={promoReveal.hasMore} onLoadMore={promoReveal.reveal}>
                <AnimatePresence>
                  {promos.slice(0, promoReveal.visible).map((promo) => (
                    <AssetTile
                      key={promo.id}
                      item={{ ...promo, url: promo.file_url || promo.url }}
                      icon={BadgePercent}
                      isEditor={isEditor}
                      isAdmin={isAdmin}
                      isEditing={promoEditingId === promo.id}
                      editingValue={promoEditingName}
                      onEditingChange={e => setPromoEditingName(e.target.value)}
                      onStartEdit={() => startPromoEditing(promo)}
                      onSaveEdit={() => savePromoEditing(promo.id)}
                      onCancelEdit={() => setPromoEditingId(null)}
                      onSetPrimary={() => setPrimaryPromo(promo.id)}
                      onDelete={() => removePromo(promo.id)}
                    />
                  ))}
                </AnimatePresence>
                {isEditor && <AssetUploadTile onClick={() => promoInputRef.current?.click()} uploading={uploadingPromo} />}
              </HorizontalGallery>
            </div>
          </motion.div>
        )}

        {activeTab === 'scenes' && (
          <motion.div key="scenes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
            {/* Characters */}
            <div style={GLASS_STYLE} className="rounded-2xl p-6">
              <SectionHeader
                icon={Users}
                iconColor="bg-blue-500/10 border border-blue-500/15 text-blue-400"
                title="Characters"
                desc="Named personas with reference images used in creative generation"
                action={isEditor && (
                  <button
                    onClick={openCharModal}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20"
                  >
                    <Plus className="w-4 h-4" /> New Character
                  </button>
                )}
              />

              {characters.length === 0 ? (
                <div className="text-center py-10 text-slate-600">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No characters yet. Create one to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {characters.map(char => (
                      <motion.div
                        key={char.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        className="border border-white/6 rounded-xl overflow-hidden"
                      >
                        {/* Character header */}
                        <div
                          className="flex items-center justify-between px-4 py-3 bg-white/3 hover:bg-white/5 cursor-pointer transition-colors"
                          onClick={() => setExpandedChar(expandedChar === char.id ? null : char.id)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 h-7 rounded-lg overflow-hidden bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                              {char.images?.[0]?.url
                                ? <img src={char.images[0].url} alt={char.name} className="w-full h-full object-cover" loading="lazy" />
                                : <Users className="w-3.5 h-3.5 text-blue-400" />}
                            </div>
                            {editingCharId === char.id ? (
                              <input
                                value={editingCharName}
                                onChange={e => setEditingCharName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveCharName(char.id); if (e.key === 'Escape') setEditingCharId(null); }}
                                onBlur={() => saveCharName(char.id)}
                                className="bg-[#0c0f1a] border border-blue-500/50 rounded-lg px-2 py-1 text-sm text-white outline-none w-40"
                                autoFocus
                                onClick={e => e.stopPropagation()}
                              />
                            ) : (
                              <span className="text-sm font-black text-white truncate">{char.name}</span>
                            )}
                            <span className="text-[10px] text-slate-600 shrink-0">{char.images?.length || 0} image{char.images?.length !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {isEditor && (
                              <button
                                onClick={e => { e.stopPropagation(); setEditingCharId(char.id); setEditingCharName(char.name); }}
                                className="p-1.5 text-slate-600 hover:text-white hover:bg-white/8 rounded-lg transition-all"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={e => { e.stopPropagation(); removeCharacter(char.id); }}
                                className="p-1.5 text-slate-700 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                            {expandedChar === char.id ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                          </div>
                        </div>

                        {/* Character images */}
                        <AnimatePresence>
                          {expandedChar === char.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="p-4 border-t border-white/4 space-y-4">
                                {/* Description */}
                                <div>
                                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Notes / Description</label>
                                  <textarea
                                    defaultValue={char.description || ''}
                                    onBlur={async e => {
                                      const val = e.target.value.trim();
                                      if (val === (char.description || '').trim()) return;
                                      try {
                                        await brandKitApi.updateCharacter(char.id, { description: val });
                                        setCharacters(prev => prev.map(c => c.id === char.id ? { ...c, description: val } : c));
                                      } catch (_) {}
                                    }}
                                    placeholder="Describe this character's appearance, personality, style notes… This is included in the generation prompt."
                                    rows={2}
                                    className="w-full bg-[#0c0f1a] border border-white/8 focus:border-blue-500/40 rounded-xl px-3 py-2.5 text-xs text-white outline-none resize-none transition-all placeholder:text-slate-600"
                                  />
                                </div>
                                {/* Images */}
                                <HorizontalGallery
                                  hasMore={(char.images?.length || 0) > getCharImgVisible(char.id, char.images?.length || 0)}
                                  onLoadMore={() => revealMoreCharImages(char.id)}
                                >
                                  {(char.images || []).slice(0, getCharImgVisible(char.id, char.images?.length || 0)).map(img => (
                                    <div key={img.id} className="group relative w-28 h-28 shrink-0 snap-start rounded-xl overflow-hidden border border-white/6 bg-white/3">
                                      <img src={img.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                                      {/* Caption status badge */}
                                      <div className="absolute bottom-1 left-1">
                                        {img.caption_status === 'done' && (
                                          <div className="w-5 h-5 rounded-full bg-emerald-500/90 flex items-center justify-center shadow">
                                            <Check className="w-2.5 h-2.5 text-white" />
                                          </div>
                                        )}
                                        {img.caption_status === 'error' && (
                                          <div className="w-5 h-5 rounded-full bg-red-500/90 flex items-center justify-center shadow">
                                            <X className="w-2.5 h-2.5 text-white" />
                                          </div>
                                        )}
                                        {(img.caption_status === 'pending' || img.caption_status === 'processing') && (
                                          <div className="w-5 h-5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                                        )}
                                      </div>
                                      {isEditor && (
                                        <button
                                          onClick={() => deleteCharImg(char.id, img.id)}
                                          className="absolute top-1 right-1 p-1 bg-black/70 text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                  {isEditor && (
                                    <button
                                      onClick={() => { charImgCharIdRef.current = char.id; charImgInputRef.current?.click(); }}
                                      disabled={uploadingCharImg === char.id}
                                      className="w-28 h-28 shrink-0 snap-start border-2 border-dashed border-white/6 hover:border-blue-500/30 hover:bg-blue-500/4 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all group cursor-pointer disabled:opacity-60"
                                    >
                                      <div className="w-7 h-7 rounded-lg bg-white/4 group-hover:bg-blue-500/10 border border-white/6 group-hover:border-blue-500/20 flex items-center justify-center transition-all">
                                        {uploadingCharImg === char.id ? <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-400 transition-colors" />}
                                      </div>
                                      <span className="text-[9px] font-black text-slate-700 group-hover:text-blue-400 uppercase tracking-widest transition-colors">{uploadingCharImg === char.id ? 'Uploading…' : 'Add'}</span>
                                    </button>
                                  )}
                                </HorizontalGallery>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {charactersHasMore && (
                    <button
                      onClick={loadMoreCharacters}
                      disabled={charactersLoadingMore}
                      className="w-full py-2.5 rounded-xl border border-white/6 text-xs font-black text-slate-500 hover:text-white hover:border-white/12 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {charactersLoadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      {charactersLoadingMore ? 'Loading…' : 'Load more characters'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Environment */}
            <div style={GLASS_STYLE} className="rounded-2xl p-6">
              <SectionHeader
                icon={Mountain}
                iconColor="bg-blue-500/10 border border-blue-500/15 text-blue-400"
                title="Environment"
                desc="Named backdrops used to place products and scenes in generated creatives"
                action={isEditor && (
                  <button
                    onClick={openEnvModal}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20"
                  >
                    <Plus className="w-4 h-4" /> Add Environment
                  </button>
                )}
              />

              <HorizontalGallery
                hasMore={envReveal.hasMore}
                onLoadMore={envReveal.reveal}
                emptyState={environments.length === 0 && (
                  <div className="text-center py-10 text-slate-600">
                    <Mountain className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">No environments yet. Add a named backdrop to get started.</p>
                  </div>
                )}
              >
                <AnimatePresence>
                  {environments.slice(0, envReveal.visible).map((env) => (
                      <motion.div
                        key={env.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="group relative w-44 shrink-0 snap-start p-3 border border-white/6 hover:border-white/10 bg-white/3 rounded-xl transition-all"
                      >
                        <div className="aspect-video rounded-lg overflow-hidden bg-white/4 mb-2.5 border border-white/5">
                          <img src={env.url} alt={env.name} className="w-full h-full object-cover" loading="lazy" />
                        </div>
                        {envEditingId === env.id ? (
                          <input
                            value={envEditingName}
                            onChange={e => setEnvEditingName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveEnvEditing(env.id); if (e.key === 'Escape') setEnvEditingId(null); }}
                            onBlur={() => saveEnvEditing(env.id)}
                            className="w-full bg-[#0c0f1a] border border-blue-500/50 rounded-lg px-2 py-1 text-xs text-white outline-none"
                            autoFocus
                          />
                        ) : (
                          <p className="text-xs font-black text-white truncate">{env.name}</p>
                        )}
                        {isEditor && (
                          <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => startEnvEditing(env)} className="p-1 bg-[#0b0e1a] border border-white/8 text-slate-500 hover:text-white rounded-lg transition-all">
                              <Edit2 className="w-3 h-3" />
                            </button>
                            {isAdmin && (
                              <button onClick={() => removeEnvironment(env.id)} className="p-1 bg-[#0b0e1a] border border-white/8 text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </motion.div>
                  ))}
                </AnimatePresence>
              </HorizontalGallery>
            </div>
          </motion.div>
        )}

        {activeTab === 'identity' && (
          <motion.div key="identity" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
            {/* Color Palette */}
            <div style={GLASS_STYLE} className="rounded-2xl p-6">
              <SectionHeader
                icon={Pipette}
                iconColor="bg-blue-500/10 border border-blue-500/15 text-blue-400"
                title="Color Palette"
                desc="Named, savable palettes — mark one Active to apply it, or leave none active and pick per generation"
                action={isEditor && (
                  <button onClick={createPalettePreset} className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20">
                    <Plus className="w-4 h-4" /> New Palette
                  </button>
                )}
              />

              {palettePresets.length === 0 ? (
                <div className="text-center py-10 text-slate-600">
                  <Pipette className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No palettes yet. Create one to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {palettePresets.map((preset) => (
                      <motion.div
                        key={preset.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        className="border border-white/6 rounded-xl overflow-hidden"
                      >
                        <div
                          className="flex items-center justify-between px-4 py-3 bg-white/3 hover:bg-white/5 cursor-pointer transition-colors"
                          onClick={() => setExpandedPaletteId(expandedPaletteId === preset.id ? null : preset.id)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex -space-x-1 shrink-0">
                              {preset.colors.slice(0, 4).map((c) => (
                                <span key={c.id} className="w-4 h-4 rounded-full border-2 border-[#0b0e1a]" style={{ background: c.hex }} />
                              ))}
                            </div>
                            {paletteEditingId === preset.id ? (
                              <input
                                value={paletteEditingName}
                                onChange={e => setPaletteEditingName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') savePaletteRename(preset.id); if (e.key === 'Escape') setPaletteEditingId(null); }}
                                onBlur={() => savePaletteRename(preset.id)}
                                className="bg-[#0c0f1a] border border-blue-500/50 rounded-lg px-2 py-1 text-sm text-white outline-none w-40"
                                autoFocus
                                onClick={e => e.stopPropagation()}
                              />
                            ) : (
                              <span className="text-sm font-black text-white truncate">{preset.name}</span>
                            )}
                            {preset.active && (
                              <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                                <Star className="w-2 h-2 fill-amber-400" /> Active
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {isEditor && (
                              <button
                                onClick={e => { e.stopPropagation(); toggleActivePalettePreset(preset.id); }}
                                title={preset.active ? 'Unset as active' : 'Set as active'}
                                className="p-1.5 text-slate-600 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all"
                              >
                                <Star className={`w-3 h-3 ${preset.active ? 'fill-amber-400 text-amber-400' : ''}`} />
                              </button>
                            )}
                            {isEditor && (
                              <button
                                onClick={e => { e.stopPropagation(); startPaletteRename(preset); }}
                                className="p-1.5 text-slate-600 hover:text-white hover:bg-white/8 rounded-lg transition-all"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={e => { e.stopPropagation(); removePalettePreset(preset.id); }}
                                className="p-1.5 text-slate-700 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                            {expandedPaletteId === preset.id ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                          </div>
                        </div>

                        <AnimatePresence>
                          {expandedPaletteId === preset.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="p-4 border-t border-white/4">
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                                  {preset.colors.map((c) => (
                                    <div key={c.id} className="group relative p-3 border border-white/6 hover:border-white/10 bg-white/3 rounded-xl transition-all">
                                      <label className="block aspect-square rounded-lg mb-2.5 border border-white/10 cursor-pointer relative overflow-hidden" style={{ background: c.hex }}>
                                        {isEditor && (
                                          <input
                                            type="color"
                                            value={c.hex}
                                            onChange={e => setColorHex(preset.id, c.id, e.target.value)}
                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                          />
                                        )}
                                      </label>
                                      <button
                                        onClick={() => copyHex(c.id, c.hex)}
                                        className="flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-white transition-colors mb-2"
                                      >
                                        {copiedColorId === c.id ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                                        {c.hex.toUpperCase()}
                                      </button>
                                      <select
                                        value={c.role}
                                        onChange={e => setColorRole(preset.id, c.id, e.target.value)}
                                        disabled={!isEditor}
                                        className="w-full text-[10px] font-black uppercase tracking-wider bg-white/4 border border-white/8 rounded-lg px-2 py-1.5 outline-none"
                                      >
                                        {PALETTE_ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                                      </select>
                                      {isAdmin && (
                                        <button onClick={() => removeColor(preset.id, c.id)} className="absolute top-2.5 right-2.5 p-1 bg-[#0b0e1a] border border-white/8 text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                {isEditor && (
                                  <button onClick={() => addColor(preset.id)} className="mt-4 flex items-center gap-1.5 text-xs font-black text-blue-400 hover:text-blue-300 transition-colors">
                                    <Plus className="w-3.5 h-3.5" /> Add Color
                                  </button>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Typography */}
            <div style={GLASS_STYLE} className="rounded-2xl p-6">
              <SectionHeader
                icon={Type}
                iconColor="bg-blue-500/10 border border-blue-500/15 text-blue-400"
                title="Typography"
                desc="Named, savable heading/body pairings — mark one Active to apply it, or leave none active"
                action={isEditor && (
                  <button onClick={createTypographyPreset} className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20">
                    <Plus className="w-4 h-4" /> New Typography
                  </button>
                )}
              />

              {typographyPresets.length === 0 ? (
                <div className="text-center py-10 text-slate-600">
                  <Type className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No typography presets yet. Create one to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {typographyPresets.map((preset) => (
                      <motion.div
                        key={preset.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        className="border border-white/6 rounded-xl overflow-hidden"
                      >
                        <div
                          className="flex items-center justify-between px-4 py-3 bg-white/3 hover:bg-white/5 cursor-pointer transition-colors"
                          onClick={() => setExpandedTypographyId(expandedTypographyId === preset.id ? null : preset.id)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-base leading-none" style={{ fontFamily: fontStack(preset.heading), fontWeight: 800 }}>Aa</span>
                              <span className="text-base leading-none text-slate-500" style={{ fontFamily: fontStack(preset.body) }}>Aa</span>
                            </div>
                            {typographyEditingId === preset.id ? (
                              <input
                                value={typographyEditingName}
                                onChange={e => setTypographyEditingName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveTypographyRename(preset.id); if (e.key === 'Escape') setTypographyEditingId(null); }}
                                onBlur={() => saveTypographyRename(preset.id)}
                                className="bg-[#0c0f1a] border border-blue-500/50 rounded-lg px-2 py-1 text-sm text-white outline-none w-40"
                                autoFocus
                                onClick={e => e.stopPropagation()}
                              />
                            ) : (
                              <span className="text-sm font-black text-white truncate">{preset.name}</span>
                            )}
                            {preset.active && (
                              <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                                <Star className="w-2 h-2 fill-amber-400" /> Active
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {isEditor && (
                              <button
                                onClick={e => { e.stopPropagation(); toggleActiveTypographyPreset(preset.id); }}
                                title={preset.active ? 'Unset as active' : 'Set as active'}
                                className="p-1.5 text-slate-600 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all"
                              >
                                <Star className={`w-3 h-3 ${preset.active ? 'fill-amber-400 text-amber-400' : ''}`} />
                              </button>
                            )}
                            {isEditor && (
                              <button
                                onClick={e => { e.stopPropagation(); startTypographyRename(preset); }}
                                className="p-1.5 text-slate-600 hover:text-white hover:bg-white/8 rounded-lg transition-all"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={e => { e.stopPropagation(); removeTypographyPreset(preset.id); }}
                                className="p-1.5 text-slate-700 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                            {expandedTypographyId === preset.id ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                          </div>
                        </div>

                        <AnimatePresence>
                          {expandedTypographyId === preset.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="p-4 border-t border-white/4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {[
                                  { key: 'heading', label: 'Heading Font' },
                                  { key: 'body', label: 'Body Font' },
                                ].map(({ key, label }) => (
                                  <div key={key} className="p-5 border border-white/6 bg-white/3 rounded-xl">
                                    <div className="flex items-center justify-between mb-4">
                                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
                                      {isEditor && (
                                        <select
                                          value={preset[key]}
                                          onChange={e => setTypographyFont(preset.id, key, e.target.value)}
                                          className="text-[11px] font-bold bg-white/4 border border-white/8 rounded-lg px-2 py-1 outline-none"
                                        >
                                          {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                                        </select>
                                      )}
                                    </div>
                                    <p
                                      className="text-5xl text-white mb-2"
                                      style={{ fontFamily: fontStack(preset[key]), fontWeight: key === 'heading' ? 800 : 400 }}
                                    >
                                      Aa
                                    </p>
                                    <p
                                      className="text-sm text-slate-400 truncate"
                                      style={{ fontFamily: fontStack(preset[key]), fontWeight: key === 'heading' ? 700 : 400 }}
                                    >
                                      {preset[key]} — The quick brown fox jumps
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Static Preview */}
            <div style={GLASS_STYLE} className="rounded-2xl p-6">
              {(() => {
                const activePalette = palettePresets.find(p => p.active);
                const activeTypography = typographyPresets.find(t => t.active);
                const paletteSource = activePalette || palettePresets[0];
                const typographySource = activeTypography || typographyPresets[0];
                const primary = paletteSource?.colors.find(c => c.role === 'primary')?.hex || '#3b82f6';
                const secondary = paletteSource?.colors.find(c => c.role === 'secondary')?.hex || '#0f172a';
                const accent = paletteSource?.colors.find(c => c.role === 'accent')?.hex || '#f97316';
                const heading = typographySource?.heading || 'Inter';
                const body = typographySource?.body || 'Inter';
                const textColor = getContrastText(primary);
                const ctaLabel = ctas[0]?.name || 'Shop Now';
                const logo = logos.find(l => l.is_primary) || logos[0];
                const bgEnv = environments[0];
                const paletteLabel = activePalette ? `"${activePalette.name}"` : 'default';
                const typographyLabel = activeTypography ? `"${activeTypography.name}"` : 'default';
                return (
                  <>
                    <SectionHeader
                      icon={Sparkles}
                      iconColor="bg-blue-500/10 border border-blue-500/15 text-blue-400"
                      title="Static Preview"
                      desc={`Using ${paletteLabel} colors & ${typographyLabel} typography`}
                    />
                    <div className="relative rounded-2xl p-8 flex flex-col items-start justify-end min-h-64 overflow-hidden" style={!bgEnv ? { background: primary } : undefined}>
                      {bgEnv && (
                        <>
                          <img src={bgEnv.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                          <div className="absolute inset-0" style={{ background: primary, opacity: 0.55 }} />
                        </>
                      )}
                      <span
                        className="absolute top-5 left-5 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full"
                        style={{ background: secondary, color: getContrastText(secondary) }}
                      >
                        New
                      </span>
                      {(logo?.file_url || logo?.url) && (
                        <img src={logo.file_url || logo.url} alt="" className="absolute top-5 right-5 h-8 w-auto object-contain" />
                      )}
                      <h4
                        className="text-3xl mb-2 max-w-md relative"
                        style={{ fontFamily: fontStack(heading), fontWeight: 800, color: textColor }}
                      >
                        Your Headline Here
                      </h4>
                      <p
                        className="text-sm mb-5 max-w-sm opacity-80 relative"
                        style={{ fontFamily: fontStack(body), color: textColor }}
                      >
                        Describe the offer, product, or moment this creative sells in one crisp sentence.
                      </p>
                      <span
                        className="px-5 py-2.5 rounded-xl text-sm font-black relative"
                        style={{ background: accent, color: getContrastText(accent), fontFamily: fontStack(body) }}
                      >
                        {ctaLabel}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>
          </motion.div>
        )}

        {activeTab === 'campaigns' && (
          <motion.div key="campaigns" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
            <div style={GLASS_STYLE} className="rounded-2xl p-6">
              <SectionHeader icon={FolderKanban} iconColor="bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-(--accent)" title="Active Campaigns" desc="Edit campaign name to auto-update all linked creatives" />
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                  <AnimatePresence>
                    {campaigns.map((camp) => (
                      <motion.div
                        key={camp.id}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        className="group p-4 bg-white/3 border border-white/6 hover:border-white/10 rounded-xl transition-all relative min-h-20"
                      >
                        {editingId === camp.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Escape') cancelEditing(); }}
                              className="w-full bg-[#0c0f1a] border border-white/8 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white outline-none transition-all"
                              placeholder="Campaign name..."
                              autoFocus
                            />
                            <textarea
                              rows={2}
                              value={campaignEditFields.target_audience}
                              onChange={(e) => setCampaignEditFields(prev => ({ ...prev, target_audience: e.target.value }))}
                              placeholder="Target audience (e.g. 25-35 male, sports fans...)"
                              className="w-full bg-[#0c0f1a] border border-white/8 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white outline-none transition-all resize-none placeholder:text-slate-700"
                            />
                            <input
                              type="text"
                              value={campaignEditFields.target_region}
                              onChange={(e) => setCampaignEditFields(prev => ({ ...prev, target_region: e.target.value }))}
                              placeholder="Target region (e.g. UK, US, MENA...)"
                              className="w-full bg-[#0c0f1a] border border-white/8 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white outline-none transition-all placeholder:text-slate-700"
                            />
                            <div className="relative">
                              <select
                                value={campaignEditFields.objective}
                                onChange={(e) => setCampaignEditFields(prev => ({ ...prev, objective: e.target.value }))}
                                className="w-full bg-[#0c0f1a] border border-white/8 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white outline-none appearance-none cursor-pointer transition-all"
                              >
                                <option value="">Select objective...</option>
                                <option value="acquisition">Acquisition</option>
                                <option value="retention">Retention</option>
                                <option value="awareness">Brand Awareness</option>
                                <option value="reactivation">Reactivation</option>
                                <option value="event">Event / Seasonal</option>
                              </select>
                              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600 pointer-events-none" />
                            </div>
                            <textarea
                              rows={2}
                              value={campaignEditFields.campaign_brief}
                              onChange={(e) => setCampaignEditFields(prev => ({ ...prev, campaign_brief: e.target.value }))}
                              placeholder="Kampanya brief (optional)"
                              className="w-full bg-[#0c0f1a] border border-white/8 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white outline-none transition-all resize-none placeholder:text-slate-700"
                            />
                            <div className="flex gap-1.5">
                              <button onClick={() => saveEditing(camp.id)} className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-lg transition-all flex items-center justify-center gap-1">
                                <Check className="w-3 h-3" /> Kaydet
                              </button>
                              <button onClick={cancelEditing} className="p-1.5 bg-white/5 border border-white/6 text-slate-500 hover:text-white rounded-lg transition-all">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="text-[8px] font-black text-(--accent) uppercase tracking-widest block mb-1">Campaign</span>
                            <p className="text-xs font-black text-white wrap-break-word pr-10">{camp.name}</p>
                            {(camp.target_audience || camp.target_region || camp.objective) && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {camp.objective && (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded uppercase tracking-widest">{camp.objective}</span>
                                )}
                                {camp.target_region && (
                                  <span className="text-[9px] px-1.5 py-0.5 bg-white/5 border border-white/8 text-slate-500 rounded">{camp.target_region}</span>
                                )}
                                {camp.target_audience && (
                                  <span className="text-[9px] px-1.5 py-0.5 bg-white/5 border border-white/8 text-slate-600 rounded truncate max-w-full">{camp.target_audience.substring(0, 40)}{camp.target_audience.length > 40 ? '…' : ''}</span>
                                )}
                              </div>
                            )}
                            {isEditor && (
                              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <button onClick={() => startEditing(camp)} className="p-1 bg-white/5 border border-white/6 text-slate-500 hover:text-white rounded-lg transition-all">
                                  <Edit2 className="w-2.5 h-2.5" />
                                </button>
                                {isAdmin && (
                                  <button onClick={() => removeCampaign(camp.id)} className="p-1 bg-white/5 border border-white/6 text-slate-600 hover:text-red-400 rounded-lg transition-all">
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
              <div className="flex gap-2 pt-4 border-t border-white/5">
                <input
                  id="new-campaign-input"
                  type="text"
                  value={newCampaign}
                  onChange={(e) => setNewCampaign(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addCampaign(); }}
                  placeholder="New campaign name..."
                  className="flex-1 bg-[#0c0f1a] border border-white/8 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-white outline-none transition-all placeholder:text-slate-700"
                />
                <button onClick={addCampaign} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs transition-all flex items-center gap-1.5 shrink-0">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'compliance' && (
          <motion.div key="compliance" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
            <div style={GLASS_STYLE} className="rounded-2xl p-6">
              <SectionHeader icon={MessageSquareQuote} iconColor="bg-emerald-500/10 border border-emerald-500/15 text-emerald-400" title="Global Disclaimers" desc="Compliance text templates attached to creatives automatically" />
              {loading ? (
                <div className="space-y-3 mb-4">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
                </div>
              ) : (
                <div className="space-y-3 mb-4">
                  <AnimatePresence>
                    {disclaimers.map((d) => (
                      <motion.div
                        key={d.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        className={`group relative p-4 border rounded-xl transition-all ${d.is_default ? 'bg-amber-500/5 border-amber-500/25' : 'bg-white/3 border-white/6 hover:border-white/10'}`}
                      >
                        <div className="flex items-start gap-3 pr-16">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${d.is_default ? 'bg-amber-500/15 border border-amber-500/30' : 'bg-emerald-500/10 border border-emerald-500/15'}`}>
                            <ShieldCheck className={`w-3 h-3 ${d.is_default ? 'text-amber-400' : 'text-emerald-400'}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[8px] font-black uppercase tracking-widest ${d.is_default ? 'text-amber-400' : 'text-emerald-500'}`}>{d.category || 'General'}</span>
                              {d.is_default && (
                                <span className="text-[8px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                  <Star className="w-2 h-2 fill-amber-400" /> Default
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 group-hover:text-slate-300 leading-relaxed italic transition-colors">
                              "{d.text}"
                            </p>
                          </div>
                        </div>
                        {isEditor && (
                          <div className="absolute top-3 right-3 flex items-center gap-1">
                            {!d.is_default && (
                              <button
                                onClick={() => setDefaultDisclaimer(d.id)}
                                title="Set as default"
                                className="p-1 text-slate-700 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Star className="w-3 h-3" />
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => removeDisclaimer(d.id)}
                                className="p-1 text-slate-700 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {disclaimers.length === 0 && !loading && (
                    <div className="py-8 text-center bg-white/2 border border-white/5 rounded-xl">
                      <p className="text-[11px] text-slate-700">No disclaimers added yet</p>
                    </div>
                  )}
                </div>
              )}
              {isEditor && <div className="flex gap-2 pt-4 border-t border-white/5">
                <input
                  id="new-disclaimer-input"
                  type="text"
                  value={newDisclaimer}
                  onChange={(e) => setNewDisclaimer(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addDisclaimer(); }}
                  placeholder="New disclaimer template..."
                  className="flex-1 bg-[#0c0f1a] border border-white/8 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-white outline-none transition-all placeholder:text-slate-700"
                />
                <button onClick={addDisclaimer} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs transition-all flex items-center gap-1.5 shrink-0">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>}
            </div>

            {/* Forbidden Words */}
            <div style={GLASS_STYLE} className="rounded-2xl p-6">
              <SectionHeader icon={Ban} iconColor="bg-red-500/10 border border-red-500/15 text-red-400" title="Forbidden Words" desc="These words will never appear as text in any generated creative" />
              <div className="flex flex-wrap gap-2 mb-4 min-h-[2rem]">
                <AnimatePresence>
                  {forbiddenKeywords.map((k) => (
                    <motion.div
                      key={k.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="group flex items-center gap-1.5 px-3 py-1.5 bg-red-500/8 border border-red-500/20 rounded-lg"
                    >
                      <Ban className="w-2.5 h-2.5 text-red-400 shrink-0" />
                      <span className="text-xs font-bold text-red-300">{k.keyword}</span>
                      {isEditor && (
                        <button
                          onClick={() => removeForbiddenKeyword(k.id)}
                          className="ml-0.5 p-0.5 text-red-500/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                {forbiddenKeywords.length === 0 && !loading && (
                  <p className="text-[11px] text-slate-700 py-1">No forbidden words added yet</p>
                )}
              </div>
              {isEditor && (
                <div className="flex gap-2 pt-4 border-t border-white/5">
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addForbiddenKeyword(); }}
                    placeholder="e.g. guaranteed, jackpot..."
                    className="flex-1 bg-[#0c0f1a] border border-white/8 focus:border-red-500/50 rounded-xl px-4 py-2.5 text-sm text-white outline-none transition-all placeholder:text-slate-700"
                  />
                  <button onClick={addForbiddenKeyword} className="px-4 py-2.5 bg-red-600/80 hover:bg-red-600 text-white rounded-xl font-black text-xs transition-all flex items-center gap-1.5 shrink-0">
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
        {activeTab === 'fingerprint' && (
          <FingerprintTab />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Fingerprint Tab ───────────────────────────────────────────────────────────

function FingerprintTab() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);
  const [recreating, setRecreating] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    try {
      const data = await fingerprintApi.status();
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleMerge = async () => {
    setMerging(true);
    try {
      const res = await fingerprintApi.merge();
      if (res.status === 'nothing_to_merge') showToast('No new records to merge.', 'info');
      else showToast(`Merge queued — ${res.unmerged_count} records being processed.`);
      setTimeout(load, 5000);
    } catch {
      showToast('Merge failed.', 'error');
    } finally {
      setMerging(false);
    }
  };

  const handleRecreate = async () => {
    setRecreating(true);
    try {
      await fingerprintApi.recreate();
      showToast('Full recreate queued — this may take a moment.');
      setTimeout(load, 8000);
    } catch {
      showToast('Recreate failed.', 'error');
    } finally {
      setRecreating(false);
    }
  };

  const confidenceColor = {
    low: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    medium: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    high: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  };

  return (
    <motion.div key="fingerprint" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-xl border ${toast.type === 'error' ? 'bg-red-900/80 border-red-500/30 text-red-200' : toast.type === 'info' ? 'bg-slate-800 border-white/10 text-slate-300' : 'bg-emerald-900/80 border-emerald-500/30 text-emerald-200'}`}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div style={GLASS_STYLE} className="rounded-2xl p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
        </div>
      ) : !status?.exists ? (
        /* Empty state */
        <div style={GLASS_STYLE} className="rounded-2xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6 text-violet-400" />
          </div>
          <p className="text-white font-black">No Fingerprint Yet</p>
          <p className="text-slate-500 text-sm max-w-sm mx-auto">
            Upload brand kit assets (logo, CTA, promo) and reference creatives. The fingerprint builds automatically as you add content.
          </p>
          <div className="text-xs text-slate-600 pt-1">
            Corpus: {status?.corpus_count ?? 0} records · Unmerged: {status?.unmerged_count ?? 0}
          </div>
        </div>
      ) : (
        <>
          {/* Status card */}
          <div style={GLASS_STYLE} className="rounded-2xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-white font-black text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  Brand Fingerprint
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">Auto-updates as you add content</p>
              </div>
              <span className={`text-xs font-black px-2.5 py-1 rounded-lg border ${confidenceColor[status.confidence] ?? confidenceColor.low}`}>
                {status.confidence?.toUpperCase()} confidence
              </span>
            </div>

            {/* Stat pills */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Corpus', value: status.corpus_count },
                { label: 'Unmerged', value: status.unmerged_count },
                { label: 'Brand Profile v', value: status.brand_profile_version },
                { label: 'Visual DNA v', value: status.visual_dna_version },
                { label: 'Based on', value: `${status.based_on_image_count} imgs` },
              ].map(({ label, value }) => (
                <div key={label} className="px-3 py-1.5 rounded-lg bg-white/4 border border-white/6 text-xs">
                  <span className="text-slate-500">{label} </span>
                  <span className="text-white font-black">{value}</span>
                </div>
              ))}
            </div>

            {/* Summary style DNA */}
            {status.summary_style_dna && (
              <div className="bg-violet-500/6 border border-violet-500/15 rounded-xl p-4">
                <p className="text-xs text-slate-400 font-black mb-1.5 uppercase tracking-wider">Visual DNA Summary</p>
                <p className="text-sm text-slate-300 leading-relaxed">{status.summary_style_dna}</p>
              </div>
            )}

            {/* Style tags */}
            {status.style_tags_ranked?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {status.style_tags_ranked.map((tag, i) => (
                  <span key={tag} className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${i === 0 ? 'bg-violet-500/15 border-violet-500/25 text-violet-300' : 'bg-white/4 border-white/8 text-slate-400'}`}>
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Brand tone keywords */}
            {status.brand_tone_keywords?.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 font-black mb-2 uppercase tracking-wider">Brand Tone</p>
                <div className="flex flex-wrap gap-1.5">
                  {status.brand_tone_keywords.map(kw => (
                    <span key={kw} className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/8 border border-amber-500/15 text-amber-400 font-medium">{kw}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions card */}
          <div style={GLASS_STYLE} className="rounded-2xl p-5">
            <p className="text-xs text-slate-500 font-black mb-3 uppercase tracking-wider">Manual Controls</p>
            <div className="flex flex-wrap gap-3">
              {/* Merge */}
              <button
                onClick={handleMerge}
                disabled={merging || status.unmerged_count === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black transition-all border
                  disabled:opacity-40 disabled:cursor-not-allowed
                  bg-blue-500/10 border-blue-500/20 text-blue-300 hover:bg-blue-500/20 hover:border-blue-500/35"
              >
                {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Merge {status.unmerged_count > 0 ? `(${status.unmerged_count} pending)` : ''}
              </button>

              {/* Recreate */}
              <button
                onClick={handleRecreate}
                disabled={recreating || status.corpus_count === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black transition-all border
                  disabled:opacity-40 disabled:cursor-not-allowed
                  bg-violet-500/10 border-violet-500/20 text-violet-300 hover:bg-violet-500/20 hover:border-violet-500/35"
              >
                {recreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Full Recreate
              </button>

              {/* Refresh status */}
              <button
                onClick={() => { setLoading(true); load(); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black transition-all border
                  bg-white/4 border-white/8 text-slate-400 hover:bg-white/8 hover:text-slate-300"
              >
                <Check className="w-4 h-4" />
                Refresh
              </button>
            </div>
            <p className="text-xs text-slate-600 mt-3">
              Merge updates incrementally. Full Recreate rebuilds visual DNA from scratch — use after major style changes.
            </p>
          </div>
        </>
      )}
    </motion.div>
  );
}

export default function BrandKit() {
  const { isFreeTier } = useAuth();
  if (isFreeTier) return <LockedFeature feature="Brand Kit" />;
  return <BrandKitPage />;
}
