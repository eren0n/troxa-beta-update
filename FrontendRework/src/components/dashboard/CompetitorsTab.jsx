import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Swords, Plus, Loader2, RefreshCw, Trash2, ExternalLink, AlertTriangle, Film, ImageOff, Layers, Clock, Wand2,
} from 'lucide-react';
import { competitorsApi } from '../../lib/api';
import { GLASS_STYLE } from '../ui/GlassCard';

// Followed rivals' Meta ads, read daily from the public Ad Library. Media is shown straight from
// Meta's CDN: those links are refreshed on every sync, so running ads always play, while an ad that
// has ended keeps its copy and stats but its picture can expire — the card falls back gracefully.

const SORTS = [
  { id: 'position',      label: 'Top reach' },
  { id: '-days_running', label: 'Longest running' },
  { id: '-start_date',   label: 'Newest' },
];
const STATUSES = [
  { id: 'true',  label: 'Running' },
  { id: 'false', label: 'Ended' },
  { id: '',      label: 'All' },
];
const FORMATS = [
  { id: '',         label: 'All formats' },
  { id: 'VIDEO',    label: 'Video' },
  { id: 'IMAGE',    label: 'Image' },
  { id: 'DCO',      label: 'Dynamic' },
  { id: 'CAROUSEL', label: 'Carousel' },
];
// An ad still paid for after a month is the nearest public signal that it works.
const PROVEN_DAYS = 30;
const PAGE_SIZE = 24;
// Where the ads ran, as the Ad Library filters it.
const COUNTRIES = [
  ['US', 'United States'], ['NG', 'Nigeria'], ['GH', 'Ghana'], ['KE', 'Kenya'], ['ZA', 'South Africa'],
  ['TZ', 'Tanzania'], ['UG', 'Uganda'], ['TR', 'Türkiye'], ['GB', 'United Kingdom'], ['IE', 'Ireland'],
  ['CA', 'Canada'], ['AU', 'Australia'], ['NZ', 'New Zealand'], ['DE', 'Germany'], ['FR', 'France'],
  ['ES', 'Spain'], ['IT', 'Italy'], ['NL', 'Netherlands'], ['SE', 'Sweden'], ['PL', 'Poland'],
  ['BR', 'Brazil'], ['MX', 'Mexico'], ['AR', 'Argentina'], ['CO', 'Colombia'], ['PE', 'Peru'],
  ['CL', 'Chile'], ['IN', 'India'], ['PH', 'Philippines'], ['ID', 'Indonesia'], ['AE', 'United Arab Emirates'],
  ['ALL', 'All countries'],
];

