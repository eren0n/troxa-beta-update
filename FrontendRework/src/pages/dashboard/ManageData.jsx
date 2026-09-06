import { useState, useEffect, useCallback, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { dataLabApi } from '../../lib/api';
import { GLASS_STYLE } from '../../components/ui/GlassCard';
import {
  Database, RefreshCw, Download, X, ChevronLeft, ChevronRight,
  Loader2, CheckCircle, Search, DollarSign, Shuffle,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null) return '—';
  const num = Number(n);
  if (isNaN(num)) return '—';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(Math.round(num));
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

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
      <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)' }}>{label}</p>
      <p className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>{value}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  );
}

function MetricsPanel({ ad }) {
  return (
    <div className="space-y-4">
      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Atomic Metrics</p>
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
        <div className="rounded-xl p-3 space-y-1.5" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Campaign Context</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}><span style={{ color: 'var(--text-muted)' }}>Objective:</span> {ad.objective}</p>
          {ad.campaign_name && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}><span style={{ color: 'var(--text-muted)' }}>Campaign:</span> {ad.campaign_name}</p>}
          {ad.adset_name && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}><span style={{ color: 'var(--text-muted)' }}>Ad Set:</span> {ad.adset_name}</p>}
          {ad.daily_budget && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}><span style={{ color: 'var(--text-muted)' }}>Daily Budget:</span> {fmtMoney(ad.daily_budget)}</p>}
          {ad.lifetime_budget && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}><span style={{ color: 'var(--text-muted)' }}>Lifetime Budget:</span> {fmtMoney(ad.lifetime_budget)}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Rating Input ─────────────────────────────────────────────────────────────

