import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, Users, Mountain, MousePointerClick, Image, Images, Type, Pipette,
  Check, X, Info, ArrowUpRight, BadgePercent, Plus, ChevronDown, Loader2, Search,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBrandIdentity } from '../../contexts/BrandIdentityContext';
import { brandKitApi } from '../../lib/api';
import { FONT_OPTIONS, PALETTE_ROLES, fontStack, ensureFontLoaded } from '../../lib/brandIdentity';
import { GLASS_STYLE } from '../../components/ui/GlassCard';
import { Skeleton } from '../../components/ui/Skeleton';
import { useCreativeGallery } from '../../lib/useCreativeGallery';
import { creativeProxyUrl } from '../../lib/creativeUrl';

// Each type has its own trigger character — Logo/CTA/Promo deliberately share "&" since
// they're all "brand marketing marks" a static drops in, and 6 distinct symbols was one too many.
const TAG_TYPES = [
  { key: 'reference',   trigger: '*', label: 'Reference',   icon: Images,            iconBg: 'bg-blue-500/10 border-blue-500/15 text-blue-400',  chip: 'bg-blue-500/15 text-blue-300 border-blue-400/40',  dot: 'bg-blue-500' },
  { key: 'character',   trigger: '@', label: 'Character',   icon: Users,             iconBg: 'bg-blue-500/10 border-blue-500/15 text-blue-400',  chip: 'bg-blue-500/15 text-blue-300 border-blue-400/40',  dot: 'bg-blue-500' },
  { key: 'environment', trigger: '#', label: 'Environment', icon: Mountain,          iconBg: 'bg-blue-500/10 border-blue-500/15 text-blue-400',  chip: 'bg-blue-500/15 text-blue-300 border-blue-400/40',  dot: 'bg-blue-500' },
  { key: 'cta',         trigger: '&', label: 'CTA',         icon: MousePointerClick, iconBg: 'bg-blue-500/10 border-blue-500/15 text-blue-400',  chip: 'bg-blue-500/15 text-blue-300 border-blue-400/40',  dot: 'bg-blue-500' },
  { key: 'promo',       trigger: '&', label: 'Promo',       icon: BadgePercent,      iconBg: 'bg-blue-500/10 border-blue-500/15 text-blue-400',  chip: 'bg-blue-500/15 text-blue-300 border-blue-400/40',  dot: 'bg-blue-500' },
  { key: 'logo',        trigger: '&', label: 'Logo',        icon: Image,             iconBg: 'bg-blue-500/10 border-blue-500/15 text-blue-400',  chip: 'bg-blue-500/15 text-blue-300 border-blue-400/40',  dot: 'bg-blue-500' },
];
const TAG_TYPE_BY_KEY = Object.fromEntries(TAG_TYPES.map(t => [t.key, t]));
const TAG_TYPE_BY_LABEL = Object.fromEntries(TAG_TYPES.map(t => [t.label.toLowerCase(), t]));
// Which TAG_TYPES share a given trigger character — typing "&" searches Logo + CTA + Promo together.
const TRIGGER_GROUPS = TAG_TYPES.reduce((acc, t) => { (acc[t.trigger] ||= []).push(t); return acc; }, {});

const PICKER_COLORS = {
  reference:   { activeBorder: 'border-blue-400', activeBg: 'bg-blue-500/10', badge: 'bg-blue-500' },
  character:   { activeBorder: 'border-blue-400', activeBg: 'bg-blue-500/10', badge: 'bg-blue-500' },
  environment: { activeBorder: 'border-blue-400', activeBg: 'bg-blue-500/10', badge: 'bg-blue-500' },
  cta:         { activeBorder: 'border-blue-400', activeBg: 'bg-blue-500/10', badge: 'bg-blue-500' },
  promo:       { activeBorder: 'border-blue-400', activeBg: 'bg-blue-500/10', badge: 'bg-blue-500' },
  logo:        { activeBorder: 'border-blue-400',      activeBg: 'bg-blue-500/10',  badge: 'bg-blue-500' },
};

// Same option set and payload shape as Generate Creatives, so a static generated here plugs into
// the same pipeline — aspect ratio is multi-select (a static can be requested in several ratios).
const RATIO_OPTIONS = ['1:1 — Square', '4:5 — Portrait', '9:16 — Story', '16:9 — Landscape'];
const RESOLUTION_OPTIONS = ['1K Standard', '2K Pro', '4K Master'];
const FORMAT_OPTIONS = ['PNG', 'JPG', 'WebP'];

function CompactSelect({ label, value, onChange, children }) {
  return (
    <div>
      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-2">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-[#0b0e1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl py-2.5 pl-3 pr-8 text-xs font-bold text-white outline-none appearance-none cursor-pointer transition-all truncate"
        >
          {children}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
      </div>
    </div>
  );
}

const BLANK_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const NO_TAGS = [];

function galleryImgSrc(item) {
  return item.image_url?.startsWith('https://') ? item.image_url : creativeProxyUrl(item.id);
}