function timeAgo(iso) {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 bg-white/[0.03] border border-white/6 rounded-lg">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`px-3 py-1.5 rounded-md text-xs font-black transition-all ${value === o.id ? 'bg-blue-500/15 text-white' : 'text-slate-500 hover:text-slate-300'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CompetitorCard({ c, selected, onSelect, isEditor, onSync, onRemove }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect(); }}
      className={`group relative rounded-xl border p-4 cursor-pointer transition-all ${selected ? 'border-blue-500/40 bg-blue-500/10' : 'border-white/6 bg-white/[0.02] hover:border-white/12'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-black text-white text-sm truncate">{c.page_name || `Page ${c.page_id}`}</p>
          <p className="text-[11px] text-slate-600 mt-0.5 font-mono">{c.page_id} · {c.country === 'ALL' ? 'All countries' : c.country}</p>
        </div>
        {c.syncing ? (
          <span className="flex items-center gap-1 text-[10px] font-black text-blue-400 shrink-0">
            <Loader2 className="w-3 h-3 animate-spin" /> Syncing
          </span>
        ) : c.last_error ? (
          <span title={c.last_error} className="shrink-0"><AlertTriangle className="w-3.5 h-3.5 text-amber-400" /></span>
        ) : null}
      </div>

      <div className="flex items-baseline gap-3 mt-3 tabular-nums">
        <span className="text-xl font-black text-white">{c.active_ads ?? 0}</span>
        <span className="text-[11px] text-slate-500">running · {c.total_ads ?? 0} seen</span>
      </div>
      <p className="text-[11px] text-slate-600 mt-1">
        {c.syncing && !c.last_synced_at ? 'First read in progress…' : `Updated ${timeAgo(c.last_synced_at)}`}
      </p>

      <div className="flex items-center gap-1 mt-3" onClick={(e) => e.stopPropagation()}>
        <a href={c.ad_library_url} target="_blank" rel="noopener noreferrer" title="Open in Ad Library"
          className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all">
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
        {isEditor && (
          <>
            <button onClick={() => onSync(c)} disabled={c.syncing} title="Sync now"
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-all">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            {confirming ? (
              <span className="flex items-center gap-1 ml-auto">
                <button onClick={() => onRemove(c)} className="px-2 py-1 rounded-md text-[11px] font-black text-red-300 bg-red-500/15 hover:bg-red-500/25">Remove</button>
                <button onClick={() => setConfirming(false)} className="px-2 py-1 rounded-md text-[11px] font-black text-slate-400 hover:text-white">Keep</button>
              </span>
            ) : (
              <button onClick={() => setConfirming(true)} title="Stop following"
                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all ml-auto">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AdMedia({ ad }) {
  const [failed, setFailed] = useState(false);
  const first = ad.media?.[0];
  const extra = (ad.media?.length || 0) - 1;

  if (!first || failed) {
    return (
      <div className="aspect-square flex flex-col items-center justify-center gap-2 bg-white/[0.02] text-slate-600">
        <ImageOff className="w-6 h-6" />
        <span className="text-[11px] text-center px-6">
          {ad.is_active ? 'Media did not load' : 'Meta no longer serves this ad’s media'}
        </span>
      </div>
    );
  }
  return (
    <div className="relative aspect-square bg-black/40">
      {first.type === 'video' ? (
        <video src={first.url} poster={first.preview || undefined} controls muted playsInline preload="none"
          onError={() => setFailed(true)} className="w-full h-full object-contain" />
      ) : (
        <img src={first.url} alt="" loading="lazy" referrerPolicy="no-referrer"
          onError={() => setFailed(true)} className="w-full h-full object-contain" />
      )}
      {extra > 0 && (
        <span className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/70 text-[10px] font-black text-white">
          <Layers className="w-3 h-3" /> +{extra}
        </span>
      )}
    </div>
  );
}

function AdCard({ ad, showCompetitor, canAdapt, adapting, onAdapt }) {
  const proven = ad.days_running >= PROVEN_DAYS;
  const a = ad.analysis_status === 'done' ? ad.analysis : null;
  // Only image ads are read for now; videos come later.
  const hasImage = ad.media?.some((m) => m.type === 'image');
  return (
    <div style={GLASS_STYLE} className="rounded-2xl overflow-hidden flex flex-col">
      <AdMedia ad={ad} />
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          {ad.is_active && ad.position && (
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black text-slate-300 bg-white/5 tabular-nums" title="Rank by reach on the Ad Library">#{ad.position}</span>
          )}
          <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums border ${proven ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-slate-400 bg-white/5 border-transparent'}`}>
            <Clock className="w-3 h-3" /> {ad.days_running ?? '?'}d{ad.is_active ? '' : ' · ended'}
          </span>
          {ad.display_format && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black text-slate-500 bg-white/5">
              {ad.display_format === 'VIDEO' && <Film className="w-3 h-3" />}{ad.display_format.toLowerCase()}
            </span>
          )}
        </div>
        {showCompetitor && <p className="text-[11px] font-black text-blue-400 truncate">{ad.competitor_name}</p>}
        {ad.title && <p className="text-sm font-black text-white line-clamp-2">{ad.title}</p>}
        {ad.body && <p className="text-xs text-slate-400 line-clamp-4 whitespace-pre-line">{ad.body}</p>}
        {a && (
          <div className="rounded-lg bg-white/[0.03] border border-white/6 p-2.5 space-y-1">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{a.format}</p>
            <p className="text-xs text-slate-300 line-clamp-3"><span className="font-black text-white">Hook: </span>{a.hook}</p>
            {a.offer?.text && <p className="text-[11px] text-slate-500 line-clamp-2">Offer: {a.offer.text}</p>}
          </div>
        )}
        {canAdapt && hasImage && ad.analysis_status !== 'skipped' && (
          <button onClick={() => onAdapt(ad)} disabled={adapting}
            className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-all">
            {adapting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Writing our version…</> : <><Wand2 className="w-3.5 h-3.5" /> Make our version</>}
          </button>
        )}
        <div className="mt-auto pt-2 flex items-center justify-end gap-2">
          <a href={ad.ad_library_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-white shrink-0">
            Ad Library <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <p className="text-[10px] text-slate-600">
          Since {ad.start_date || '?'}{ad.platforms?.length ? ` · ${ad.platforms.map((p) => p.toLowerCase().replace('_', ' ')).join(', ')}` : ''}
        </p>
      </div>
    </div>
  );
}

