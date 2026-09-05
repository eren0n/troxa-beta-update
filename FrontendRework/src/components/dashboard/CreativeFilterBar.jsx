import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getPortalRoot } from '../../lib/portalRoot';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Filter, ChevronDown, X, ArrowUpDown, Check } from 'lucide-react';
import { GLASS_STYLE } from '../ui/GlassCard';
import TagBadge from './TagBadge';

export const SOURCE_OPTIONS = [
  { id: '', label: 'All' },
  { id: 'troxa_generated', label: 'Troxa Generated' },
  { id: 'uploaded', label: 'Uploaded' },
];

export const MEDIA_TYPE_OPTIONS = [
  { id: '', label: 'All' },
  { id: 'Photo', label: 'Image' },
  { id: 'Video', label: 'Video' },
];

export const EDIT_STATUS_OPTIONS = [
  { id: '', label: 'All' },
  { id: 'true', label: 'Edited' },
  { id: 'false', label: 'Unedited' },
];

export const SORT_OPTIONS = [
  { id: '-created_at', label: 'Newest' },
  { id: 'created_at', label: 'Oldest' },
  { id: '-rating', label: 'Top Rated' },
  { id: 'rating', label: 'Lowest Rated' },
];

const ASPECT_RATIO_OPTIONS = ['1:1', '4:5', '9:16', '16:9'];

export const EMPTY_CREATIVE_FILTERS = {
  search: '', source: '', mediaType: '', isEdited: '', campaignId: '',
  tags: [], ratingMin: '', ratingMax: '', dateFrom: '', dateTo: '', aspectRatio: '', generatedBy: [],
  sort: '-created_at',
};

function Segmented({ options, value, onChange, label }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {label && <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 hidden xl:inline">{label}</span>}
      <div className="flex items-center gap-1 p-1 bg-black/30 border border-white/8 rounded-xl">
        {options.map(opt => (
          <button key={opt.id} onClick={() => onChange(opt.id)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
              value === opt.id ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}>{opt.label}</button>
        ))}
      </div>
    </div>
  );
}