function LazyImg({ src, className, scrollRoot }) {
  const ref = useRef(null);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (revealed) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setRevealed(true); obs.disconnect(); } },
      { root: scrollRoot?.current ?? null, rootMargin: '100px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [scrollRoot, revealed]);
  return <img ref={ref} src={revealed ? src : BLANK_SRC} alt="" className={className} decoding="async" />;
}

function GalleryReferencePicker({ selected, onClose, onConfirm }) {
  const [draft, setDraft] = useState(selected);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ mediaType: 'Photo', search: '' });
  const scrollRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, search })), 380);
    return () => clearTimeout(t);
  }, [search]);

  const { creatives, loading, hasMore, sentinelRef } = useCreativeGallery(filters, NO_TAGS, { pageSize: 12 });
  const selectedIds = useMemo(() => new Set(draft.map((d) => String(d.id))), [draft]);

  const toggle = (item) => {
    const key = String(item.id);
    if (selectedIds.has(key)) {
      setDraft((prev) => prev.filter((d) => String(d.id) !== key));
    } else {
      setDraft((prev) => [...prev, { id: item.id, name: item.name || 'Reference', url: galleryImgSrc(item) }]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[88vh] bg-[#0c0f1a] border border-white/8 rounded-2xl flex flex-col overflow-hidden shadow-2xl shadow-black/60"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
              <Images className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-white">References</h3>
              <p className="text-[11px] text-slate-600 mt-0.5">Select creatives from your gallery as visual reference</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-600 hover:text-white transition-colors rounded-lg hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-white/5 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search creatives..."
              className="w-full bg-white/4 border border-white/8 focus:border-blue-500/50 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition-all"
            />
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-xl bg-white/4 animate-pulse" />
              ))}
            </div>
          ) : creatives.length === 0 ? (
            <div className="text-center py-16 text-slate-600">
              <Images className="w-9 h-9 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No creatives found</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {creatives.map((item) => {
                const active = selectedIds.has(String(item.id));
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item)}
                    className={`relative rounded-xl overflow-hidden aspect-square cursor-pointer border-2 transition-all ${active ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-transparent hover:border-white/15'}`}
                  >
                    <LazyImg
                      src={galleryImgSrc(item)}
                      scrollRoot={scrollRef}
                      className={`w-full h-full object-cover transition-opacity duration-200 ${active ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
                    <AnimatePresence>
                      {active && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                          className="absolute top-1.5 right-1.5 w-5 h-5 bg-blue-500 rounded-md flex items-center justify-center shadow-lg shadow-blue-600/50 border border-blue-400/40"
                        >
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                );
              })}
            </div>
          )}
          {!loading && hasMore && (
            <div ref={sentinelRef} className="flex items-center justify-center py-6">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
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
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-black transition-all"
            >
              Add{draft.length ? ` (${draft.length})` : ''}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ModelSelector({ value, onChange }) {
  return (
    <div>
      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-2">Model</label>
      <div className="flex gap-1.5">
        {[['nano-banana', 'Nano Banana'], ['gpt-image-2', 'GPT Image 2']].map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all ${
              value === v
                ? 'bg-blue-600 text-white shadow shadow-blue-600/20'
                : 'bg-white/4 border border-white/6 text-slate-500 hover:text-white hover:border-white/10'
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

const TAG_REGEX = /([*@#&])\[(Reference|Character|Environment|CTA|Promo|Logo):([^\]]+)\]/g;
const EXAMPLE_PROMPT = '@[Character:Sarah] laughing in #[Environment:Studio White], holding &[CTA:Buy Now] next to a &[Promo:20% Off] sticker and the &[Logo:Primary Mark], shot like *[Reference:Reference 1]';

function renderTaggedText(text) {
  if (!text) return null;
  const nodes = [];
  let lastIndex = 0;
  let m;
  let i = 0;
  TAG_REGEX.lastIndex = 0;
  while ((m = TAG_REGEX.exec(text))) {
    if (m.index > lastIndex) nodes.push(<span key={i++}>{text.slice(lastIndex, m.index)}</span>);
    const [, trigger, label, name] = m;
    const type = TAG_TYPE_BY_LABEL[label.toLowerCase()] || TAG_TYPES[0];
    // This sits in the highlight layer behind an otherwise-invisible
    // textarea (see the `backdropRef` overlay below) — the real input's
    // caret has to land in the same spot the user sees here, so the tag's
    // exact character count/width can't change from the raw `trigger[Label:
    // Name]` syntax. What we *can* do without touching that: fade the
    // syntax noise and bold the asset name within the same span, so it
    // reads like a chip label at a glance instead of raw markup, while the
    // rendered width stays identical either way.
    nodes.push(
      <span key={i++} className={`inline rounded-full border px-1.5 ${type.chip}`}>
        <span className="opacity-50">{trigger}[{label}:</span>
        <span className="font-bold">{name}</span>
        <span className="opacity-50">]</span>
      </span>
    );
    lastIndex = TAG_REGEX.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(<span key={i++}>{text.slice(lastIndex)}</span>);
  return nodes;
}

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

// Shows only what's been added to this prompt — a deliberately empty box until the user adds
// something via the full-screen picker, so the working set stays small and each thumbnail stays legible.
function AddedBox({ typeKey, title, desc, addedItems, loading, onOpenPicker, onRemove }) {
  const type = TAG_TYPE_BY_KEY[typeKey];
  const colors = PICKER_COLORS[typeKey];

  return (
    <div style={GLASS_STYLE} className="rounded-2xl p-6">
      <SectionHeader
        icon={type.icon}
        iconColor={type.iconBg}
        title={title}
        desc={desc}
        action={(
          <button onClick={onOpenPicker} className={`flex items-center gap-1.5 px-4 py-2.5 ${colors.badge} hover:opacity-90 text-white rounded-xl font-black text-sm transition-all shadow-lg`}>
            <Plus className="w-4 h-4" /> Add {title}
          </button>
        )}
      />
      {loading ? (
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="w-20 h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {addedItems.map((item) => (
            <div key={item.id} className="group relative w-20 shrink-0 rounded-xl border border-white/8 bg-white/3 p-2">
              <div className="aspect-square rounded-lg overflow-hidden bg-white/4 mb-1.5 border border-white/5 flex items-center justify-center">
                {item.url ? (
                  <img src={item.url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <type.icon className="w-5 h-5 text-slate-700" />
                )}
              </div>
              <p className="text-[9px] font-bold text-white truncate">{item.name}</p>
              <button
                onClick={() => onRemove(item.id)}
                className="absolute top-1 right-1 p-1 bg-black/70 text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={onOpenPicker}
            className="w-20 h-[6.5rem] shrink-0 border-2 border-dashed border-white/8 hover:border-white/20 hover:bg-white/4 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all group"
          >
            <div className="w-7 h-7 rounded-lg bg-white/4 group-hover:bg-white/8 border border-white/6 flex items-center justify-center transition-all">
              <Plus className="w-3.5 h-3.5 text-slate-600 group-hover:text-white transition-colors" />
            </div>
            <span className="text-[9px] font-black text-slate-700 group-hover:text-white uppercase tracking-widest transition-colors">Add</span>
          </button>
        </div>
      )}
    </div>
  );
}

// Full-screen so thumbnails are big enough to actually tell assets apart — the compact inline
// grid this replaced made everything an indistinguishable 80px square.
function PickerModal({ type, items, selected, multi, emptyText, onClose, onConfirm }) {
  const [draft, setDraft] = useState(() => (multi ? selected : (selected ? [selected] : [])));
  const colors = PICKER_COLORS[type.key];

  const toggle = (id) => {
    if (multi) setDraft((prev) => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
    else setDraft((prev) => (prev[0] === id ? [] : [id]));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
        className="w-full max-w-3xl max-h-[85vh] rounded-2xl border border-white/8 flex flex-col overflow-hidden"
        style={{ background: 'rgba(10,13,20,0.98)', backdropFilter: 'blur(20px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/6 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${type.iconBg}`}>
              <type.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-black text-white">Add {type.label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{multi ? 'Select one or more to use in this prompt' : 'Select one to use in this prompt'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-600 hover:text-white hover:bg-white/8 rounded-lg transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {items.length === 0 ? (
            <div className="text-center py-16 text-slate-600">
              <type.icon className="w-9 h-9 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{emptyText}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4">
              {items.map((item) => {
                const active = draft.includes(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    className={`relative rounded-xl border p-3 text-left transition-all ${active ? `${colors.activeBorder} ${colors.activeBg}` : 'border-white/6 bg-white/3 hover:border-white/10'}`}
                  >
                    <div className="aspect-square rounded-lg overflow-hidden bg-white/4 mb-2 border border-white/5 flex items-center justify-center">
                      {item.url ? (
                        <img src={item.url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <type.icon className="w-6 h-6 text-slate-700" />
                      )}
                    </div>
                    <p className="text-xs font-bold text-white truncate">{item.name}</p>
                    {active && (
                      <div className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-[#0a0d14] ${colors.badge}`}>
                        <Check className="w-3 h-3 text-white" />
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
              onClick={() => onConfirm(multi ? draft : (draft[0] ?? null))}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-black transition-all"
            >
              Add{multi && draft.length ? ` (${draft.length})` : ''}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PromptStudioPage() {
  const { activeWorkspace, isEditor } = useAuth();
  const { palettePresets, typographyPresets, setColorHex, setTypographyFont } = useBrandIdentity();

  // Which preset applies to this generation — null means "no explicit pick yet, fall back to
  // Brand Kit's Active preset if any"; 'none' means the user explicitly opted out. Neither ever
  // falls back to just grabbing the first preset in the list — applying one is optional, not
  // something to force on the user just because a preset happens to exist.
  const [selectedPaletteId, setSelectedPaletteId] = useState(null);
  const [selectedTypographyId, setSelectedTypographyId] = useState(null);
  const activePalette = selectedPaletteId === 'none'
    ? null
    : (selectedPaletteId ? palettePresets.find(p => p.id === selectedPaletteId) : palettePresets.find(p => p.active)) || null;
  const activeTypography = selectedTypographyId === 'none'
    ? null
    : (selectedTypographyId ? typographyPresets.find(t => t.id === selectedTypographyId) : typographyPresets.find(t => t.active)) || null;

  useEffect(() => {
    typographyPresets.forEach((t) => { ensureFontLoaded(t.heading); ensureFontLoaded(t.body); });
  }, [typographyPresets]);

  // Generation settings — same option set/shape as Generate Creatives.
  const [ratios, setRatios] = useState(['1:1 — Square', '9:16 — Story']);
  const [resolution, setResolution] = useState(RESOLUTION_OPTIONS[0]);
  const [format, setFormat] = useState('PNG');
  const [disclaimers, setDisclaimers] = useState([]);
  const [selectedDisclaimer, setSelectedDisclaimer] = useState('');

  const [model, setModel] = useState('nano-banana');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [logos, setLogos] = useState([]);
  const [environments, setEnvironments] = useState([]);
  const [ctas, setCtas] = useState([]);
  const [promos, setPromos] = useState([]);

  // References are selected from the live gallery (not a pre-loaded list).
  // Each entry is a full {id, name, url} object so the AddedBox and tag transform
  // work without a separate lookup array.
  const [selectedReferences, setSelectedReferences] = useState([]);
  const [selectedCharacters, setSelectedCharacters] = useState([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState(null);
  const [selectedCtas, setSelectedCtas] = useState([]);
  const [selectedPromos, setSelectedPromos] = useState([]);
  const [selectedLogo, setSelectedLogo] = useState(null);

  const [prompt, setPrompt] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionTrigger, setMentionTrigger] = useState(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const [mentionIdx, setMentionIdx] = useState(0);
  const promptRef = useRef(null);
  const backdropRef = useRef(null);

  const [showInfo, setShowInfo] = useState(null);

  // Which picker modal is open, and whether it was opened from the mention dropdown's "Add new"
  // row (in which case confirming should also drop the newly-added item straight into the prompt).
  const [modalType, setModalType] = useState(null);
  const [pendingMentionInsert, setPendingMentionInsert] = useState(null);

  useEffect(() => {
    if (!activeWorkspace) return;
    (async () => {
      const [charsRes, logosRes, disclaimersRes, envsRes, ctasRes, promosRes] = await Promise.allSettled([
        brandKitApi.characters(),
        brandKitApi.logos(),
        brandKitApi.disclaimers(),
        brandKitApi.environments(),
        brandKitApi.ctas(),
        brandKitApi.promos(),
      ]);
      if (charsRes.status === 'fulfilled') {
        const list = Array.isArray(charsRes.value) ? charsRes.value : [];
        setCharacters(list.map((c) => ({ id: c.id, name: c.name, url: c.images?.[0]?.url || c.images?.[0]?.file_url })));
      }
      if (logosRes.status === 'fulfilled') {
        const list = logosRes.value?.results || logosRes.value || [];
        setLogos(list.map((l, i) => ({ id: l.id, name: l.name || `Logo ${i + 1}`, url: l.file_url || l.url, is_primary: l.is_primary })));
      }
      if (disclaimersRes.status === 'fulfilled') {
        setDisclaimers(disclaimersRes.value?.results || disclaimersRes.value || []);
      }
      if (envsRes.status === 'fulfilled') {
        const list = envsRes.value?.results || envsRes.value || [];
        setEnvironments(list.map((e, i) => ({ id: e.id, name: e.name || `Environment ${i + 1}`, url: e.url || e.file_url })));
      }
      if (ctasRes.status === 'fulfilled') {
        const list = ctasRes.value?.results || ctasRes.value || [];
        setCtas(list.map((c, i) => ({ id: c.id, name: c.name || `CTA ${i + 1}`, url: c.file_url || c.url })));
      }
      if (promosRes.status === 'fulfilled') {
        const list = promosRes.value?.results || promosRes.value || [];
        setPromos(list.map((p, i) => ({ id: p.id, name: p.name || `Promo ${i + 1}`, url: p.file_url || p.url })));
      }
      setLoading(false);
    })();
  }, [activeWorkspace]);

  const toggleRatio = (r) => setRatios((prev) => (prev.includes(r) ? (prev.length > 1 ? prev.filter((x) => x !== r) : prev) : [...prev, r]));

  // Config for each taggable category — single source of truth the boxes, picker modal and
  // mention system all read from, so "added" always means the same thing everywhere.
  // References use GalleryReferencePicker (not PickerModal), so their items/selected fields
  // are unused by the modal — only AddedBox reads them for display.
  const categoryConfig = {
    reference:   { title: 'References',   desc: 'Gallery creatives used as primary visual reference',               items: selectedReferences, selected: selectedReferences.map(r => r.id), setSelected: () => {},       multi: true,  emptyText: 'No references selected — click Add References to pick from the gallery.' },
    character:   { title: 'Characters',   desc: 'Named personas to feature in this static',                        items: characters,   selected: selectedCharacters,  setSelected: setSelectedCharacters,  multi: true,  emptyText: 'No characters yet — add one in Brand Kit.' },
    environment: { title: 'Environment',  desc: 'Backdrop this static is generated in',                            items: environments, selected: selectedEnvironment, setSelected: setSelectedEnvironment, multi: false, emptyText: 'No environments yet — add one in Brand Kit.' },
    cta:         { title: 'CTAs',         desc: 'Call-to-action assets to place in this static',                   items: ctas,          selected: selectedCtas,        setSelected: setSelectedCtas,        multi: true,  emptyText: 'No CTAs yet — upload one in Brand Kit.' },
    promo:       { title: 'Promo',        desc: 'Discount badges and promotional stickers to place in this static', items: promos,        selected: selectedPromos,      setSelected: setSelectedPromos,      multi: true,  emptyText: 'No promos yet — upload one in Brand Kit.' },
    logo:        { title: 'Logo',         desc: 'Brand mark placed on this static',                                items: logos,         selected: selectedLogo,        setSelected: setSelectedLogo,        multi: false, emptyText: 'No logos yet — upload one in Brand Kit.' },
  };

  const getAdded = (key) => {
    if (key === 'reference') return selectedReferences;
    const cfg = categoryConfig[key];
    return cfg.multi ? cfg.items.filter(i => cfg.selected.includes(i.id)) : cfg.items.filter(i => i.id === cfg.selected);
  };
  const removeAdded = (key, id) => {
    if (key === 'reference') {
      setSelectedReferences((prev) => prev.filter((r) => String(r.id) !== String(id)));
      return;
    }
    const cfg = categoryConfig[key];
    cfg.multi ? cfg.setSelected(cfg.selected.filter(x => x !== id)) : cfg.setSelected(null);
  };

  // Only items added to this prompt (via a picker box) are mentionable.
  const taggable = useMemo(() => (
    Object.keys(categoryConfig).flatMap((key) => getAdded(key).map((item) => ({ ...item, type: key })))
  ), [characters, environments, ctas, promos, logos, selectedReferences, selectedCharacters, selectedEnvironment, selectedCtas, selectedPromos, selectedLogo]);

  const mentionGroup = mentionTrigger ? (TRIGGER_GROUPS[mentionTrigger] || []) : [];
  const mentionMatches = useMemo(() => {
    if (!mentionGroup.length) return [];
    const groupKeys = new Set(mentionGroup.map(t => t.key));
    return taggable.filter(t => groupKeys.has(t.type) && t.name?.toLowerCase().startsWith(mentionQuery.toLowerCase())).slice(0, 8);
  }, [taggable, mentionQuery, mentionGroup]);

  const handlePromptChange = (e) => {
    const val = e.target.value;
    setPrompt(val);
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const m = before.match(/([*@#&])(\w*)$/);
    if (m) {
      setMentionTrigger(m[1]);
      setMentionStart(before.length - m[0].length);
      setMentionQuery(m[2]);
      setMentionOpen(true);
      setMentionIdx(0);
    } else {
      setMentionOpen(false);
    }
  };

  const insertMention = (item) => {
    const type = TAG_TYPE_BY_KEY[item.type];
    const before = prompt.slice(0, mentionStart);
    const after = prompt.slice(mentionStart + 1 + mentionQuery.length);
    const tag = `${type.trigger}[${type.label}:${item.name}]`;
    setPrompt(`${before}${tag} ${after}`);
    setMentionOpen(false);
    setTimeout(() => promptRef.current?.focus(), 0);
  };

  const handlePromptKeyDown = (e) => {
    if (!mentionOpen) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, Math.max(mentionMatches.length - 1, 0))); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && mentionMatches.length > 0) { e.preventDefault(); insertMention(mentionMatches[mentionIdx]); }
    else if (e.key === 'Escape') { setMentionOpen(false); }
  };

  const openPicker = (key) => setModalType(key);
  const openPickerFromMention = (key) => {
    setPendingMentionInsert(key);
    setMentionOpen(false);
    setModalType(key);
  };

  const closePicker = () => { setModalType(null); setPendingMentionInsert(null); };

  const confirmPicker = (newValue) => {
    const cfg = categoryConfig[modalType];
    const oldSelected = cfg.selected;
    cfg.setSelected(newValue);
    if (pendingMentionInsert === modalType) {
      const oldIds = cfg.multi ? oldSelected : (oldSelected ? [oldSelected] : []);
      const newIds = cfg.multi ? newValue : (newValue ? [newValue] : []);
      const addedId = newIds.find(id => !oldIds.includes(id));
      const item = addedId != null && cfg.items.find(i => i.id === addedId);
      if (item) insertMention({ ...item, type: modalType });
    }
    setModalType(null);
    setPendingMentionInsert(null);
  };

  const syncScroll = (e) => { if (backdropRef.current) backdropRef.current.scrollTop = e.target.scrollTop; };

  const handleGenerate = async () => {
    if (!prompt.trim() || !ratios.length || generating) return;
    setGenerating(true);
    setShowInfo(null);
    try {
      // Build ordered tag-to-#ImageN mapping (must match backend ordering exactly)
      let idx = 0;
      const tagMap = {};

      for (const ref of selectedReferences) {
        idx++;
        tagMap[`Reference:${ref.name}`] = `#Image${idx}`;
      }
      const charId = selectedCharacters[0] || null;
      if (charId) {
        const char = characters.find((c) => c.id == charId);
        if (char) { idx++; tagMap[`Character:${char.name}`] = `#Image${idx}`; }
      }
      if (selectedEnvironment) {
        const env = environments.find((e) => e.id == selectedEnvironment);
        if (env) { idx++; tagMap[`Environment:${env.name}`] = `#Image${idx}`; }
      }
      if (selectedLogo) {
        const logo = logos.find((l) => l.id == selectedLogo);
        if (logo) { idx++; tagMap[`Logo:${logo.name}`] = `#Image${idx}`; }
      }
      for (const ctaId of selectedCtas) {
        const cta = ctas.find((c) => c.id == ctaId);
        if (cta) { idx++; tagMap[`CTA:${cta.name}`] = `#Image${idx}`; }
      }
      for (const promoId of selectedPromos) {
        const promo = promos.find((p) => p.id == promoId);
        if (promo) { idx++; tagMap[`Promo:${promo.name}`] = `#Image${idx}`; }
      }

      // Transform inline tags → #ImageN
      const transformedPrompt = prompt.replace(
        /([*@#&])\[(Reference|Character|Environment|CTA|Promo|Logo):([^\]]+)\]/g,
        (_m, _trigger, type, name) => tagMap[`${type}:${name}`] || `[${type}:${name}]`
      );

      const { job_id } = await brandKitApi.studioGenerate({
        model,
        prompt: transformedPrompt,
        reference_ids: selectedReferences.map((r) => r.id),
        character_id: charId,
        environment_id: selectedEnvironment || null,
        logo_id: selectedLogo || null,
        cta_ids: selectedCtas,
        promo_ids: selectedPromos,
        aspect_ratios: ratios.map((r) => r.split(' — ')[0]),
        resolution: resolution.split(' ')[0],
        output_format: format.toLowerCase().replace('jpg', 'jpeg'),
        disclaimer_id: selectedDisclaimer || null,
        palette_preset_id: activePalette?.id || null,
        typography_preset_id: activeTypography?.id || null,
      });

      // Poll until done or failed — capped so a stuck backend job can't
      // leave this polling (and the "generating" UI) running forever.
      let creatives = [];
      const MAX_POLL_ATTEMPTS = 200; // ~10 minutes at 3s/attempt
      let attempts = 0;
      while (true) {
        await new Promise((r) => setTimeout(r, 3000));
        const status = await brandKitApi.studioStatus(job_id);
        if (status.status === 'done') { creatives = status.creatives || []; break; }
        if (status.status === 'failed') throw new Error(status.error || 'Generation failed.');
        if (++attempts >= MAX_POLL_ATTEMPTS) {
          throw new Error('Generation is taking longer than expected. Check the gallery shortly — it may still complete in the background.');
        }
      }

      const count = creatives.length;
      setShowInfo(`${count} creative${count !== 1 ? 's' : ''} generated and saved to the gallery.`);
    } catch (err) {
      const msg = err?.data?.error || err?.message || 'Generation failed. Please try again.';
      setShowInfo(`Error: ${msg}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-400" /> Prompt Studio
          </h1>
          <p className="text-slate-500 text-sm mt-1">Prompt-first static generation — tag brand assets directly in your text</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={handleGenerate}
          disabled={!isEditor || !prompt.trim() || !ratios.length || generating}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating ? 'Generating…' : 'Generate Static'}
        </motion.button>
      </div>

      {/* Generation settings — kept as one compact row so it doesn't compete for space with the prompt */}
      <div style={GLASS_STYLE} className="rounded-2xl p-5">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-2">Aspect Ratio</label>
            <div className="flex flex-wrap gap-1.5">
              {RATIO_OPTIONS.map((r) => {
                const active = ratios.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    title={r}
                    onClick={() => toggleRatio(r)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all ${active ? 'bg-blue-600 text-white shadow shadow-blue-600/20' : 'bg-white/4 border border-white/6 text-slate-500 hover:text-white hover:border-white/10'}`}
                  >
                    {r.split(' — ')[0]}
                  </button>
                );
              })}
            </div>
          </div>

          <ModelSelector value={model} onChange={setModel} />

          <CompactSelect label="Resolution" value={resolution} onChange={setResolution}>
            {RESOLUTION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </CompactSelect>

          <CompactSelect label="Output Format" value={format} onChange={setFormat}>
            {FORMAT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </CompactSelect>

          <CompactSelect label="Disclaimer" value={selectedDisclaimer} onChange={setSelectedDisclaimer}>
            <option value="">None</option>
            {disclaimers.map((d) => <option key={d.id} value={d.id}>{d.text?.substring(0, 40)}...</option>)}
          </CompactSelect>
        </div>
      </div>

      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -8, height: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/8 border border-blue-500/20 overflow-hidden"
          >
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
            <p className="text-xs text-slate-300 flex-1">{showInfo}</p>
            <button onClick={() => setShowInfo(null)} className="p-1 text-slate-500 hover:text-white transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalType === 'reference' && (
          <GalleryReferencePicker
            key="gallery-reference-picker"
            selected={selectedReferences}
            onClose={closePicker}
            onConfirm={(newSelected) => {
              const oldIds = new Set(selectedReferences.map((r) => String(r.id)));
              setSelectedReferences(newSelected);
              if (pendingMentionInsert === 'reference') {
                const added = newSelected.find((r) => !oldIds.has(String(r.id)));
                if (added) insertMention({ ...added, type: 'reference' });
              }
              setModalType(null);
              setPendingMentionInsert(null);
            }}
          />
        )}
        {modalType && modalType !== 'reference' && (
          <PickerModal
            key={modalType}
            type={TAG_TYPE_BY_KEY[modalType]}
            items={categoryConfig[modalType].items}
            selected={categoryConfig[modalType].selected}
            multi={categoryConfig[modalType].multi}
            emptyText={categoryConfig[modalType].emptyText}
            onClose={closePicker}
            onConfirm={confirmPicker}
          />
        )}
      </AnimatePresence>

      {/* Prompt composer */}
      <div style={GLASS_STYLE} className="rounded-2xl p-6">
        <SectionHeader
          icon={Sparkles}
          iconColor="bg-blue-500/10 border border-blue-500/15 text-blue-400"
          title="Prompt"
          desc="Describe the static you want — mention any asset you've added below and add extra detail right in the sentence"
        />

        <div className="relative h-52 rounded-xl border border-white/8 focus-within:border-blue-500/50 bg-[#0c0f1a] transition-all">
          <div
            ref={backdropRef}
            aria-hidden="true"
            className="absolute inset-0 px-4 py-3.5 text-sm leading-relaxed whitespace-pre-wrap break-words overflow-y-auto pointer-events-none"
          >
            {renderTaggedText(prompt)}
          </div>
          <textarea
            ref={promptRef}
            value={prompt}
            onChange={handlePromptChange}
            onKeyDown={handlePromptKeyDown}
            onScroll={syncScroll}
            onBlur={() => setTimeout(() => setMentionOpen(false), 150)}
            placeholder="A golden retriever jumping into a pool, holding &[CTA:Buy Now] in its mouth…"
            className="absolute inset-0 w-full h-full bg-transparent px-4 py-3.5 text-sm leading-relaxed outline-none resize-none placeholder:text-slate-600"
            style={{ color: 'transparent', caretColor: 'var(--text-primary)' }}
          />

          {mentionOpen && (
            <div className="absolute z-50 top-full left-0 mt-1.5 w-full max-w-sm bg-[#0c0f1a] border border-white/12 rounded-xl overflow-hidden shadow-xl shadow-black/40">
              <div className="px-3 py-2 border-b border-white/6 flex items-center gap-1.5">
                <span className="font-mono text-xs text-white">{mentionTrigger}</span>
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                  {mentionGroup.map(t => t.label).join(' · ')}
                </span>
              </div>
              {mentionMatches.length > 0 ? mentionMatches.map((item, i) => {
                const type = TAG_TYPE_BY_KEY[item.type];
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    onMouseDown={(e) => { e.preventDefault(); insertMention(item); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${i === mentionIdx ? 'bg-white/8 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                  >
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${type.iconBg}`}>
                      <type.icon className="w-2.5 h-2.5" />
                    </div>
                    <span className="text-xs font-bold truncate">{item.name}</span>
                    {mentionGroup.length > 1 && (
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-600 ml-auto shrink-0">{type.label}</span>
                    )}
                  </button>
                );
              }) : (
                <div className="px-3 py-2.5 text-[11px] text-slate-600">Nothing added yet — add one below.</div>
              )}
              <div className="border-t border-white/6">
                {mentionGroup.map((type) => (
                  <button
                    key={`add-${type.key}`}
                    onMouseDown={(e) => { e.preventDefault(); openPickerFromMention(type.key); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-slate-500 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${type.iconBg}`}>
                      <Plus className="w-2.5 h-2.5" />
                    </div>
                    <span className="text-xs font-bold">Add new {type.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Explainer */}
        <div className="mt-4 p-4 rounded-xl bg-white/3 border border-white/6">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-3.5 h-3.5 text-slate-500" />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">How tagging works</p>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-3">
            Only assets you've added to the boxes below can be mentioned. Type a trigger character anywhere in your prompt to search what you've added, or pick "Add new" right from the list to bring one in without leaving the prompt. Keep typing right after a tag to describe how that asset should appear.
          </p>
          <p className="text-xs leading-relaxed font-mono bg-black/20 border border-white/5 rounded-lg px-3 py-2.5">
            {renderTaggedText(EXAMPLE_PROMPT)}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {TAG_TYPES.map((t) => (
              <span key={t.key} className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full border ${t.chip}`}>
                <span className="font-mono text-xs leading-none normal-case">{t.trigger}</span> {t.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {(() => {
        const box = (key) => (
          <AddedBox
            key={key}
            typeKey={key}
            title={categoryConfig[key].title}
            desc={categoryConfig[key].desc}
            addedItems={getAdded(key)}
            loading={loading}
            onOpenPicker={() => openPicker(key)}
            onRemove={(id) => removeAdded(key, id)}
          />
        );
        return (
          <>
            {box('reference')}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {box('character')}
              {box('environment')}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {box('logo')}
              {box('cta')}
              {box('promo')}
            </div>
          </>
        );
      })()}

      {/* Brand identity — pick which preset applies here, or tweak it right in place */}
      <div style={GLASS_STYLE} className="rounded-2xl p-6">
        <SectionHeader
          icon={Pipette}
          iconColor="bg-blue-500/10 border border-blue-500/15 text-blue-400"
          title="Typography & Color Palette"
          desc="Pick a Brand Kit preset for this static — editing here updates it everywhere"
          action={(
            <Link to="/dashboard/brand-kit" className="flex items-center gap-1 text-[11px] font-black text-slate-500 hover:text-white transition-colors">
              Manage in Brand Kit <ArrowUpRight className="w-3 h-3" />
            </Link>
          )}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Typography */}
          <div className="p-4 border border-white/6 bg-white/3 rounded-xl">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1.5 mb-3">
              <Type className="w-3 h-3" /> Typography
            </span>
            {typographyPresets.length === 0 ? (
              <p className="text-[11px] text-slate-700">No typography presets yet — this static generates without one. <Link to="/dashboard/brand-kit" className="text-blue-400 hover:text-blue-300 font-bold">Create one in Brand Kit</Link>.</p>
            ) : (
              <>
                <div className="flex gap-2 overflow-x-auto pb-1 mb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <button
                    onClick={() => setSelectedTypographyId('none')}
                    className={`shrink-0 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all ${!activeTypography ? 'border-blue-400 bg-blue-500/10 text-white' : 'border-white/8 text-slate-500 hover:text-white hover:border-white/15'}`}
                  >
                    None
                  </button>
                  {typographyPresets.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTypographyId(t.id)}
                      className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all ${t.id === activeTypography?.id ? 'border-blue-400 bg-blue-500/10 text-white' : 'border-white/8 text-slate-500 hover:text-white hover:border-white/15'}`}
                    >
                      <span style={{ fontFamily: fontStack(t.heading), fontWeight: 800 }}>Aa</span>
                      {t.name}
                    </button>
                  ))}
                </div>
                {activeTypography && (
                  <div className="grid grid-cols-2 gap-3">
                    {['heading', 'body'].map((key) => (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{key === 'heading' ? 'Heading' : 'Body'}</span>
                          {isEditor && (
                            <select
                              value={activeTypography[key]}
                              onChange={(e) => setTypographyFont(activeTypography.id, key, e.target.value)}
                              className="text-[9px] font-bold bg-white/4 border border-white/8 rounded-md px-1 py-0.5 outline-none"
                            >
                              {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                            </select>
                          )}
                        </div>
                        <p className="text-2xl text-white truncate" style={{ fontFamily: fontStack(activeTypography[key]), fontWeight: key === 'heading' ? 800 : 400 }}>
                          Aa Bb
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Color Palette */}
          <div className="p-4 border border-white/6 bg-white/3 rounded-xl">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1.5 mb-3">
              <Pipette className="w-3 h-3" /> Color Palette
            </span>
            {palettePresets.length === 0 ? (
              <p className="text-[11px] text-slate-700">No color palettes yet — this static generates without one. <Link to="/dashboard/brand-kit" className="text-blue-400 hover:text-blue-300 font-bold">Create one in Brand Kit</Link>.</p>
            ) : (
              <>
                <div className="flex gap-2 overflow-x-auto pb-1 mb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <button
                    onClick={() => setSelectedPaletteId('none')}
                    className={`shrink-0 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all ${!activePalette ? 'border-blue-400 bg-blue-500/10 text-white' : 'border-white/8 text-slate-500 hover:text-white hover:border-white/15'}`}
                  >
                    None
                  </button>
                  {palettePresets.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPaletteId(p.id)}
                      className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all ${p.id === activePalette?.id ? 'border-blue-400 bg-blue-500/10 text-white' : 'border-white/8 text-slate-500 hover:text-white hover:border-white/15'}`}
                    >
                      <span className="flex -space-x-1">
                        {p.colors.slice(0, 4).map((c) => <span key={c.id} className="w-2.5 h-2.5 rounded-full border border-black/30" style={{ background: c.hex }} />)}
                      </span>
                      {p.name}
                    </button>
                  ))}
                </div>
                {activePalette && (
                  <div className="flex gap-3">
                    {activePalette.colors.map((c) => (
                      <div key={c.id} className="text-center">
                        <label className="block w-9 h-9 rounded-lg border border-white/10 mb-1.5 cursor-pointer relative overflow-hidden" style={{ background: c.hex }}>
                          {isEditor && (
                            <input
                              type="color"
                              value={c.hex}
                              onChange={(e) => setColorHex(activePalette.id, c.id, e.target.value)}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                          )}
                        </label>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-wider">{PALETTE_ROLES.find((r) => r.key === c.role)?.label || c.role}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PromptStudio() {
  return <PromptStudioPage />;
}