function RatingInput({ label, value, onChange }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {[1,2,3,4,5,6,7,8,9,10].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="w-8 h-8 rounded-lg text-xs font-black transition-all"
            style={value === n
              ? { background: 'var(--accent)', border: '1px solid var(--accent)', color: '#fff', boxShadow: '0 0 8px var(--accent)' }
              : { background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }
            }
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Ad Media Hook ────────────────────────────────────────────────────────────

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

// ─── Annotation Panel ─────────────────────────────────────────────────────────

function AnnotationPanel({ ad: initialAd, onClose, onSaved, onPrev, onNext, hasPrev, hasNext }) {
  const [ad, setAd] = useState(initialAd);
  const adMedia = useAdMedia(ad.id);
  const [form, setForm] = useState({
    target_audience: initialAd.target_audience || '',
    notes: initialAd.notes || '',
    personal_rating: initialAd.personal_rating ?? null,
    success_rating: initialAd.success_rating ?? null,
  });
  const [blindDone, setBlindDone] = useState(!!initialAd.personal_rating);
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
    setBlindDone(!!initialAd.personal_rating);
    setSaved(false);
    setError('');
  }, [initialAd.id]);

  const handleSave = async () => {
    if (!form.target_audience.trim()) { setError('Target audience is required.'); return; }
    if (!form.personal_rating || !form.success_rating) { setError('Both ratings are required.'); return; }
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

  const PANEL_STYLE = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-default)',
    boxShadow: '0 32px 80px var(--shadow-far)',
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm">
      <div
        className="flex w-full max-w-6xl mx-auto my-4 rounded-2xl overflow-hidden shadow-2xl"
        style={{ ...PANEL_STYLE, margin: '1rem auto' }}
      >
        {/* Left: Creative */}
        <div className="w-[45%] shrink-0 flex flex-col" style={{ background: 'var(--bg-base)' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="min-w-0">
              <p className="text-xs font-black truncate" style={{ color: 'var(--text-primary)' }}>{ad.ad_name || ad.ad_id}</p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{ad.ad_id}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg transition-colors ml-3 shrink-0 hover:opacity-80" style={{ background: 'var(--bg-hover)' }}>
              <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
            {adMedia.type === 'video' && adMedia.src ? (
              <video key={adMedia.src} src={adMedia.src} poster={adMedia.poster || undefined} controls playsInline className="max-w-full max-h-full rounded-xl" />
            ) : adMedia.type === 'image' && adMedia.src ? (
              <img src={adMedia.src} alt={ad.ad_name} className="max-w-full max-h-full object-contain rounded-xl" />
            ) : adMedia.type === null ? (
              <div className="w-full aspect-square rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-raised)' }}>
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--text-faint)' }} />
              </div>
            ) : ad.creative_image_url ? (
              <img src={ad.creative_image_url} alt={ad.ad_name} className="max-w-full max-h-full object-contain rounded-xl" />
            ) : (
              <div className="w-full aspect-square rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-raised)' }}>
                <Database className="w-12 h-12" style={{ color: 'var(--text-faint)' }} />
              </div>
            )}
          </div>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <button onClick={onPrev} disabled={!hasPrev} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black disabled:opacity-30 disabled:cursor-not-allowed transition-colors" style={{ color: 'var(--text-muted)' }}>
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className={`text-[10px] px-2 py-1 rounded-full border font-black ${ad.is_labeled ? 'text-green-400 bg-green-500/10 border-green-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'}`}>
              {ad.is_labeled ? 'Labeled' : 'Pending'}
            </span>
            <button onClick={onNext} disabled={!hasNext} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black disabled:opacity-30 disabled:cursor-not-allowed transition-colors" style={{ color: 'var(--text-muted)' }}>
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Blind rating → full form */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ borderLeft: '1px solid var(--border-subtle)' }}>
          {!blindDone ? (
            /* ── Blind phase: only personal rating ── */
            <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
              <div className="text-center space-y-1">
                <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Blind Rating</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Rate the creative before seeing performance data</p>
              </div>
              <div className="w-full max-w-xs">
                <RatingInput
                  label="Personal Rating (1-10)"
                  value={form.personal_rating}
                  onChange={v => { setForm(f => ({ ...f, personal_rating: v })); setBlindDone(true); }}
                />
              </div>
            </div>
          ) : (
            /* ── Full phase: metrics + all fields ── */
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <MetricsPanel ad={ad} />
              <div className="h-px" style={{ background: 'var(--border-subtle)' }} />

              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Annotation</p>

                <RatingInput label="Personal Rating (1-10)" value={form.personal_rating} onChange={v => setForm(f => ({ ...f, personal_rating: v }))} />

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                    Target Audience <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={form.target_audience}
                    onChange={e => setForm(f => ({ ...f, target_audience: e.target.value }))}
                    placeholder="Who is this creative aimed at? (e.g. US, 25-55, interest = online casino)"
                    rows={3}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none transition-colors"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Notes / Assessment</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Qualitative notes about this creative..."
                    rows={3}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none transition-colors"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                  />
                </div>

                <RatingInput label="Success Rating (1-10)" value={form.success_rating} onChange={v => setForm(f => ({ ...f, success_rating: v }))} />
              </div>
            </div>
          )}

          <div className="shrink-0 px-5 py-4 flex items-center gap-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            {error && <p className="text-xs text-red-400 flex-1">{error}</p>}
            {saved && <p className="text-xs text-green-400 flex-1 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Saved</p>}
            {!error && !saved && <div className="flex-1" />}
            {blindDone && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 text-white text-xs font-black rounded-xl transition-all"
                style={{ background: saving ? 'var(--accent-muted)' : 'var(--accent)' }}
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                {saving ? 'Saving...' : 'Save'}
              </button>
            )}
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
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm p-6 rounded-2xl space-y-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: '0 24px 60px var(--shadow-far)' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>Sync from Meta</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ background: 'var(--bg-hover)' }}>
            <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Fetches all ads, downloads creatives, and updates metrics. Uses the same account as the Meta Ads tab.</p>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {result && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 space-y-1">
            <p className="text-xs font-black text-green-400">Sync complete</p>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Synced: {result.synced} ads · Created: {result.created} · Updated: {result.updated}</p>
          </div>
        )}
        <button
          onClick={handleSync}
          disabled={syncing}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-white text-xs font-black rounded-xl transition-all"
          style={{ background: syncing ? 'color-mix(in srgb, var(--accent) 50%, transparent)' : 'var(--accent)' }}
        >
          {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {syncing ? 'Syncing...' : 'Start Sync'}
        </button>
      </motion.div>
    </div>
  );
}

// ─── Export Modal ─────────────────────────────────────────────────────────────