// Shared single-select floating dropdown — used by Sort, Campaign, and Aspect
// Ratio so all three look and behave identically. Portaled to <body> with
// fixed positioning computed from the trigger's rect (same fix as TagPicker)
// since Campaign/Aspect Ratio live inside the scrollable "More Filters"
// panel and a normal absolute dropdown would get clipped by its overflow.
function PanelSelect({ value, options, onChange, placeholder, icon: Icon, variant = 'bar', panelWidth = 208, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const selected = options.find(o => o.id === value);

  const triggerClassName = variant === 'bar'
    ? `flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all ${
        open ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-zinc-900 border-white/5 text-gray-400 hover:text-white hover:border-white/15'
      }`
    : 'w-full flex items-center justify-between gap-2 bg-(--bg-input) border border-(--border-default) hover:border-(--border-strong) text-(--text-primary) rounded-lg py-2 px-3 text-xs font-bold outline-none focus:border-(--accent) transition-all cursor-pointer';

  const updatePosition = () => {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const left = align === 'right' ? rect.right - panelWidth : rect.left;
    setPos({ top: rect.bottom + 6, left });
  };

  const toggle = () => { if (!open) updatePosition(); setOpen(v => !v); };

  useEffect(() => {
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

  return (
    <div className="relative shrink-0">
      <button type="button" ref={btnRef} onClick={toggle} className={triggerClassName}>
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
        <span className="truncate">{selected?.label || placeholder}</span>
        <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <>
              <div className="fixed inset-0 z-9998" onClick={() => setOpen(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 6 }}
                className="fixed max-h-56 overflow-y-auto backdrop-blur-xl border border-(--border-default) rounded-xl shadow-2xl z-9999 p-1.5 space-y-0.5"
                style={{ background: 'var(--dropdown-bg)', top: pos.top, left: pos.left, width: panelWidth }}
              >
                {options.map(o => (
                  <button key={o.id} type="button"
                    onClick={() => { onChange(o.id); setOpen(false); }}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-(--bg-hover) transition-colors text-left">
                    <span className={`text-xs font-bold truncate ${value === o.id ? 'text-(--accent)' : 'text-(--text-secondary)'}`}>{o.label}</span>
                    {value === o.id && <Check className="w-3.5 h-3.5 text-(--accent) shrink-0" />}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        getPortalRoot()
      )}
    </div>
  );
}

const personTriggerClass = 'w-full flex items-center gap-2 bg-(--bg-input) border border-(--border-subtle) rounded-lg px-2.5 py-1.5 text-xs outline-none focus-within:border-(--accent) transition-all cursor-text flex-wrap min-h-8.5';

// Multi-select "Generated By" picker — selected people render as removable
// chips inside the field (OR semantics: matches creatives made by any of
// them), and typing filters the remaining contributors to add another.
// Portaled to <body> for the same overflow-clipping reason as PanelSelect.
function PeoplePicker({ value, options, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState(null);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const selectedPeople = value.map(id => options.find(o => o.id === id)).filter(Boolean);
  const available = options.filter(o => !value.includes(o.id));
  const filtered = query.trim()
    ? available.filter(o => o.name.toLowerCase().includes(query.trim().toLowerCase()))
    : available;

  const updatePosition = () => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  };

  const openList = () => { updatePosition(); setOpen(true); };

  useEffect(() => {
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

  const addPerson = (id) => {
    onChange([...value, id]);
    setQuery('');
    inputRef.current?.focus();
  };
  const removePerson = (id) => onChange(value.filter(v => v !== id));

  return (
    <div className="relative">
      <div ref={wrapRef} onClick={openList} className={personTriggerClass}>
        {selectedPeople.map(p => (
          <span key={p.id} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-(--accent-muted) text-(--accent) text-[10px] font-bold whitespace-nowrap">
            {p.name}
            <button type="button" onClick={(e) => { e.stopPropagation(); removePerson(p.id); }} className="hover:opacity-70 transition-opacity">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); openList(); }}
          onFocus={openList}
          onKeyDown={e => {
            if (e.key === 'Backspace' && !query && selectedPeople.length > 0) {
              removePerson(selectedPeople[selectedPeople.length - 1].id);
            }
          }}
          placeholder={selectedPeople.length === 0 ? placeholder : ''}
          className="flex-1 min-w-16 bg-transparent text-(--text-primary) text-xs outline-none py-0.5"
        />
      </div>
      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <>
              <div className="fixed inset-0 z-9998" onClick={() => setOpen(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 6 }}
                className="fixed max-h-48 overflow-y-auto backdrop-blur-xl border border-(--border-default) rounded-xl shadow-2xl z-9999 p-1.5 space-y-0.5"
                style={{ background: 'var(--dropdown-bg)', top: pos.top, left: pos.left, width: pos.width }}
              >
                {options.length === 0 ? (
                  <p className="px-2.5 py-2 text-[11px] text-(--text-muted)">No one to filter by yet.</p>
                ) : filtered.length === 0 ? (
                  <p className="px-2.5 py-2 text-[11px] text-(--text-muted)">{available.length === 0 ? 'Everyone is already added' : 'No matches'}</p>
                ) : filtered.map(o => (
                  <button key={o.id} type="button"
                    onClick={() => addPerson(o.id)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-(--bg-hover) transition-colors text-left">
                    <span className="text-xs font-bold text-(--text-secondary) truncate">{o.name}</span>
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        getPortalRoot()
      )}
    </div>
  );
}

export default function CreativeFilterBar({
  filters,
  onChange,
  campaignsList = [],
  allTags = [],
  contributorsList = [],
  showSearch = true,
  showMediaType = true,
  searchPlaceholder = 'Search by name or campaign...',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const f = { ...EMPTY_CREATIVE_FILTERS, ...filters };
  const patch = (p) => onChange({ ...f, ...p });

  // Local draft so typing feels instant while the actual filter change
  // (which triggers a server request) is debounced.
  const [searchDraft, setSearchDraft] = useState(f.search);
  useEffect(() => { setSearchDraft(f.search); }, [f.search]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchDraft !== f.search) patch({ search: searchDraft });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  const toggleTag = (id) => {
    patch({ tags: f.tags.includes(id) ? f.tags.filter(t => t !== id) : [...f.tags, id] });
  };

  const moreFilterCount = ['campaignId', 'aspectRatio', 'ratingMin', 'ratingMax', 'dateFrom', 'dateTo']
    .filter(k => f[k]).length + f.tags.length + f.generatedBy.length;
  const activeFilterCount = moreFilterCount + (f.source ? 1 : 0) + (showMediaType && f.mediaType ? 1 : 0) + (f.isEdited ? 1 : 0);

  const clearAll = () => onChange({ ...EMPTY_CREATIVE_FILTERS, search: showSearch ? f.search : '', sort: f.sort, mediaType: showMediaType ? '' : f.mediaType });

  const campaignName = f.campaignId ? campaignsList.find(c => c.id === f.campaignId)?.name : null;

  const campaignOptions = [{ id: '', label: 'All Campaigns' }, ...campaignsList.map(c => ({ id: c.id, label: c.name }))];
  const aspectRatioOptions = [{ id: '', label: 'All Ratios' }, ...ASPECT_RATIO_OPTIONS.map(r => ({ id: r, label: r }))];

  const filtersButtonClass = `flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all ${
    isOpen || moreFilterCount > 0
      ? 'bg-blue-600/10 border-blue-500 text-blue-400'
      : 'bg-zinc-900 border-white/5 text-gray-400 hover:text-white hover:border-white/15'
  }`;

  return (
    <div className="space-y-3">
      <div style={GLASS_STYLE} className="relative z-20 flex flex-col lg:flex-row items-stretch lg:items-center gap-3 p-2 rounded-2xl">
        {showSearch && (
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" value={searchDraft} onChange={e => setSearchDraft(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-black border border-white/5 rounded-xl py-2.5 pl-12 pr-4 text-sm text-white placeholder:text-gray-700 outline-none focus:border-blue-500/30 transition-all font-medium" />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <Segmented label="Source" options={SOURCE_OPTIONS} value={f.source} onChange={(v) => patch({ source: v })} />
          {showMediaType && (
            <Segmented label="Type" options={MEDIA_TYPE_OPTIONS} value={f.mediaType} onChange={(v) => patch({ mediaType: v })} />
          )}
          <Segmented label="Edit" options={EDIT_STATUS_OPTIONS} value={f.isEdited} onChange={(v) => patch({ isEdited: v })} />

          <PanelSelect
            value={f.sort}
            options={SORT_OPTIONS}
            onChange={(v) => patch({ sort: v })}
            placeholder="Sort"
            icon={ArrowUpDown}
            variant="bar"
            panelWidth={192}
            align="right"
          />

          <div className="relative shrink-0">
            <button onClick={() => setIsOpen(v => !v)}
              className={filtersButtonClass}>
              <Filter className="w-4 h-4" /> Filters
              {moreFilterCount > 0 && <span className="bg-blue-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-black">{moreFilterCount}</span>}
              <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {isOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)} />
                  <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute right-0 top-full mt-2 w-72 max-h-[70vh] overflow-y-auto backdrop-blur-xl border border-(--border-default) rounded-2xl shadow-2xl z-30 p-5 space-y-4 text-left"
                    style={{ background: 'var(--dropdown-bg)' }}>
                    <div className="flex items-center justify-between border-b border-(--border-subtle) pb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-(--text-secondary)">More Filters</span>
                      {moreFilterCount > 0 && (
                        <button onClick={() => patch({ campaignId: '', aspectRatio: '', ratingMin: '', ratingMax: '', dateFrom: '', dateTo: '', generatedBy: [], tags: [] })}
                          className="text-[10px] font-bold text-red-400 hover:text-red-300 uppercase">Clear</button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-(--text-muted)">Campaign</p>
                      <PanelSelect
                        value={f.campaignId}
                        options={campaignOptions}
                        onChange={(v) => patch({ campaignId: v })}
                        placeholder="All Campaigns"
                        variant="panel"
                        panelWidth={248}
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-(--text-muted)">Aspect Ratio</p>
                      <PanelSelect
                        value={f.aspectRatio}
                        options={aspectRatioOptions}
                        onChange={(v) => patch({ aspectRatio: v })}
                        placeholder="All Ratios"
                        variant="panel"
                        panelWidth={248}
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-(--text-muted)">Generated By <span className="text-(--text-faint) normal-case">(any of the selected)</span></p>
                      <PeoplePicker
                        value={f.generatedBy}
                        options={contributorsList}
                        onChange={(ids) => patch({ generatedBy: ids })}
                        placeholder="Search team member..."
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-(--text-muted)">Rating <span className="text-(--text-faint) normal-case">(1–10)</span></p>
                      <div className="flex items-center gap-2">
                        <input type="number" min={1} max={10} value={f.ratingMin} onChange={e => patch({ ratingMin: e.target.value })}
                          placeholder="Min" className="w-full bg-(--bg-input) border border-(--border-subtle) text-(--text-primary) rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-(--accent) transition-all" />
                        <span className="text-(--text-muted) text-xs">–</span>
                        <input type="number" min={1} max={10} value={f.ratingMax} onChange={e => patch({ ratingMax: e.target.value })}
                          placeholder="Max" className="w-full bg-(--bg-input) border border-(--border-subtle) text-(--text-primary) rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-(--accent) transition-all" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-(--text-muted)">Date Range</p>
                      <div className="flex items-center gap-2">
                        <input type="date" value={f.dateFrom} onChange={e => patch({ dateFrom: e.target.value })}
                          className="w-full bg-(--bg-input) border border-(--border-subtle) text-(--text-primary) rounded-lg px-2 py-1.5 text-[10px] outline-none focus:border-(--accent) transition-all" />
                        <input type="date" value={f.dateTo} onChange={e => patch({ dateTo: e.target.value })}
                          className="w-full bg-(--bg-input) border border-(--border-subtle) text-(--text-primary) rounded-lg px-2 py-1.5 text-[10px] outline-none focus:border-(--accent) transition-all" />
                      </div>
                    </div>

                    {allTags.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-(--text-muted)">Tags <span className="text-(--text-faint) normal-case">(must have all selected)</span></p>
                        <div className="flex flex-wrap gap-1.5">
                          {allTags.map(tag => (
                            <button key={tag.id} onClick={() => toggleTag(tag.id)}>
                              <TagBadge tag={tag} size={f.tags.includes(tag.id) ? 'sm' : 'xs'} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 justify-start">
          {f.source && (
            <span onClick={() => patch({ source: '' })} className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 rounded-full text-[10px] font-bold text-blue-400 cursor-pointer">
              {SOURCE_OPTIONS.find(o => o.id === f.source)?.label} <X className="w-3 h-3" />
            </span>
          )}
          {showMediaType && f.mediaType && (
            <span onClick={() => patch({ mediaType: '' })} className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 rounded-full text-[10px] font-bold text-blue-400 cursor-pointer">
              {MEDIA_TYPE_OPTIONS.find(o => o.id === f.mediaType)?.label} <X className="w-3 h-3" />
            </span>
          )}
          {f.isEdited && (
            <span onClick={() => patch({ isEdited: '' })} className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 rounded-full text-[10px] font-bold text-blue-400 cursor-pointer">
              {EDIT_STATUS_OPTIONS.find(o => o.id === f.isEdited)?.label} <X className="w-3 h-3" />
            </span>
          )}
          {campaignName && (
            <span onClick={() => patch({ campaignId: '' })} className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/5 border border-blue-500/10 rounded-full text-[10px] font-bold text-blue-400 cursor-pointer">
              Campaign: {campaignName} <X className="w-3 h-3" />
            </span>
          )}
          {f.aspectRatio && (
            <span onClick={() => patch({ aspectRatio: '' })} className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/5 border border-blue-500/10 rounded-full text-[10px] font-bold text-blue-400 cursor-pointer">
              {f.aspectRatio} <X className="w-3 h-3" />
            </span>
          )}
          {f.generatedBy.map(id => {
            const person = contributorsList.find(c => c.id === id);
            if (!person) return null;
            return (
              <span key={id} onClick={() => patch({ generatedBy: f.generatedBy.filter(v => v !== id) })} className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/5 border border-blue-500/10 rounded-full text-[10px] font-bold text-blue-400 cursor-pointer">
                By: {person.name} <X className="w-3 h-3" />
              </span>
            );
          })}
          {(f.ratingMin || f.ratingMax) && (
            <span onClick={() => patch({ ratingMin: '', ratingMax: '' })} className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/5 border border-blue-500/10 rounded-full text-[10px] font-bold text-blue-400 cursor-pointer">
              Rating: {f.ratingMin || 1}-{f.ratingMax || 10} <X className="w-3 h-3" />
            </span>
          )}
          {(f.dateFrom || f.dateTo) && (
            <span onClick={() => patch({ dateFrom: '', dateTo: '' })} className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/5 border border-blue-500/10 rounded-full text-[10px] font-bold text-blue-400 cursor-pointer">
              Date: {f.dateFrom || '…'} → {f.dateTo || '…'} <X className="w-3 h-3" />
            </span>
          )}
          {f.tags.map(id => {
            const tag = allTags.find(t => t.id === id);
            if (!tag) return null;
            return <TagBadge key={id} tag={tag} onRemove={() => toggleTag(id)} />;
          })}
          <button onClick={clearAll} className="text-[10px] text-gray-500 hover:text-red-400 font-bold ml-1">Clear All</button>
        </div>
      )}
    </div>
  );
}
