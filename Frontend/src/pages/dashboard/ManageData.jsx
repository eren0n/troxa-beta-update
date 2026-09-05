import { useState, useEffect, useCallback, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { dataLabApi } from '../../lib/api';
import {
  Database, RefreshCw, Download, X, ChevronLeft, ChevronRight,
  Loader2, CheckCircle, Clock, AlertCircle, Search, Filter,
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n, decimals = 0) {
  if (n == null) return '—';
  const num = Number(n);
  if (isNaN(num)) return '—';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return decimals > 0 ? num.toFixed(decimals) : String(Math.round(num));
}

function fmtMoney(n) {
  if (n == null) return '—';
  const num = Number(n);
  if (isNaN(num)) return '—';
  return `$${num.toFixed(2)}`;
}

function fmtPct(n) {
  if (n == null) return '—';
  return `${(Number(n) * 100).toFixed(2)}%`;
}

const STATUS_COLORS = {
  ACTIVE: 'text-green-400 bg-green-500/10 border-green-500/20',
  PAUSED: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  ARCHIVED: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  DELETED: 'text-red-400 bg-red-500/10 border-red-500/20',
};

// ─── Metric Grid ─────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }) {
  return (
    <div className="bg-white/3 border border-white/6 rounded-xl p-3">
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-lg font-black text-white">{value}</p>
      {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
    </div>
  );
}

function MetricsPanel({ ad }) {
  return (
    <div className="space-y-4">
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Atomic Metrics</p>
      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="Spend" value={fmtMoney(ad.spend)} />
        <MetricCard label="Revenue" value={fmtMoney(ad.revenue)} sub={`ROAS: ${ad.roas ? ad.roas.toFixed(2) : '—'}`} />
        <MetricCard label="Impressions" value={fmt(ad.impressions)} sub={`Reach: ${fmt(ad.reach)}`} />
        <MetricCard label="Clicks" value={fmt(ad.clicks)} sub={`CTR: ${fmtPct(ad.ctr)}`} />
        <MetricCard label="Registrations" value={fmt(ad.regs)} sub={ad.cost_per_reg ? `CPR: ${fmtMoney(ad.cost_per_reg)}` : null} />
        <MetricCard label="Purchases" value={fmt(ad.purchases)} sub={ad.cost_per_purchase ? `CPP: ${fmtMoney(ad.cost_per_purchase)}` : null} />
        <MetricCard label="FTP" value={ad.ftp != null ? fmt(ad.ftp) : 'N/A'} sub={ad.cost_per_ftp ? `CPFTP: ${fmtMoney(ad.cost_per_ftp)}` : null} />
        <MetricCard label="Reg → Purchase" value={ad.reg_to_purchase ? fmtPct(ad.reg_to_purchase) : '—'} />
      </div>
      {ad.objective && (
        <div className="bg-white/2 border border-white/5 rounded-xl p-3 space-y-1.5">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Campaign Context</p>
          <p className="text-xs text-slate-300"><span className="text-slate-500">Objective:</span> {ad.objective}</p>
          {ad.campaign_name && <p className="text-xs text-slate-300"><span className="text-slate-500">Campaign:</span> {ad.campaign_name}</p>}
          {ad.adset_name && <p className="text-xs text-slate-300"><span className="text-slate-500">Ad Set:</span> {ad.adset_name}</p>}
          {ad.daily_budget && <p className="text-xs text-slate-300"><span className="text-slate-500">Daily Budget:</span> {fmtMoney(ad.daily_budget)}</p>}
          {ad.lifetime_budget && <p className="text-xs text-slate-300"><span className="text-slate-500">Lifetime Budget:</span> {fmtMoney(ad.lifetime_budget)}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Rating Buttons ──────────────────────────────────────────────────────────

function RatingInput({ label, value, onChange }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-8 h-8 rounded-lg text-xs font-black transition-all border ${
              value === n
                ? 'bg-blue-500 border-blue-400 text-white shadow-[0_0_8px_rgba(59,130,246,0.4)]'
                : 'bg-white/5 border-white/8 text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Media hook: returns {type, src, poster} for image or video creatives ────

function useAdMedia(adId) {
  const [media, setMedia] = useState({ type: null, src: null, poster: null });
  const prevBlobUrl = useRef(null);

  useEffect(() => {
    if (!adId) { setMedia({ type: null, src: null, poster: null }); return; }
    setMedia({ type: null, src: null, poster: null });
    const token = localStorage.getItem('access_token');
    const wsId = localStorage.getItem('active_workspace_id');
    const headers = {
      Authorization: `Bearer ${token}`,
      ...(wsId ? { 'X-Workspace-ID': wsId } : {}),
    };
    let cancelled = false;

    fetch(`/api/data-lab/ads/${adId}/media/`, { headers })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(info => {
        if (cancelled) return;
        if (info.media_type === 'video') {
          setMedia({ type: 'video', src: info.video_url, poster: info.poster_url || null });
        } else if (info.media_type === 'image') {
          return fetch(`/api/data-lab/ads/${adId}/image/`, { headers })
            .then(r => r.ok ? r.blob() : Promise.reject())
            .then(blob => {
              if (cancelled) return;
              const url = URL.createObjectURL(blob);
              if (prevBlobUrl.current) URL.revokeObjectURL(prevBlobUrl.current);
              prevBlobUrl.current = url;
              setMedia({ type: 'image', src: url, poster: null });
            });
        }
      })
      .catch(() => { if (!cancelled) setMedia({ type: 'none', src: null, poster: null }); });

    return () => { cancelled = true; };
  }, [adId]);

  return media;
}

// ─── Detail / Annotation Panel ───────────────────────────────────────────────

function AnnotationPanel({ ad: initialAd, onClose, onSaved, onPrev, onNext, hasPrev, hasNext }) {
  const [ad, setAd] = useState(initialAd);
  const adMedia = useAdMedia(ad.id);
  const [form, setForm] = useState({
    target_audience: initialAd.target_audience || '',
    notes: initialAd.notes || '',
    personal_rating: initialAd.personal_rating ?? null,
    success_rating: initialAd.success_rating ?? null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setAd(initialAd);
    setForm({
      target_audience: initialAd.target_audience || '',
      notes: initialAd.notes || '',
      personal_rating: initialAd.personal_rating ?? null,
      success_rating: initialAd.success_rating ?? null,
    });
    setSaved(false);
    setError('');
  }, [initialAd.id]);

  const handleSave = async () => {
    if (!form.target_audience.trim()) {
      setError('Target audience is required.');
      return;
    }
    if (!form.personal_rating || !form.success_rating) {
      setError('Both ratings are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await dataLabApi.annotate(ad.id, form);
      setAd(updated);
      setSaved(true);
      onSaved(updated);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-black/70 backdrop-blur-sm">
      <div className="flex w-full max-w-6xl mx-auto my-4 mx-4 bg-[#0a0d14] border border-white/8 rounded-2xl overflow-hidden shadow-2xl">

        {/* Left: Creative Image */}
        <div className="w-[45%] shrink-0 bg-black/40 flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div className="min-w-0">
              <p className="text-xs font-black text-white truncate">{ad.ad_name || ad.ad_id}</p>
              <p className="text-[10px] text-slate-500">{ad.ad_id}</p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/8 rounded-lg transition-colors ml-3 shrink-0">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
            {adMedia.type === 'video' && adMedia.src ? (
              <video
                key={adMedia.src}
                src={adMedia.src}
                poster={adMedia.poster || undefined}
                controls
                playsInline
                className="max-w-full max-h-full rounded-xl"
                style={{ maxHeight: '100%' }}
              />
            ) : adMedia.type === 'image' && adMedia.src ? (
              <img
                src={adMedia.src}
                alt={ad.ad_name}
                className="max-w-full max-h-full object-contain rounded-xl"
              />
            ) : adMedia.type === null ? (
              <div className="w-full aspect-square bg-white/5 rounded-xl flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-slate-600 animate-spin" />
              </div>
            ) : ad.creative_image_url ? (
              <img
                src={ad.creative_image_url}
                alt={ad.ad_name}
                className="max-w-full max-h-full object-contain rounded-xl"
              />
            ) : (
              <div className="w-full aspect-square bg-white/5 rounded-xl flex items-center justify-center">
                <Database className="w-12 h-12 text-slate-700" />
              </div>
            )}
          </div>
          {/* Nav */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <button
              onClick={onPrev}
              disabled={!hasPrev}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className={`text-[10px] px-2 py-1 rounded-full border font-black ${ad.is_labeled ? 'text-green-400 bg-green-500/10 border-green-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'}`}>
              {ad.is_labeled ? 'Labeled' : 'Pending'}
            </span>
            <button
              onClick={onNext}
              disabled={!hasNext}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Metrics + Form */}
        <div className="flex-1 flex flex-col overflow-hidden border-l border-white/5">
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <MetricsPanel ad={ad} />

            <div className="h-px bg-white/5" />

            {/* Annotation form */}
            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Annotation</p>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Target Audience <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={form.target_audience}
                  onChange={e => setForm(f => ({ ...f, target_audience: e.target.value }))}
                  placeholder="Who is this creative aimed at? (e.g. US, 25-55, interest = online casino)"
                  rows={3}
                  className="w-full bg-black/30 border border-white/8 focus:border-blue-500/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none resize-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes / Assessment</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Qualitative notes about this creative..."
                  rows={3}
                  className="w-full bg-black/30 border border-white/8 focus:border-blue-500/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none resize-none transition-colors"
                />
              </div>

              <RatingInput
                label="Personal Rating (1-10)"
                value={form.personal_rating}
                onChange={v => setForm(f => ({ ...f, personal_rating: v }))}
              />

              <RatingInput
                label="Success Rating (1-10)"
                value={form.success_rating}
                onChange={v => setForm(f => ({ ...f, success_rating: v }))}
              />
            </div>
          </div>

          {/* Save bar */}
          <div className="shrink-0 border-t border-white/5 px-5 py-4 flex items-center gap-3">
            {error && <p className="text-xs text-red-400 flex-1">{error}</p>}
            {saved && <p className="text-xs text-green-400 flex-1 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Saved</p>}
            {!error && !saved && <div className="flex-1" />}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/50 text-white text-xs font-black rounded-xl transition-all"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sync Modal ───────────────────────────────────────────────────────────────

function SyncModal({ onClose, onDone }) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleSync = async () => {
    setSyncing(true);
    setError('');
    setResult(null);
    try {
      const res = await dataLabApi.sync();
      setResult(res);
      onDone();
    } catch (e) {
      setError(e.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0a0d14] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-white">Sync from Meta</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/8 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <p className="text-xs text-slate-500">Fetches all ads, downloads creatives, and updates metrics. Uses the same account as the Meta Ads tab.</p>

        {error && <p className="text-xs text-red-400">{error}</p>}
        {result && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 space-y-1">
            <p className="text-xs font-black text-green-400">Sync complete</p>
            <p className="text-[11px] text-slate-400">Synced: {result.synced} ads · Created: {result.created} · Updated: {result.updated}</p>
          </div>
        )}

        <button
          onClick={handleSync}
          disabled={syncing}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/50 text-white text-xs font-black rounded-xl transition-all"
        >
          {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {syncing ? 'Syncing...' : 'Start Sync'}
        </button>
      </div>
    </div>
  );
}

// ─── Export Modal ─────────────────────────────────────────────────────────────

function ExportModal({ total, onClose }) {
  const [minSuccess, setMinSuccess] = useState('');
  const [minPersonal, setMinPersonal] = useState('');
  const [fmt, setFmt] = useState('qwen');
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const params = { export_format: fmt };
      if (minSuccess) params.min_success_rating = minSuccess;
      if (minPersonal) params.min_personal_rating = minPersonal;
      const blob = await dataLabApi.exportBlob(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dataset_${new Date().toISOString().slice(0, 10)}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      alert(e.message || 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0a0d14] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-white">Export Dataset</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/8 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <p className="text-xs text-slate-500">Exports <strong className="text-white">{total}</strong> labeled records as a JSONL file.</p>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Format</label>
          <select
            value={fmt}
            onChange={e => setFmt(e.target.value)}
            className="w-full bg-black/30 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white outline-none"
          >
            <option value="qwen">Qwen2.5-VL / LLaMA-Factory</option>
            <option value="raw_json">Raw JSON (flat)</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Min Success</label>
            <input
              type="number" min="1" max="10" value={minSuccess}
              onChange={e => setMinSuccess(e.target.value)}
              placeholder="1–10"
              className="w-full bg-black/30 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Min Personal</label>
            <input
              type="number" min="1" max="10" value={minPersonal}
              onChange={e => setMinPersonal(e.target.value)}
              placeholder="1–10"
              className="w-full bg-black/30 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none"
            />
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-green-800/50 text-white text-xs font-black rounded-xl transition-all"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {loading ? 'Preparing...' : 'Download JSONL'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ManageData() {
  const { isDataUser } = useAuth();
  if (!isDataUser) return <Navigate to="/dashboard" replace />;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [showSync, setShowSync] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dataLabApi.list();
      setData(res);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const ads = data?.ads || [];

  const filtered = ads.filter(ad => {
    const matchTab =
      tab === 'all' ? true :
      tab === 'labeled' ? ad.is_labeled :
      !ad.is_labeled;
    const matchSearch = !search ||
      (ad.ad_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (ad.campaign_name || '').toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const selectedIdx = selectedId != null ? filtered.findIndex(a => a.id === selectedId) : -1;
  const selectedAd = selectedIdx >= 0 ? filtered[selectedIdx] : null;

  const openDetail = async (ad) => {
    try {
      const full = await dataLabApi.detail(ad.id);
      setSelectedId(full.id);
      setData(prev => ({
        ...prev,
        ads: prev.ads.map(a => a.id === full.id ? { ...a, ...full } : a),
      }));
    } catch (_) {
      setSelectedId(ad.id);
    }
  };

  const handleSaved = (updated) => {
    setData(prev => ({
      ...prev,
      ads: prev.ads.map(a => a.id === updated.id ? { ...a, ...updated } : a),
      labeled: prev.ads.filter(a => (a.id === updated.id ? updated : a).is_labeled).length,
    }));
  };

  const navigate = (dir) => {
    const nextIdx = selectedIdx + dir;
    if (nextIdx >= 0 && nextIdx < filtered.length) {
      openDetail(filtered[nextIdx]);
    }
  };

  const labeledCount = ads.filter(a => a.is_labeled).length;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-xl">
            <Database className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Manage Data</h1>
            <p className="text-xs text-slate-500">Ad creative dataset builder for VLM fine-tuning</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSync(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/8 border border-white/8 hover:border-white/15 text-white text-xs font-black rounded-xl transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Sync
          </button>
          <button
            onClick={() => setShowExport(true)}
            disabled={labeledCount === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/20 text-green-400 text-xs font-black rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" /> Export JSONL
          </button>
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Ads', value: data.total, color: 'text-white' },
            { label: 'Labeled', value: labeledCount, color: 'text-green-400' },
            { label: 'Pending', value: data.total - labeledCount, color: 'text-amber-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white/3 border border-white/6 rounded-xl p-4 text-center">
              <p className={`text-2xl font-black ${color}`}>{value}</p>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 p-1 bg-white/3 border border-white/6 rounded-xl">
          {[['all', 'All'], ['pending', 'Pending'], ['labeled', 'Labeled']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${tab === key ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
          <input
            type="text"
            placeholder="Search ads..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-black/30 border border-white/8 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/20 transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/2 border border-white/5 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Database className="w-8 h-8 text-slate-700" />
            <p className="text-sm text-slate-500">
              {ads.length === 0 ? 'No ads synced yet. Click Sync to pull from Meta.' : 'No ads match your filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-[10px] font-black text-slate-600 uppercase tracking-widest px-4 py-3">Creative</th>
                  <th className="text-left text-[10px] font-black text-slate-600 uppercase tracking-widest px-3 py-3">Ad</th>
                  <th className="text-right text-[10px] font-black text-slate-600 uppercase tracking-widest px-3 py-3">Spend</th>
                  <th className="text-right text-[10px] font-black text-slate-600 uppercase tracking-widest px-3 py-3">Impr.</th>
                  <th className="text-right text-[10px] font-black text-slate-600 uppercase tracking-widest px-3 py-3">ROAS</th>
                  <th className="text-right text-[10px] font-black text-slate-600 uppercase tracking-widest px-3 py-3">Regs</th>
                  <th className="text-center text-[10px] font-black text-slate-600 uppercase tracking-widest px-3 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((ad) => (
                  <tr
                    key={ad.id}
                    className="border-b border-white/3 hover:bg-white/2 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 border border-white/6 shrink-0">
                        {(ad.creative_image_full_url || ad.creative_image_url) ? (
                          <img
                            src={ad.creative_image_full_url || ad.creative_image_url}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={e => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Database className="w-5 h-5 text-slate-700" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 max-w-[220px]">
                      <p className="text-sm font-semibold text-white truncate">{ad.ad_name || ad.ad_id}</p>
                      <p className="text-[10px] text-slate-500 truncate">{ad.campaign_name || '—'}</p>
                    </td>
                    <td className="px-3 py-3 text-right text-sm text-white font-mono">{fmtMoney(ad.spend)}</td>
                    <td className="px-3 py-3 text-right text-sm text-slate-300 font-mono">{fmt(ad.impressions)}</td>
                    <td className="px-3 py-3 text-right text-sm font-mono">
                      <span className={ad.roas >= 2 ? 'text-green-400' : ad.roas > 0 ? 'text-white' : 'text-slate-500'}>
                        {ad.roas != null ? ad.roas.toFixed(2) : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-sm text-slate-300 font-mono">{fmt(ad.regs)}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-black ${ad.is_labeled ? 'text-green-400 bg-green-500/10 border-green-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'}`}>
                        {ad.is_labeled ? 'Labeled' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openDetail(ad)}
                        className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/20 text-blue-400 text-xs font-black rounded-lg transition-all whitespace-nowrap"
                      >
                        {ad.is_labeled ? 'Edit' : 'Label'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Annotation Panel */}
      {selectedAd && (
        <AnnotationPanel
          ad={selectedAd}
          onClose={() => setSelectedId(null)}
          onSaved={handleSaved}
          onPrev={() => navigate(-1)}
          onNext={() => navigate(1)}
          hasPrev={selectedIdx > 0}
          hasNext={selectedIdx < filtered.length - 1}
        />
      )}

      {/* Sync Modal */}
      {showSync && (
        <SyncModal
          onClose={() => setShowSync(false)}
          onDone={() => { setShowSync(false); load(); }}
        />
      )}

      {/* Export Modal */}
      {showExport && (
        <ExportModal
          total={labeledCount}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
