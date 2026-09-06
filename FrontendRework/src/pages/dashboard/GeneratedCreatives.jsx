import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Download, Grid, List,
  X, Image as ImageIcon, Sparkles,
  ChevronLeft, ChevronRight, Send, Loader2, ChevronDown,
  TrendingUp, MousePointerClick, DollarSign, Eye, Users, Hash,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { creativesApi, brandKitApi, metaApi, slackApi } from '../../lib/api';
import { useGeneration } from '../../contexts/GenerationContext';
import { GLASS_STYLE } from '../../components/ui/GlassCard';
import { CreativeGridSkeleton } from '../../components/ui/Skeleton';
import { creativeProxyUrl } from '../../lib/creativeUrl';
import { getPortalRoot } from '../../lib/portalRoot';
import { useCreativeGallery } from '../../lib/useCreativeGallery';
import UploadCreativeButton from '../../components/dashboard/UploadCreativeButton';
import CreativeFilterBar, { EMPTY_CREATIVE_FILTERS } from '../../components/dashboard/CreativeFilterBar';
import PhotoCreativeCard from '../../components/dashboard/PhotoCreativeCard';
import VideoCreativeCard from '../../components/dashboard/VideoCreativeCard';

// ── Generating placeholder card ───────────────────────────────────────────────
// Shown at the top of the gallery while a generation job is in progress.
// Uses the job's aspect ratio so the card reserves the right space in the grid.
const RATIO_PADDING = {
  '9:16': '177.78%',
  '16:9': '56.25%',
  '1:1':  '100%',
  '4:5':  '125%',
  '2:3':  '150%',
  '3:2':  '66.67%',
  '4:3':  '75%',
};

function GeneratingCard({ aspectRatio }) {
  const pb = RATIO_PADDING[aspectRatio] || '100%';
  return (
    <div className="rounded-2xl overflow-hidden relative select-none"
      style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ paddingBottom: pb, position: 'relative' }}>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          {/* Spinning ring */}
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-white/8" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-white/50 animate-spin" />
          </div>
          <span className="text-[10px] font-semibold text-white/30 tracking-[0.18em] uppercase">
            Generating
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Pending jobs hook ─────────────────────────────────────────────────────────
// Reads active generation job IDs from localStorage, shows placeholder cards,
// polls for completion, then triggers a gallery refresh when done.
const PENDING_KEY = 'troxa_pending_jobs';

function usePendingJobs(onJobsDone) {
  const [pendingCards, setPendingCards] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
      return stored.flatMap(job =>
        Array.from({ length: Math.max(1, job.num_images || 1) }, (_, i) => ({
          id: `pending_${job.id}_${i}`,
          _isPending: true,
          _jobId: job.id,
          aspect_ratio: job.aspect_ratio || '1:1',
        }))
      );
    } catch { return []; }
  });

  const onDoneRef = useRef(onJobsDone);
  useEffect(() => { onDoneRef.current = onJobsDone; }, [onJobsDone]);

  // GenerationContext already polls `/creatives/jobs/:id/` every 2.5s
  // app-wide for any job it knows about (the common case — a job started
  // this session shows up there immediately). Piggyback on that instead
  // of running a second, independent 3s poll for the exact same jobs.
  const { activeJobs } = useGeneration();
  const activeJobsRef = useRef(activeJobs);
  useEffect(() => { activeJobsRef.current = activeJobs; }, [activeJobs]);

  const resolveDone = useCallback((doneIds) => {
    if (!doneIds.size) return;
    let stored;
    try { stored = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); }
    catch { stored = []; }
    if (!stored.length) return;

    const remaining = stored.filter(j => !doneIds.has(j.id));
    if (remaining.length === stored.length) return; // nothing newly done

    try { localStorage.setItem(PENDING_KEY, JSON.stringify(remaining)); } catch {}
    const remainingIds = new Set(remaining.map(j => j.id));
    setPendingCards(prev => prev.filter(c => remainingIds.has(c._jobId)));
    onDoneRef.current?.();
  }, []);

  useEffect(() => {
    if (pendingCards.length === 0) return;
    const doneIds = new Set(
      activeJobs.filter(j => j.status === 'done' || j.status === 'error').map(j => j.id)
    );
    resolveDone(doneIds);
  }, [activeJobs, pendingCards.length, resolveDone]);

  // Fallback, for jobs GenerationContext never learned about — e.g. this
  // tab was reloaded while a job was still running, so the in-memory
  // context state reset but `localStorage` still remembers the job id.
  // This is now the rare path rather than the norm, so it can poll more
  // slowly, and only actually calls the API for ids the context doesn't
  // already have covered.
  useEffect(() => {
    if (pendingCards.length === 0) return;

    const interval = setInterval(async () => {
      if (document.hidden) return;
      let stored;
      try { stored = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); }
      catch { stored = []; }
      if (!stored.length) { setPendingCards([]); return; }

      const knownIds = new Set(activeJobsRef.current.map(j => j.id));
      const orphaned = stored.filter(j => !knownIds.has(j.id));
      if (!orphaned.length) return;

      const doneIds = new Set();
      await Promise.allSettled(orphaned.map(async (job) => {
        try {
          const res = await creativesApi.jobStatus(job.id);
          if (res.status === 'done' || res.status === 'error') doneIds.add(job.id);
        } catch {
          // network error — leave it for the next tick
        }
      }));
      resolveDone(doneIds);
    }, 5000);

    return () => clearInterval(interval);
  }, [pendingCards.length, resolveDone]);

  return pendingCards;
}