export default function CompetitorsTab({ isEditor }) {
  const [competitors, setCompetitors] = useState(null);
  const [link, setLink] = useState('');
  const [country, setCountry] = useState('US');
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState(null);   // { msg, error }

  const [selected, setSelected] = useState('');  // competitor id, '' = all
  const [ordering, setOrdering] = useState('position');
  const [active, setActive] = useState('true');
  const [format, setFormat] = useState('');
  const [provenOnly, setProvenOnly] = useState(false);

  const [ads, setAds] = useState([]);
  const [count, setCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingAds, setLoadingAds] = useState(true);
  const adsRequest = useRef(0);
  const [adaptingId, setAdaptingId] = useState(null);
  const navigate = useNavigate();

  const say = (msg, error = false) => {
    setNotice({ msg, error });
    setTimeout(() => setNotice(null), 4000);
  };

  const loadCompetitors = useCallback(async () => {
    try { setCompetitors(await competitorsApi.list()); } catch { setCompetitors((c) => c || []); }
  }, []);

  const loadAds = useCallback(async (nextPage = 1) => {
    const ticket = ++adsRequest.current;
    setLoadingAds(true);
    try {
      const data = await competitorsApi.ads({
        competitor: selected, active, format, ordering,
        min_days: provenOnly ? PROVEN_DAYS : '', page: nextPage, page_size: PAGE_SIZE,
      });
      if (ticket !== adsRequest.current) return;   // a newer filter change won
      setAds((prev) => (nextPage === 1 ? data.results : [...prev, ...data.results]));
      setCount(data.count);
      setHasMore(data.has_more);
      setPage(nextPage);
    } catch {
      if (ticket === adsRequest.current && nextPage === 1) { setAds([]); setCount(0); setHasMore(false); }
    } finally {
      if (ticket === adsRequest.current) setLoadingAds(false);
    }
  }, [selected, active, format, ordering, provenOnly]);

  useEffect(() => { loadCompetitors(); }, [loadCompetitors]);
  useEffect(() => { loadAds(1); }, [loadAds]);

  // While any read is running, watch for it to finish, then show what it found.
  const anySyncing = competitors?.some((c) => c.syncing);
  const wasSyncing = useRef(false);
  useEffect(() => {
    if (wasSyncing.current && !anySyncing) loadAds(1);
    wasSyncing.current = anySyncing;
    if (!anySyncing) return undefined;
    const t = setInterval(loadCompetitors, 5000);
    return () => clearInterval(t);
  }, [anySyncing, loadCompetitors, loadAds]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!link.trim()) return;
    setAdding(true);
    try {
      const c = await competitorsApi.add(link.trim(), country);
      setCompetitors((prev) => [...(prev || []), c]);
      setLink('');
      say('Added — reading and analysing their ads now. This takes a few minutes.');
    } catch (err) {
      say(err.message, true);
    } finally {
      setAdding(false);
    }
  };

  const handleSync = async (c) => {
    try {
      await competitorsApi.sync(c.id);
      setCompetitors((prev) => prev.map((x) => (x.id === c.id ? { ...x, syncing: true } : x)));
    } catch (err) {
      say(err.message, true);
    }
  };

  // Turn one rival ad into an idea for our brand, then open Generate with it selected.
  const handleAdapt = async (ad) => {
    setAdaptingId(ad.id);
    try {
      const idea = await competitorsApi.adapt(ad.id);
      navigate('/dashboard/create-v2', { state: { competitorIdea: idea } });
    } catch (err) {
      say(err.message, true);
      setAdaptingId(null);
    }
  };

  const handleRemove = async (c) => {
    try {
      await competitorsApi.remove(c.id);
      setCompetitors((prev) => prev.filter((x) => x.id !== c.id));
      if (String(selected) === String(c.id)) setSelected('');
      else loadAds(1);
    } catch (err) {
      say(err.message, true);
    }
  };

  const filtersActive = format || provenOnly || active !== 'true';

  return (
    <motion.div key="competitors" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
      <AnimatePresence>
        {notice && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-xl border ${notice.error ? 'bg-red-900/80 border-red-500/30 text-red-200' : 'bg-emerald-900/80 border-emerald-500/30 text-emerald-200'}`}>
            {notice.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={GLASS_STYLE} className="rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
              <Swords className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-white">Competitors</h3>
              <p className="text-[11px] text-slate-600 mt-0.5">Their running Meta ads, refreshed daily from the Ad Library</p>
            </div>
          </div>
          {isEditor && (
            <form onSubmit={handleAdd} className="flex flex-wrap sm:flex-nowrap gap-2 w-full lg:w-auto">
              <input
                value={link}
                onChange={(e) => {
                  setLink(e.target.value);
                  // a pasted Ad Library link already says which country it shows
                  const m = e.target.value.match(/[?&]country=([A-Za-z]{2,3})\b/);
                  if (m && COUNTRIES.some(([code]) => code === m[1].toUpperCase())) setCountry(m[1].toUpperCase());
                }}
                placeholder="Facebook page ID or Ad Library link"
                className="w-full sm:w-auto sm:flex-1 lg:w-72 min-w-0 px-3.5 py-2.5 bg-white/[0.03] border border-white/8 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40"
              />
              <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country"
                className="flex-1 sm:flex-none min-w-0 px-2.5 py-2.5 bg-white/[0.03] border border-white/8 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500/40">
                {COUNTRIES.map(([code, name]) => <option key={code} value={code}>{code === 'ALL' ? name : `${code} · ${name}`}</option>)}
              </select>
              <button type="submit" disabled={adding || !link.trim()}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl font-black text-sm transition-all shrink-0">
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Follow
              </button>
            </form>
          )}
        </div>

        {competitors === null ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
        ) : competitors.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">
            No competitors yet. Paste a page ID, or an Ad Library link that contains <span className="font-mono text-slate-400">view_all_page_id</span>.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {competitors.map((c) => (
              <CompetitorCard
                key={c.id} c={c} isEditor={isEditor}
                selected={String(selected) === String(c.id)}
                onSelect={() => setSelected(String(selected) === String(c.id) ? '' : c.id)}
                onSync={handleSync} onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </div>

      {competitors?.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented options={SORTS} value={ordering} onChange={setOrdering} />
            <Segmented options={STATUSES} value={active} onChange={setActive} />
            <select value={format} onChange={(e) => setFormat(e.target.value)}
              className="px-3 py-1.5 bg-white/[0.03] border border-white/6 rounded-lg text-xs font-black text-slate-300 focus:outline-none">
              {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
            <button onClick={() => setProvenOnly((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black border transition-all ${provenOnly ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' : 'text-slate-500 border-white/6 hover:text-slate-300'}`}>
              <Clock className="w-3.5 h-3.5" /> Running {PROVEN_DAYS}+ days
            </button>
            <span className="ml-auto text-xs text-slate-500 tabular-nums">
              {count} ad{count === 1 ? '' : 's'}
              {selected && ` · ${competitors.find((c) => String(c.id) === String(selected))?.page_name || 'one competitor'}`}
            </span>
          </div>

          {loadingAds && ads.length === 0 ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>
          ) : ads.length === 0 ? (
            <div style={GLASS_STYLE} className="rounded-2xl p-10 text-center text-sm text-slate-500">
              {anySyncing ? 'Reading the Ad Library — ads will appear here when it finishes.'
                : filtersActive ? 'No ads match these filters.' : 'No running ads found.'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {ads.map((ad) => (
                  <AdCard key={ad.id} ad={ad} showCompetitor={!selected} canAdapt={isEditor}
                    adapting={adaptingId === ad.id} onAdapt={handleAdapt} />
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center">
                  <button onClick={() => loadAds(page + 1)} disabled={loadingAds}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-slate-300 border border-white/8 hover:text-white hover:border-white/15 disabled:opacity-40 transition-all">
                    {loadingAds && <Loader2 className="w-4 h-4 animate-spin" />} Show more
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}
