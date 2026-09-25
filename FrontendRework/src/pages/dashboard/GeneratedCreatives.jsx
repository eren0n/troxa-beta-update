import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Download, Grid, List,
  X, Image as ImageIcon, Sparkles,
  ChevronLeft, ChevronRight, Send, Loader2, ChevronDown,
  TrendingUp, MousePointerClick, DollarSign, Eye, Users, Hash, Trophy,
  ListChecks, ImageMinus,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { creativesApi, brandKitApi, metaApi, slackApi } from '../../lib/api';
import { useGeneration } from '../../contexts/GenerationContext';
import { GLASS_STYLE } from '../../components/ui/GlassCard';
import { CreativeCardSkeleton } from '../../components/ui/Skeleton';
import { CreativeImg } from '../../components/ui/CreativeImg';
import { getPortalRoot } from '../../lib/portalRoot';
import { useCreativeGallery } from '../../lib/useCreativeGallery';
import CreativeFilterBar, { EMPTY_CREATIVE_FILTERS } from '../../components/dashboard/CreativeFilterBar';
import PhotoCreativeCard from '../../components/dashboard/PhotoCreativeCard';
import VideoCreativeCard from '../../components/dashboard/VideoCreativeCard';
import CreativeLightbox from '../../components/dashboard/CreativeLightbox';
import UploadCreativeButton from '../../components/dashboard/UploadCreativeButton';
import ReferenceCard from '../../components/dashboard/ReferenceCard';

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
      className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
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

// Brand Kit → References is this same page scoped to reference photos, so it
// gets the gallery's cards, filters, full-screen viewer and loading states
// rather than a look-alike that drifts. These are pinned in that mode; the
// filter bar's "clear" would otherwise wipe them.
const REFERENCE_FILTERS = { isReference: 'true', mediaType: 'Photo' };