function SlackPostModal({ creative, onClose, onPosted }) {
  const [channels, setChannels] = useState([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    slackApi.channels().then(data => {
      const list = Array.isArray(data) ? data : (data?.results || []);
      setChannels(list);
      if (list.length === 1) setSelected(String(list[0].id));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const post = async () => {
    if (!selected) return;
    setPosting(true);
    setError(null);
    try {
      await slackApi.post({ creative_ids: [creative.id], channel_pk: parseInt(selected) });
      setSuccess(true);
      setTimeout(() => { onPosted(); onClose(); }, 1200);
    } catch (e) {
      setError(e.message || 'Post failed');
      setPosting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }}
        className="w-full max-w-sm rounded-2xl border border-white/8 p-5 space-y-4"
        style={{ background: 'rgba(10,13,20,0.98)', backdropFilter: 'blur(20px)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#4A154B]/30 border border-[#8B5CF6]/20 flex items-center justify-center">
              <Hash className="w-3.5 h-3.5 text-[#8B5CF6]" />
            </div>
            <p className="text-sm font-black text-white">Post to Slack</p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {loading ? (
          <div className="h-10 bg-white/5 rounded-xl animate-pulse" />
        ) : channels.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-3">No Slack channels configured. Connect Slack in Integrations.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Channel</label>
              <select
                value={selected}
                onChange={e => setSelected(e.target.value)}
                className="w-full bg-[#0c0f1a] border border-white/8 focus:border-[#8B5CF6]/50 rounded-xl px-3 py-2.5 text-sm text-white outline-none appearance-none"
              >
                {channels.length > 1 && <option value="">Select a channel…</option>}
                {channels.map(ch => (
                  <option key={ch.id} value={String(ch.id)}>#{ch.channel_name || ch.name}</option>
                ))}
              </select>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              onClick={post}
              disabled={!selected || posting || success}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all ${
                success
                  ? 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-400'
                  : 'bg-[#8B5CF6]/15 hover:bg-[#8B5CF6]/25 border border-[#8B5CF6]/25 text-[#8B5CF6] disabled:opacity-50'
              }`}
            >
              {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {success ? 'Posted!' : posting ? 'Posting…' : 'Post to Slack'}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function MetaPostModal({ creative, onClose, onPosted }) {
  const [campaigns, setCampaigns] = useState([]);
  const [adsets, setAdsets] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingAdsets, setLoadingAdsets] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [selectedAdset, setSelectedAdset] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    metaApi.campaigns()
      .then(d => setCampaigns(d.campaigns || []))
      .catch(() => setError('Could not load campaigns. Check your Meta Ads connection.'))
      .finally(() => setLoadingCampaigns(false));
  }, []);

  const onCampaignChange = async (campId) => {
    setSelectedCampaign(campId);
    setSelectedAdset('');
    setAdsets([]);
    if (!campId) return;
    setLoadingAdsets(true);
    try {
      const d = await metaApi.adsets(campId);
      setAdsets(d.adsets || []);
    } catch {}
    setLoadingAdsets(false);
  };

  const handlePost = async () => {
    if (!selectedCampaign || !selectedAdset) return;
    setPosting(true);
    setError(null);
    try {
      const camp = campaigns.find(c => c.id === selectedCampaign);
      const adset = adsets.find(a => a.id === selectedAdset);
      await metaApi.postCreative({
        creative_id: creative.id,
        campaign_id: selectedCampaign,
        campaign_name: camp?.name || '',
        adset_id: selectedAdset,
        adset_name: adset?.name || '',
      });
      setSuccess(true);
      setTimeout(() => { onPosted(); }, 1200);
    } catch (e) {
      setError(e?.message || 'Post failed');
    } finally {
      setPosting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-9999 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
        className="bg-[rgba(10,14,22,0.95)] backdrop-blur-xl border border-[#1877F2]/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1877F2]/10 border border-[#1877F2]/20 flex items-center justify-center text-[#1877F2]">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-black text-white">Post to Meta Ads</p>
              <p className="text-[11px] text-gray-500 truncate max-w-44">{creative.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="py-8 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-[#1877F2]/15 border border-[#1877F2]/30 flex items-center justify-center">
              <Send className="w-5 h-5 text-[#1877F2]" />
            </div>
            <p className="text-sm font-black text-white">Posted!</p>
            <p className="text-xs text-gray-500">Ad created in paused state. Activate from Meta Ads Manager.</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {/* Campaign */}
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Campaign</label>
              {loadingCampaigns ? (
                <div className="flex items-center gap-2 py-2 text-xs text-gray-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={selectedCampaign}
                    onChange={e => onCampaignChange(e.target.value)}
                    className="w-full appearance-none bg-black/40 border border-white/10 focus:border-[#1877F2]/50 rounded-xl py-2.5 pl-3 pr-8 text-xs text-white outline-none transition-all"
                  >
                    <option value="">Select campaign…</option>
                    {campaigns.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                </div>
              )}
            </div>

            {/* Ad Set */}
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Ad Set</label>
              {loadingAdsets ? (
                <div className="flex items-center gap-2 py-2 text-xs text-gray-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading ad sets…
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={selectedAdset}
                    onChange={e => setSelectedAdset(e.target.value)}
                    disabled={!selectedCampaign || adsets.length === 0}
                    className="w-full appearance-none bg-black/40 border border-white/10 focus:border-[#1877F2]/50 rounded-xl py-2.5 pl-3 pr-8 text-xs text-white outline-none transition-all disabled:opacity-40"
                  >
                    <option value="">{selectedCampaign ? (adsets.length ? 'Select ad set…' : 'No ad sets found') : 'Select campaign first'}</option>
                    {adsets.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                </div>
              )}
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>
            )}

            <p className="text-[10px] text-gray-600">Ad will be created in <span className="text-gray-400 font-bold">PAUSED</span> state. You activate it from Meta Ads Manager.</p>

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 py-2.5 bg-white/5 border border-white/8 hover:bg-white/10 text-gray-400 rounded-xl text-xs font-bold transition-all">
                Cancel
              </button>
              <button
                onClick={handlePost}
                disabled={!selectedCampaign || !selectedAdset || posting}
                className="flex-1 py-2.5 bg-[#1877F2] hover:bg-[#1565d8] disabled:bg-[#1877F2]/30 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {posting ? 'Posting…' : 'Post to Meta'}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function GeneratedCreatives() {
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState('grid');
  const [campaignsList, setCampaignsList] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [contributorsList, setContributorsList] = useState([]);
  const [filters, setFilters] = useState({
    ...EMPTY_CREATIVE_FILTERS,
    ...(location.state?.mediaType ? { mediaType: location.state.mediaType } : {}),
    ...(location.state?.isEdited ? { isEdited: location.state.isEdited } : {}),
  });
  const { creatives, setCreatives, loading, hasMore, sentinelRef, refresh } = useCreativeGallery(filters, allTags, { pageSize: 10 });
  const pendingCards = usePendingJobs(refresh);

  // Lightbox
  const [lightbox, setLightbox] = useState(null); // { items:[{url,name,creative}], index }
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [mediaDims, setMediaDims] = useState(null); // { w, h } of the currently displayed lightbox media

  // Feedback
  const [hoverStar, setHoverStar] = useState({});
  const [commentModal, setCommentModal] = useState(null); // { creativeId, name }
  const [commentText, setCommentText] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // creativeId

  // Meta post
  const [metaModal, setMetaModal] = useState(null);
  const [metaMetrics, setMetaMetrics] = useState({});
  const [slackModal, setSlackModal] = useState(null);

  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    Promise.all([
      brandKitApi.campaigns(),
      creativesApi.tags(),
      creativesApi.contributors(),
    ]).then(([camps, tags, contributors]) => {
      setCampaignsList(camps?.results || camps || []);
      setAllTags(tags?.results || tags || []);
      setContributorsList(contributors?.results || contributors || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowRight') { setLightbox(lb => lb && lb.index < lb.items.length - 1 ? { ...lb, index: lb.index + 1 } : lb); setPromptExpanded(false); setMediaDims(null); }
      if (e.key === 'ArrowLeft')  { setLightbox(lb => lb && lb.index > 0 ? { ...lb, index: lb.index - 1 } : lb); setPromptExpanded(false); setMediaDims(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openLightboxFor = (creative) => {
    setMediaDims(null);
    setLightbox({
      items: creatives.map(c => ({ url: creativeProxyUrl(c.id), name: c.name, creative: c })),
      index: creatives.indexOf(creative),
    });
  };

  const handleRateCreative = async (creativeId, stars) => {
    setCreatives(prev => prev.map(c => c.id === creativeId ? { ...c, rating: stars } : c));
    try {
      const creative = creatives.find(c => c.id === creativeId);
      await creativesApi.updateFeedback(creativeId, { rating: stars, feedback_text: creative?.feedback_text ?? '' });
    } catch (_) {}
  };

  const openCommentModal = (creative) => {
    setCommentModal({ creativeId: creative.id, name: creative.name });
    setCommentText(creative.feedback_text ?? '');
  };

  const submitComment = async () => {
    if (!commentModal) return;
    setCommentSaving(true);
    try {
      const creative = creatives.find(c => c.id === commentModal.creativeId);
      await creativesApi.updateFeedback(commentModal.creativeId, { rating: creative?.rating ?? null, feedback_text: commentText });
      setCreatives(prev => prev.map(c => c.id === commentModal.creativeId ? { ...c, feedback_text: commentText } : c));
      setCommentModal(null);
    } catch (_) {}
    setCommentSaving(false);
  };

  const handleRenameCreative = async (creativeId, name) => {
    setCreatives(prev => prev.map(c => c.id === creativeId ? { ...c, name } : c));
    try {
      await creativesApi.updateCreative(creativeId, { name });
    } catch (_) {}
  };

  const handleTagsChange = (creativeId, updatedTags) => {
    setCreatives(prev => prev.map(c => c.id === creativeId ? { ...c, tags: updatedTags } : c));
  };

  const handleCreativeUploaded = (created) => {
    setCreatives(prev => [{ ...created, thumbnail: created.thumbnail || created.image_url }, ...prev]);
  };

  const handleDeleteCreative = async (id) => {
    try {
      await creativesApi.deleteCreative(id);
      setCreatives(prev => prev.filter(c => c.id !== id));
      setDeleteConfirm(null);
      if (lightbox) {
        const remaining = lightbox.items.filter(it => it.creative?.id !== id);
        if (remaining.length === 0) { setLightbox(null); }
        else { setLightbox({ ...lightbox, items: remaining, index: Math.min(lightbox.index, remaining.length - 1) }); }
      }
    } catch (_) {}
  };

  const [downloadingUrl, setDownloadingUrl] = useState(null);
  const handleDownload = async (url, filename) => {
    if (downloadingUrl) return;
    setDownloadingUrl(url);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, '_blank');
    } finally {
      setDownloadingUrl(null);
    }
  };

  const openMetaModal = (creative) => setMetaModal(creative);

  const onMetaPosted = (creative) => {
    setCreatives(prev => prev.map(c =>
      c.id === creative.id ? { ...c, meta_linked: true } : c
    ));
    setMetaMetrics(m => ({ ...m, [creative.id]: null }));
    setMetaModal(null);
  };

  const onSlackPosted = (creative) => {
    setCreatives(prev => prev.map(c => {
      if (c.id !== creative.id) return c;
      const alreadyTagged = (c.tags || []).some(t => t.name === 'Slack Posted');
      if (alreadyTagged) return c;
      return { ...c, tags: [...(c.tags || []), { name: 'Slack Posted', color: '#8B5CF6' }] };
    }));
  };

  // Fetch metrics for creative shown in lightbox if meta_linked
  const lightboxCreative = lightbox?.items[lightbox.index]?.creative;
  useEffect(() => {
    if (!lightboxCreative?.id || !lightboxCreative.meta_linked) return;
    if (metaMetrics[lightboxCreative.id] !== undefined) return; // already fetched
    setMetaMetrics(m => ({ ...m, [lightboxCreative.id]: 'loading' }));
    metaApi.metrics(lightboxCreative.id)
      .then(data => setMetaMetrics(m => ({ ...m, [lightboxCreative.id]: data })))
      .catch(() => setMetaMetrics(m => ({ ...m, [lightboxCreative.id]: null })));
  }, [lightboxCreative?.id, lightboxCreative?.meta_linked]);

  return (
    <div className="space-y-8 pb-20 text-left relative">
      {/* Comment Modal */}
      <AnimatePresence>
        {commentModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-9999 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setCommentModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-[rgba(16,20,29,0.55)] backdrop-blur-xl backdrop-saturate-150 border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-black text-white">Comment</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-50">{commentModal.name}</p>
                </div>
                <button onClick={() => setCommentModal(null)} className="p-1.5 text-slate-500 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Write your notes about this creative..."
                rows={4}
                autoFocus
                className="w-full bg-white/5 border border-white/8 focus:border-blue-500/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 resize-none outline-none transition-colors"
              />
              <div className="flex gap-2 mt-4">
                <button onClick={() => setCommentModal(null)}
                  className="flex-1 py-2.5 bg-white/5 border border-white/8 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all">
                  Cancel
                </button>
                <button onClick={submitComment} disabled={commentSaving}
                  className="flex-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                  {commentSaving ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</> : 'Submit'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-9999 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setDeleteConfirm(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-[rgba(16,20,29,0.55)] backdrop-blur-xl backdrop-saturate-150 border border-red-500/20 rounded-3xl p-6 w-full max-w-xs shadow-2xl text-center"
              onClick={e => e.stopPropagation()}>
              <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <X className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-sm font-black text-white mb-1">Delete Creative?</h3>
              <p className="text-xs text-slate-500 mb-5">This cannot be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2.5 bg-white/5 border border-white/8 hover:bg-white/10 text-slate-400 rounded-xl text-xs font-bold transition-all">
                  Cancel
                </button>
                <button onClick={() => handleDeleteCreative(deleteConfirm)}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all">
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Meta Post Modal */}
      <AnimatePresence>
        {metaModal && (
          <MetaPostModal
            creative={metaModal}
            onClose={() => setMetaModal(null)}
            onPosted={() => onMetaPosted(metaModal)}
          />
        )}
      </AnimatePresence>

      {/* Slack Post Modal */}
      <AnimatePresence>
        {slackModal && (
          <SlackPostModal
            creative={slackModal}
            onClose={() => setSlackModal(null)}
            onPosted={() => onSlackPosted(slackModal)}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white uppercase font-sans">Gallery</h1>
          <p className="text-gray-500 mt-2 text-sm italic">AI-rendered creative drops awaiting final approval and publication</p>
        </div>
        <div className="flex items-center gap-3">
          <div style={GLASS_STYLE} className="flex items-center gap-1.5 p-1 rounded-xl">
            <button
              onClick={() => setView('grid')}
              className={`p-2 rounded-lg transition-colors font-black ${view === 'grid' ? 'text-(--bg-base)' : 'text-gray-500 hover:text-white'}`}
              style={view === 'grid' ? { background: 'var(--text-primary)' } : undefined}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-2 rounded-lg transition-colors font-black ${view === 'list' ? 'text-(--bg-base)' : 'text-gray-500 hover:text-white'}`}
              style={view === 'list' ? { background: 'var(--text-primary)' } : undefined}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <UploadCreativeButton onUploaded={handleCreativeUploaded} />
          <button onClick={() => navigate('/dashboard/create')}
            className="px-6 py-2.5 bg-(--accent) hover:bg-(--accent-hover) text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-accent-glow">
            <Sparkles className="w-4 h-4" /> Generate New
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <CreativeFilterBar
        filters={filters}
        onChange={setFilters}
        campaignsList={campaignsList}
        allTags={allTags}
        contributorsList={contributorsList}
        searchPlaceholder="Search by name or Campaign..."
      />

      {/* ── Creatives ── */}
      {loading ? (
        <CreativeGridSkeleton count={8} />
      ) : creatives.length === 0 && pendingCards.length === 0 ? (
        <div style={GLASS_STYLE} className="p-16 text-center rounded-[2.5rem] space-y-4">
          <ImageIcon className="w-12 h-12 text-gray-600 mx-auto" />
          <p className="text-sm font-bold text-gray-300">No creatives found</p>
        </div>
      ) : (
        <div className={view === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-4"}>
          {/* Generating placeholders — always at the top */}
          {pendingCards.map((card) => (
            <GeneratingCard key={card.id} aspectRatio={card.aspect_ratio} />
          ))}
          {/* Real creatives */}
          {creatives.map((creative, i) => {
            const CardComponent = creative.media_type === 'Video' ? VideoCreativeCard : PhotoCreativeCard;
            return (
              <CardComponent
                key={creative.id}
                creative={creative}
                view={view}
                index={i}
                onOpenLightbox={() => openLightboxFor(creative)}
                hoverStar={hoverStar}
                setHoverStar={setHoverStar}
                onRate={handleRateCreative}
                onRename={handleRenameCreative}
                allTags={allTags}
                onTagsChange={handleTagsChange}
                onTagCreated={(tag) => setAllTags(prev => [...prev, tag])}
                onComment={openCommentModal}
                onDelete={(id) => setDeleteConfirm(id)}
              />
            );
          })}
        </div>
      )}

      {/* Infinite scroll sentinel — fetches the next page when scrolled into view */}
      {hasMore && (
        <div ref={sentinelRef} className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Lightbox — portaled to the theme root (same pattern as
          CreativeFilterBar/TagPicker) so this "fixed" overlay is fixed to
          the real viewport. Nested under the page-transition motion.div
          (which animates `x`, a transform) it would otherwise be clipped
          to that ancestor's box, leaving no safe full-bleed edges in
          classic layout. AnimatePresence must stay INSIDE the portal —
          as the direct child of AnimatePresence, a portal isn't a
          cloneable element and breaks exit tracking. */}
      {createPortal(
        <AnimatePresence>
          {lightbox && (() => {
          const current = lightbox.items[lightbox.index];
          const c = current.creative;
          const isVideo = c?.media_type === 'Video';
          // The gallery proxy URL always resolves to the source photo — for
          // video creatives the actual rendered clip lives at c.video_url.
          const mediaUrl = isVideo ? c?.video_url : current.url;
          const hasPrev = lightbox.index > 0;
          const hasNext = lightbox.index < lightbox.items.length - 1;
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-9999 bg-black/95 flex"
              onClick={() => setLightbox(null)}
            >
              {/* Close */}
              <button onClick={() => setLightbox(null)}
                className="absolute top-4 right-4 p-2 rounded-full text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--bg-hover) transition-colors z-10">
                <X className="w-5 h-5" />
              </button>

              {/* Left — image + arrows */}
              <div className="flex-1 flex items-center justify-center relative min-w-0 px-16 pt-8 pb-24">
                <button
                  onClick={(e) => { e.stopPropagation(); setLightbox(lb => ({ ...lb, index: lb.index - 1 })); setPromptExpanded(false); setMediaDims(null); }}
                  className={`absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/8 hover:bg-white/16 text-white transition-all ${hasPrev ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <AnimatePresence mode="wait">
                  {isVideo ? (
                    mediaUrl ? (
                      <motion.video
                        key={mediaUrl}
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.14 }}
                        src={mediaUrl}
                        poster={current.url}
                        controls
                        autoPlay
                        onClick={(e) => e.stopPropagation()}
                        onLoadedMetadata={(e) => setMediaDims({ w: e.target.videoWidth, h: e.target.videoHeight })}
                        className="max-h-full max-w-full object-contain rounded-xl shadow-2xl"
                      />
                    ) : (
                      <motion.div
                        key="rendering"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center gap-3 text-white/60"
                      >
                        <div className="w-8 h-8 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-bold uppercase tracking-widest">
                          {c?.vjob_status === 'error' ? 'Render failed' : 'Rendering…'}
                        </span>
                      </motion.div>
                    )
                  ) : (
                    <motion.img
                      key={current.url}
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.14 }}
                      src={current.url}
                      alt={current.name}
                      onClick={(e) => e.stopPropagation()}
                      onLoad={(e) => setMediaDims({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
                      className="max-h-full max-w-full object-contain rounded-xl shadow-2xl"
                    />
                  )}
                </AnimatePresence>

                <button
                  onClick={(e) => { e.stopPropagation(); setLightbox(lb => ({ ...lb, index: lb.index + 1 })); setPromptExpanded(false); setMediaDims(null); }}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/8 hover:bg-white/16 text-white transition-all ${hasNext ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                {lightbox.items.length > 1 && (
                  <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-white/30 font-bold tracking-widest uppercase">
                    {lightbox.index + 1} / {lightbox.items.length}
                  </span>
                )}
              </div>

              {/* Right — info panel */}
              <div
                className="w-72 shrink-0 backdrop-blur-xl border-l border-(--border-subtle) flex flex-col overflow-y-auto"
                style={{ background: 'var(--bg-panel)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-5 space-y-5 flex-1">
                  {/* Name */}
                  <div>
                    <p className="text-[10px] font-black text-(--text-muted) uppercase tracking-widest mb-1">Creative</p>
                    <p className="text-sm font-bold text-(--text-primary) leading-snug break-words">{current.name}</p>
                    {c?.campaign_name && <p className="text-[10px] text-(--text-secondary) mt-0.5 break-words">{c.campaign_name}</p>}
                  </div>

                  {/* Meta */}
                  {c && (
                    <div className="space-y-2.5">
                      {(c.generated_by_name || c.created_by_name) && (
                        <div>
                          <p className="text-[10px] font-black text-(--text-muted) uppercase tracking-widest mb-0.5">Generated by</p>
                          <p className="text-xs text-(--text-primary)">{c.generated_by_name || c.created_by_name}</p>
                        </div>
                      )}
                      {c.model_name && (
                        <div>
                          <p className="text-[10px] font-black text-(--text-muted) uppercase tracking-widest mb-0.5">Model</p>
                          <p className="text-xs text-(--text-primary)">{c.model_name}</p>
                        </div>
                      )}
                      {c.generation_mode && (
                        <div>
                          <p className="text-[10px] font-black text-(--text-muted) uppercase tracking-widest mb-0.5">Mode</p>
                          <p className={`text-xs font-bold ${
                            c.generation_mode === 'Auto' ? 'text-emerald-400' :
                            c.generation_mode === 'Prompt Studio' ? 'text-violet-400' :
                            'text-(--accent)'
                          }`}>
                            {c.generation_mode}
                          </p>
                        </div>
                      )}
                      {c.use_fingerprint && (
                        <div>
                          <p className="text-[10px] font-black text-(--text-muted) uppercase tracking-widest mb-0.5">Brand Fingerprint</p>
                          {c.blend_weight != null ? (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px]">
                                <span className="text-(--text-muted)">Refs</span>
                                <span className="text-violet-400 font-black">
                                  {c.blend_weight <= 20 ? 'Pure Refs' : c.blend_weight <= 45 ? 'Refs Dominant' : c.blend_weight <= 65 ? 'Balanced' : c.blend_weight <= 85 ? 'DNA Dominant' : 'Pure DNA'}
                                </span>
                                <span className="text-(--text-muted)">DNA</span>
                              </div>
                              <div className="w-full h-1 rounded-full bg-white/8 overflow-hidden">
                                <div className="h-full rounded-full bg-violet-500" style={{ width: `${c.blend_weight}%` }} />
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-violet-400 font-bold">Active</p>
                          )}
                        </div>
                      )}
                      {c.simplicity_weight != null && (
                        <div>
                          <p className="text-[10px] font-black text-(--text-muted) uppercase tracking-widest mb-0.5">Simplicity</p>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px]">
                              <span className="text-(--text-muted)">Rich</span>
                              <span className="text-sky-400 font-black">
                                {c.simplicity_weight <= 20 ? 'Rich & Detailed' : c.simplicity_weight <= 40 ? 'Simplified' : c.simplicity_weight <= 60 ? 'Balanced' : c.simplicity_weight <= 80 ? 'Minimal' : 'Ultra Minimal'}
                              </span>
                              <span className="text-(--text-muted)">Minimal</span>
                            </div>
                            <div className="w-full h-1 rounded-full bg-white/8 overflow-hidden">
                              <div className="h-full rounded-full bg-sky-500" style={{ width: `${c.simplicity_weight}%` }} />
                            </div>
                          </div>
                        </div>
                      )}
                      {c.aspect_ratio && (
                        <div>
                          <p className="text-[10px] font-black text-(--text-muted) uppercase tracking-widest mb-0.5">Format</p>
                          <p className="text-xs text-(--text-primary)">{c.aspect_ratio}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] font-black text-(--text-muted) uppercase tracking-widest mb-0.5">Resolution</p>
                        <p className="text-xs text-(--text-primary) font-mono">
                          {mediaDims ? `${mediaDims.w} × ${mediaDims.h} px` : '—'}
                        </p>
                      </div>
                      {c.style && (
                        <div>
                          <p className="text-[10px] font-black text-(--text-muted) uppercase tracking-widest mb-0.5">Style</p>
                          <p className="text-xs text-(--text-primary) capitalize">{c.style}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quality Score */}
                  {c.quality_score && (
                    <div>
                      <p className="text-[10px] font-black text-(--text-muted) uppercase tracking-widest mb-2">Quality Score</p>
                      {c.quality_score.status === 'pending' ? (
                        <div className="flex items-center gap-2 text-[11px] text-(--text-muted)">
                          <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin opacity-50" />
                          Evaluating…
                        </div>
                      ) : c.quality_score.status === 'error' ? (
                        <p className="text-[11px] text-red-400">Evaluation failed</p>
                      ) : (
                        <div className="space-y-3">
                          {/* Overall + verdict */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl font-black text-(--text-primary)">{c.quality_score.overall?.toFixed(1)}</span>
                              <span className="text-xs text-(--text-muted)">/5</span>
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                              c.quality_score.verdict === 'pass'   ? 'bg-emerald-500/15 text-emerald-400' :
                              c.quality_score.verdict === 'review' ? 'bg-amber-500/15 text-amber-400' :
                                                                      'bg-red-500/15 text-red-400'
                            }`}>
                              {c.quality_score.verdict === 'pass' ? '✓ Pass' : c.quality_score.verdict === 'review' ? '⚠ Review' : '✗ Fail'}
                            </span>
                          </div>
                          {/* Dimension bars */}
                          {[
                            { key: 'brand_alignment',    label: 'Brand Alignment' },
                            { key: 'ad_effectiveness',   label: 'Ad Effectiveness' },
                            { key: 'text_quality',       label: 'Text Quality' },
                            { key: 'production_quality', label: 'Production' },
                            { key: 'offer_accuracy',     label: 'Offer Accuracy' },
                          ].map(({ key, label }) => {
                            const val = c.quality_score[key];
                            if (val == null) return null;
                            const pct = (val / 5) * 100;
                            const color = val >= 4 ? 'bg-emerald-500' : val >= 3 ? 'bg-amber-500' : 'bg-red-500';
                            return (
                              <div key={key}>
                                <div className="flex justify-between text-[10px] mb-0.5">
                                  <span className="text-(--text-muted)">{label}</span>
                                  <span className="font-black text-(--text-secondary)">{val}/5</span>
                                </div>
                                <div className="w-full h-1 rounded-full bg-white/8 overflow-hidden">
                                  <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                          {/* Notes */}
                          {c.quality_score.notes && (
                            <p className="text-[10px] text-(--text-muted) leading-relaxed italic border-l-2 border-white/10 pl-2">
                              {c.quality_score.notes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Additional Prompt */}
                  {c?.extra_prompt && (
                    <div>
                      <p className="text-[10px] font-black text-(--text-muted) uppercase tracking-widest mb-1.5">Additional Prompt</p>
                      <p className={`text-[11px] text-(--text-secondary) leading-relaxed ${promptExpanded ? '' : 'line-clamp-3'}`}>
                        {c.extra_prompt}
                      </p>
                      {c.extra_prompt.length > 120 && (
                        <button
                          onClick={() => setPromptExpanded(v => !v)}
                          className="mt-1 text-[10px] font-black text-(--accent) hover:text-(--accent-hover) uppercase tracking-widest transition-colors"
                        >
                          {promptExpanded ? 'Show less ↑' : 'Read more ↓'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Negative Prompt */}
                  {c?.negative_prompt && (
                    <div>
                      <p className="text-[10px] font-black text-red-500/70 uppercase tracking-widest mb-1.5">Negative Prompt</p>
                      <p className="text-[11px] text-red-400/70 leading-relaxed italic">
                        {c.negative_prompt}
                      </p>
                    </div>
                  )}

                  {/* References */}
                  {c?.reference_thumbs?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-(--text-muted) uppercase tracking-widest mb-2">References</p>
                      <div className="flex flex-wrap gap-2">
                        {c.reference_thumbs.map((ref, ri) => (
                          <div key={ri} className="w-14 h-14 rounded-lg overflow-hidden bg-(--bg-hover) border border-(--border-subtle) shrink-0">
                            <img src={ref.url} alt={ref.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Date */}
                  {c?.created_at && (
                    <div>
                      <p className="text-[10px] font-black text-(--text-muted) uppercase tracking-widest mb-0.5">Created</p>
                      <p className="text-xs text-(--text-muted)">
                        {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )}

                </div>

                {/* Meta Metrics */}
                {c?.meta_linked && (() => {
                  const m = metaMetrics[c.id];
                  return (
                    <div className="px-5 pb-4">
                      <div className="p-3 bg-[#1877F2]/8 border border-[#1877F2]/20 rounded-2xl space-y-3">
                        <p className="text-[10px] font-black text-[#1877F2]/80 uppercase tracking-widest">Meta Ads</p>
                        {m === 'loading' ? (
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Loader2 className="w-3 h-3 animate-spin" /> Fetching metrics…
                          </div>
                        ) : m?.metrics ? (
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { icon: Eye, label: 'Impressions', value: m.metrics.impressions?.toLocaleString() || '0' },
                              { icon: Users, label: 'Reach', value: m.metrics.reach?.toLocaleString() || '0' },
                              { icon: MousePointerClick, label: 'Clicks', value: m.metrics.clicks?.toLocaleString() || '0' },
                              { icon: TrendingUp, label: 'CTR', value: m.metrics.ctr ? `${parseFloat(m.metrics.ctr).toFixed(2)}%` : '0%' },
                              { icon: DollarSign, label: 'Spend', value: m.metrics.spend ? `$${parseFloat(m.metrics.spend).toFixed(2)}` : '$0' },
                              { icon: DollarSign, label: 'CPM', value: m.metrics.cpm ? `$${parseFloat(m.metrics.cpm).toFixed(2)}` : '$0' },
                            ].map(({ icon: Icon, label, value }) => (
                              <div key={label} className="bg-black/30 rounded-xl p-2.5">
                                <div className="flex items-center gap-1 mb-0.5">
                                  <Icon className="w-2.5 h-2.5 text-[#1877F2]/60" />
                                  <p className="text-[9px] text-gray-600 uppercase tracking-widest">{label}</p>
                                </div>
                                <p className="text-sm font-black text-white tabular-nums">{value}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-gray-600">No data yet — ad may be paused or new.</p>
                        )}
                        {m?.campaign && (
                          <p className="text-[10px] text-gray-600 truncate">
                            Campaign: <span className="text-gray-400">{m.campaign}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Download + Post to Meta */}
                <div className="p-4 border-t border-(--border-subtle) space-y-2">
                  {mediaUrl && (
                    <button
                      onClick={() => handleDownload(mediaUrl, `${current.name || 'creative'}${isVideo ? '.mp4' : '.jpg'}`)}
                      disabled={downloadingUrl === mediaUrl}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-(--bg-hover) hover:bg-(--bg-raised) border border-(--border-subtle) text-(--text-primary) text-xs font-bold rounded-xl transition-colors disabled:opacity-60"
                    >
                      {downloadingUrl === mediaUrl
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Download className="w-3.5 h-3.5" />}
                      {downloadingUrl === mediaUrl ? 'Downloading…' : 'Download'}
                    </button>
                  )}
                  {c && (
                    <button
                      onClick={() => openMetaModal(c)}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl border transition-colors ${
                        c.meta_linked
                          ? 'bg-[#1877F2]/8 border-[#1877F2]/20 text-[#1877F2]/70'
                          : 'bg-[#1877F2]/10 hover:bg-[#1877F2]/20 border-[#1877F2]/20 text-[#1877F2]'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      {c.meta_linked ? 'Posted to Meta' : 'Post to Meta Ads'}
                    </button>
                  )}
                  {c && (() => {
                    const slackPosted = (c.tags || []).some(t => t.name === 'Slack Posted');
                    return (
                      <button
                        onClick={() => !slackPosted && setSlackModal(c)}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl border transition-colors ${
                          slackPosted
                            ? 'bg-[#8B5CF6]/8 border-[#8B5CF6]/20 text-[#8B5CF6]/70 cursor-default'
                            : 'bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 border-[#8B5CF6]/20 text-[#8B5CF6]'
                        }`}
                      >
                        <Hash className="w-3.5 h-3.5" />
                        {slackPosted ? 'Posted to Slack' : 'Post to Slack'}
                      </button>
                    );
                  })()}
                </div>
              </div>
            </motion.div>
          );
        })()}
        </AnimatePresence>,
        getPortalRoot()
      )}
    </div>
  );
}