function ExportModal({ total, onClose }) {
  const [minSuccess, setMinSuccess] = useState('');
  const [minPersonal, setMinPersonal] = useState('');
  const [exportFmt, setExportFmt] = useState('qwen');
  const [loading, setLoading] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);

  const buildParams = () => {
    const params = { export_format: exportFmt };
    if (minSuccess) params.min_success_rating = minSuccess;
    if (minPersonal) params.min_personal_rating = minPersonal;
    return params;
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const blob = await dataLabApi.exportBlob(buildParams());
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

  const handleExportZip = async () => {
    setZipLoading(true);
    try {
      const blob = await dataLabApi.exportZipBlob(buildParams());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dataset_${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      alert(e.message || 'ZIP export failed');
    } finally {
      setZipLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm p-6 rounded-2xl space-y-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: '0 24px 60px var(--shadow-far)' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>Export Dataset</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ background: 'var(--bg-hover)' }}>
            <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Exports <strong style={{ color: 'var(--text-primary)' }}>{total}</strong> labeled records.
        </p>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Format</label>
          <select
            value={exportFmt}
            onChange={e => setExportFmt(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
          >
            <option value="qwen">Qwen2.5-VL / LLaMA-Factory</option>
            <option value="raw_json">Raw JSON (flat)</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[['minSuccess', 'Min Success', setMinSuccess, minSuccess], ['minPersonal', 'Min Personal', setMinPersonal, minPersonal]].map(([key, label, setter, val]) => (
            <div key={key} className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>{label}</label>
              <input
                type="number" min="1" max="10" value={val}
                onChange={e => setter(e.target.value)}
                placeholder="1–10"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleExport}
            disabled={loading || zipLoading}
            className="flex items-center justify-center gap-1.5 py-2.5 text-white text-xs font-black rounded-xl transition-all disabled:opacity-50"
            style={{ background: loading ? 'rgba(22,163,74,0.5)' : 'rgb(22,163,74)' }}
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {loading ? 'Preparing...' : 'JSONL'}
          </button>
          <button
            onClick={handleExportZip}
            disabled={loading || zipLoading}
            className="flex items-center justify-center gap-1.5 py-2.5 text-white text-xs font-black rounded-xl transition-all disabled:opacity-50"
            style={{ background: zipLoading ? 'rgba(124,58,237,0.5)' : 'rgb(124,58,237)' }}
          >
            {zipLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {zipLoading ? 'Packaging...' : 'ZIP + Images'}
          </button>
        </div>
      </motion.div>
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
  const [minSpend, setMinSpend] = useState('');
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
    const matchTab = tab === 'all' ? true : tab === 'labeled' ? ad.is_labeled : !ad.is_labeled;
    const matchSearch = !search ||
      (ad.ad_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (ad.campaign_name || '').toLowerCase().includes(search.toLowerCase());
    const matchSpend = !minSpend || (ad.spend != null && Number(ad.spend) >= Number(minSpend));
    return matchTab && matchSearch && matchSpend;
  });

  const selectedIdx = selectedId != null ? filtered.findIndex(a => a.id === selectedId) : -1;
  const selectedAd = selectedIdx >= 0 ? filtered[selectedIdx] : null;

  const openDetail = async (ad) => {
    try {
      const full = await dataLabApi.detail(ad.id);
      setSelectedId(full.id);
      setData(prev => ({ ...prev, ads: prev.ads.map(a => a.id === full.id ? { ...a, ...full } : a) }));
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

  const navigateAd = (dir) => {
    const nextIdx = selectedIdx + dir;
    if (nextIdx >= 0 && nextIdx < filtered.length) openDetail(filtered[nextIdx]);
  };

  const handleRandomLabel = () => {
    const unlabeled = ads.filter(a => !a.is_labeled);
    if (unlabeled.length === 0) return;
    const pick = unlabeled[Math.floor(Math.random() * unlabeled.length)];
    openDetail(pick);
  };

  const labeledCount = ads.filter(a => a.is_labeled).length;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <Database className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>Manage Data</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Ad creative dataset builder for VLM fine-tuning</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRandomLabel}
            disabled={ads.filter(a => !a.is_labeled).length === 0}
            className="flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl transition-all hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', color: 'rgb(216,180,254)' }}
          >
            <Shuffle className="w-3.5 h-3.5" /> Random Label
          </button>
          <button
            onClick={() => setShowSync(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl transition-all hover:opacity-80"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Sync
          </button>
          <button
            onClick={() => setShowExport(true)}
            disabled={labeledCount === 0}
            className="flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.25)', color: 'rgb(74,222,128)' }}
          >
            <Download className="w-3.5 h-3.5" /> Export JSONL
          </button>
        </div>
      </div>

      {/* Stats */}
      <AnimatePresence>
        {data && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Ads', value: data.total, color: 'var(--text-primary)' },
              { label: 'Labeled', value: labeledCount, color: 'rgb(74,222,128)' },
              { label: 'Pending', value: data.total - labeledCount, color: 'rgb(251,191,36)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl p-4 text-center" style={GLASS_STYLE}>
                <p className="text-2xl font-black" style={{ color }}>{value}</p>
                <p className="text-[10px] font-black uppercase tracking-widest mt-1" style={{ color: 'var(--text-faint)' }}>{label}</p>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
          {[['all', 'All'], ['pending', 'Pending'], ['labeled', 'Labeled']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="px-3 py-1.5 rounded-lg text-xs font-black transition-all"
              style={tab === key
                ? { background: 'var(--bg-hover)', color: 'var(--text-primary)' }
                : { color: 'var(--text-faint)' }
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-faint)' }} />
          <input
            type="text"
            placeholder="Search ads..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl pl-9 pr-3 py-2 text-sm outline-none transition-colors"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
          />
        </div>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-faint)' }} />
          <input
            type="number"
            min="0"
            step="1"
            placeholder="Min spend"
            value={minSpend}
            onChange={e => setMinSpend(e.target.value)}
            className="w-36 rounded-xl pl-8 pr-3 py-2 text-sm outline-none transition-colors"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Database className="w-8 h-8" style={{ color: 'var(--text-faint)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {ads.length === 0 ? 'No ads synced yet. Click Sync to pull from Meta.' : 'No ads match your filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="text-[10px] font-black uppercase tracking-widest px-4 py-3 text-left w-8" style={{ color: 'var(--text-faint)' }}>#</th>
                  {['Creative', 'Ad', 'Spend', 'Impr.', 'ROAS', 'Regs', 'CPFTP', 'Status', ''].map((h, i) => (
                    <th
                      key={i}
                      className={`text-[10px] font-black uppercase tracking-widest px-4 py-3 ${i >= 2 && i <= 6 ? 'text-right' : i === 7 ? 'text-center' : 'text-left'}`}
                      style={{ color: 'var(--text-faint)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((ad, idx) => (
                  <motion.tr
                    key={ad.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    className="transition-colors hover:bg-white/2"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  >
                    <td className="px-4 py-3 text-xs font-black tabular-nums w-8" style={{ color: 'var(--text-faint)' }}>{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}>
                        {(ad.creative_image_full_url || ad.creative_image_url) ? (
                          <img src={ad.creative_image_full_url || ad.creative_image_url} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} loading="lazy" decoding="async" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Database className="w-5 h-5" style={{ color: 'var(--text-faint)' }} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 max-w-55">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{ad.ad_name || ad.ad_id}</p>
                      <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{ad.campaign_name || '—'}</p>
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{fmtMoney(ad.spend)}</td>
                    <td className="px-3 py-3 text-right text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>{fmt(ad.impressions)}</td>
                    <td className="px-3 py-3 text-right text-sm font-mono">
                      <span className={ad.roas >= 2 ? 'text-green-400' : ad.roas > 0 ? '' : ''} style={{ color: ad.roas >= 2 ? undefined : ad.roas > 0 ? 'var(--text-primary)' : 'var(--text-faint)' }}>
                        {ad.roas != null ? ad.roas.toFixed(2) : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>{fmt(ad.regs)}</td>
                    <td className="px-3 py-3 text-right text-sm font-mono" style={{ color: ad.cost_per_ftp != null ? 'var(--text-primary)' : 'var(--text-faint)' }}>{fmtMoney(ad.cost_per_ftp)}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-black ${ad.is_labeled ? 'text-green-400 bg-green-500/10 border-green-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'}`}>
                        {ad.is_labeled ? 'Labeled' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openDetail(ad)}
                        className="px-3 py-1.5 text-xs font-black rounded-lg transition-all whitespace-nowrap hover:opacity-80"
                        style={{ background: 'var(--accent-muted)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)', color: 'var(--accent)' }}
                      >
                        {ad.is_labeled ? 'Edit' : 'Label'}
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedAd && (
        <AnnotationPanel
          ad={selectedAd}
          onClose={() => setSelectedId(null)}
          onSaved={handleSaved}
          onPrev={() => navigateAd(-1)}
          onNext={() => navigateAd(1)}
          hasPrev={selectedIdx > 0}
          hasNext={selectedIdx < filtered.length - 1}
        />
      )}

      {showSync && <SyncModal onClose={() => setShowSync(false)} onDone={() => { setShowSync(false); load(); }} />}
      {showExport && <ExportModal total={labeledCount} onClose={() => setShowExport(false)} />}
    </div>
  );
}