export default function GeneratedCreatives({ mode = 'gallery', isEditor = true }) {
  const isRefs = mode === 'references';
  const navigate = useNavigate();
  const location = useLocation();
  const [viewPref, setView] = useState('grid');
  const view = isRefs ? 'grid' : viewPref;
  const [campaignsList, setCampaignsList] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [contributorsList, setContributorsList] = useState([]);
  // The gallery opens on what Troxa produced; uploaded images are reference
  // material (managed under Brand Kit → References) and can still be pulled
  // in from the Source select in the Filters dropdown.
  const [filters, setFilters] = useState(isRefs ? { ...EMPTY_CREATIVE_FILTERS, ...REFERENCE_FILTERS } : {
    ...EMPTY_CREATIVE_FILTERS,
    source: 'troxa_generated',
    ...(location.state?.mediaType ? { mediaType: location.state.mediaType } : {}),
    ...(location.state?.isEdited ? { isEdited: location.state.isEdited } : {}),
  });
  const changeFilters = isRefs ? (f) => setFilters({ ...f, ...REFERENCE_FILTERS }) : setFilters;
  const { creatives, setCreatives, loading, loadingMore, hasMore, sentinelRef, refresh } = useCreativeGallery(filters, allTags, { pageSize: 10 });
  const pendingJobCards = usePendingJobs(refresh);
  // In-flight generations belong to the gallery, not the reference library.
  const pendingCards = isRefs ? [] : pendingJobCards;

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

  // Reference library bulk-select
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkRemoving, setBulkRemoving] = useState(false);

  // Meta post
  const [metaModal, setMetaModal] = useState(null);
  const [metaMetrics, setMetaMetrics] = useState({});
  const [slackModal, setSlackModal] = useState(null);

  useEffect(() => {
    if (!isRefs) document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
  }, [isRefs]);

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


  const openLightboxFor = (creative) => {
    setMediaDims(null);
    setLightbox({
      items: creatives.map(c => ({ id: c.id, name: c.name, creative: c })),
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

  const toggleReference = async (creative) => {
    const next = !creative.is_reference;
    setCreatives(prev => prev.map(c => c.id === creative.id ? { ...c, is_reference: next } : c));
    try {
      await creativesApi.updateFeedback(creative.id, { is_reference: next });
      // Un-referencing in the library takes it out of the library.
      if (isRefs && !next) dropFromView(creative.id);
    } catch (_) {
      setCreatives(prev => prev.map(c => c.id === creative.id ? { ...c, is_reference: !next } : c));
    }
  };

  const dropFromView = (id) => {
    setCreatives(prev => prev.filter(c => c.id !== id));
    setLightbox(lb => {
      if (!lb) return lb;
      const remaining = lb.items.filter(it => it.creative?.id !== id);
      if (remaining.length === 0) return null;
      return { ...lb, items: remaining, index: Math.min(lb.index, remaining.length - 1) };
    });
  };

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };

  useEffect(() => {
    if (!selectMode) return;
    const onKey = (e) => { if (e.key === 'Escape') exitSelectMode(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectMode]);

  const toggleSelected = (creative) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(creative.id)) next.delete(creative.id); else next.add(creative.id);
      return next;
    });
  };

  const allLoadedSelected = creatives.length > 0 && creatives.every(c => selectedIds.has(c.id));
  const toggleSelectAll = () => {
    setSelectedIds(allLoadedSelected ? new Set() : new Set(creatives.map(c => c.id)));
  };

  // Un-reference every selected image; any that fail stay selected and in
  // view so they can be retried.
  const removeSelectedReferences = async () => {
    const ids = [...selectedIds];
    if (!ids.length || bulkRemoving) return;
    setBulkRemoving(true);
    const results = await Promise.allSettled(
      ids.map(id => creativesApi.updateFeedback(id, { is_reference: false }))
    );
    const removed = new Set(ids.filter((_, i) => results[i].status === 'fulfilled'));
    setCreatives(prev => prev.filter(c => !removed.has(c.id)));
    setLightbox(null);
    const failed = new Set(ids.filter(id => !removed.has(id)));
    setSelectedIds(failed);
    if (!failed.size) setSelectMode(false);
    setBulkRemoving(false);
  };

  const handleDeleteCreative = async (id) => {
    try {
      await creativesApi.deleteCreative(id);
      dropFromView(id);
      setDeleteConfirm(null);
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

      {/* Meta / Slack Post Modals — both open from the lightbox, which is
          portaled to the theme root. Rendered in place they'd sit inside the
          page-transition transform's stacking context and end up under it no
          matter their z-index, so they portal to the same root. */}
      {createPortal(
        <AnimatePresence>
          {metaModal && (
            <MetaPostModal
              creative={metaModal}
              onClose={() => setMetaModal(null)}
              onPosted={() => onMetaPosted(metaModal)}
            />
          )}
        </AnimatePresence>,
        getPortalRoot()
      )}
      {createPortal(
        <AnimatePresence>
          {slackModal && (
            <SlackPostModal
              creative={slackModal}
              onClose={() => setSlackModal(null)}
              onPosted={() => onSlackPosted(slackModal)}
            />
          )}
        </AnimatePresence>,
        getPortalRoot()
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        {isRefs ? (
          <div>
            <h3 className="text-sm font-black text-white">Reference Images</h3>
            <p className="text-[11px] text-slate-500 mt-0.5 max-w-xl">
              What generations are built from — uploads, plus creatives promoted from the gallery.
              These are the images the Generate tab offers as references.
            </p>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white uppercase font-sans">Gallery</h1>
            <p className="text-gray-500 mt-2 text-sm italic">AI-rendered creative drops awaiting final approval and publication</p>
          </div>
        )}
        <div className="flex items-center gap-3">
          {/* The reference library is grid-only: its cards are the lean kind. */}
          {!isRefs && (
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
          )}
          {/* Uploading lives in the reference library: an uploaded image is
              reference material, not generated work. */}
          {isRefs ? (
            isEditor && (
              <>
                {/* Secondary to Upload: same size, outline only. While
                    selecting, the floating bar owns the exit instead. */}
                {creatives.length > 0 && !selectMode && (
                  <button type="button" onClick={() => setSelectMode(true)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border border-(--border-default) text-(--text-secondary) hover:text-(--text-primary) hover:border-(--border-strong) hover:bg-(--bg-hover) transition-all">
                    <ListChecks className="w-4 h-4" /> Select
                  </button>
                )}
                <UploadCreativeButton onUploaded={refresh} accept="image/*" />
              </>
            )
          ) : (
            <button onClick={() => navigate('/dashboard/create')}
              className="px-6 py-2.5 bg-(--accent) hover:bg-(--accent-hover) text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-accent-glow">
              <Sparkles className="w-4 h-4" /> Generate New
            </button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <CreativeFilterBar
        filters={filters}
        onChange={changeFilters}
        campaignsList={campaignsList}
        allTags={allTags}
        contributorsList={contributorsList}
        sourcePlacement="panel"
        defaultSource={isRefs ? '' : 'troxa_generated'}
        showMediaType={!isRefs}
        searchPlaceholder={isRefs ? 'Search references...' : 'Search by name or Campaign...'}
      />

      {/* Bulk actions for the reference library — a floating bar just above
          the dock, portaled to the theme root so it tracks light/dark. */}
      {createPortal(
        <AnimatePresence>
          {isRefs && selectMode && (
            <motion.div
              initial={{ opacity: 0, y: 24, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 24, x: '-50%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="fixed left-1/2 z-60 flex items-center gap-1 p-1.5 pl-2 rounded-2xl border border-(--border-default) max-w-[calc(100vw-1.5rem)]"
              style={{
                bottom: 'calc(6.25rem + env(safe-area-inset-bottom))',
                background: 'var(--dropdown-bg)',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
                boxShadow: '0 20px 50px var(--shadow-far), 0 4px 14px var(--shadow-close)',
              }}
            >
              <span className="min-w-7 h-7 px-2 rounded-lg bg-(--accent) text-white text-xs font-black flex items-center justify-center tabular-nums">
                {selectedIds.size}
              </span>
              <span className="text-xs font-bold text-(--text-primary) pl-1 pr-2 whitespace-nowrap">selected</span>
              <button type="button" onClick={toggleSelectAll}
                className="px-3 py-2 rounded-xl text-xs font-bold text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--bg-hover) transition-colors whitespace-nowrap">
                {allLoadedSelected ? 'Deselect all' : 'Select all'}
              </button>
              <span className="w-px h-5 bg-(--border-default) mx-1" />
              <button type="button" onClick={removeSelectedReferences} disabled={!selectedIds.size || bulkRemoving}
                className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 text-red-400 hover:bg-red-500/12 disabled:opacity-40 disabled:hover:bg-transparent transition-colors whitespace-nowrap">
                {bulkRemoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageMinus className="w-3.5 h-3.5" />}
                Remove from references
              </button>
              <button type="button" onClick={exitSelectMode} aria-label="Cancel selection" title="Cancel (Esc)"
                className="w-8 h-8 rounded-xl flex items-center justify-center text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-hover) transition-colors">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        getPortalRoot()
      )}

      {/* ── Creatives ── */}
      {loading ? (
        <div className={view === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-4"}>
          {Array.from({ length: 8 }).map((_, i) => <CreativeCardSkeleton key={i} view={view} simple={isRefs} />)}
        </div>
      ) : creatives.length === 0 && pendingCards.length === 0 ? (
        <div style={GLASS_STYLE} className="p-16 text-center rounded-[2.5rem] space-y-4">
          <ImageIcon className="w-12 h-12 text-gray-600 mx-auto" />
          <p className="text-sm font-bold text-gray-300">{isRefs ? 'No reference images found' : 'No creatives found'}</p>
          {isRefs && (
            <p className="text-xs text-gray-500">Upload one here, or open the gallery and use “Make reference” on a creative.</p>
          )}
        </div>
      ) : (
        <div className={view === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-4"}>
          {/* Generating placeholders — always at the top */}
          {pendingCards.map((card) => (
            <GeneratingCard key={card.id} aspectRatio={card.aspect_ratio} />
          ))}
          {/* Real creatives */}
          {creatives.map((creative, i) => {
            if (isRefs) {
              return (
                <ReferenceCard
                  key={creative.id}
                  creative={creative}
                  index={i}
                  onOpen={() => openLightboxFor(creative)}
                  onRename={handleRenameCreative}
                  allTags={allTags}
                  onTagsChange={handleTagsChange}
                  onTagCreated={(tag) => setAllTags(prev => [...prev, tag])}
                  onRemove={isEditor ? toggleReference : null}
                  selectMode={selectMode}
                  selected={selectedIds.has(creative.id)}
                  onToggleSelect={toggleSelected}
                />
              );
            }
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
                onToggleReference={toggleReference}
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
          {/* Next page on its way — placeholder cards continue the grid
              instead of a spinner under it. */}
          {loadingMore && Array.from({ length: 4 }).map((_, i) => (
            <CreativeCardSkeleton key={`more-${i}`} view={view} simple={isRefs} />
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel — fetches the next page when scrolled into view */}
      {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden />}

      {/* Lightbox — portaled to the theme root (same pattern as
          CreativeFilterBar/TagPicker) so this "fixed" overlay is fixed to
          the real viewport. Nested under the page-transition motion.div
          (which animates `x`, a transform) it would otherwise be clipped
          to that ancestor's box, leaving no safe full-bleed edges in
          classic layout. AnimatePresence must stay INSIDE the portal —
          as the direct child of AnimatePresence, a portal isn't a
          cloneable element and breaks exit tracking. */}
      <CreativeLightbox
        lightbox={lightbox}
        setLightbox={setLightbox}
        mediaDims={mediaDims}
        setMediaDims={setMediaDims}
        promptExpanded={promptExpanded}
        setPromptExpanded={setPromptExpanded}
        metaMetrics={metaMetrics}
        openMetaModal={openMetaModal}
        setSlackModal={setSlackModal}
        handleDownload={handleDownload}
        downloadingUrl={downloadingUrl}
      />
    </div>
  );
}
