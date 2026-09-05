import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap, Play, Pause, Trash2, Plus, ArrowLeft, Check, X,
  Calendar, Clock, Image as ImageIcon, Settings, Sparkles,
  ChevronDown, MoreVertical, AlertCircle, RefreshCw,
  Activity, Camera, Layers, Wand2, Sliders, CheckCircle2, PenLine,
  Loader2, Brain, Flame, TrendingUp, Users, AlertTriangle, Info, Lock,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { automationApi, brandKitApi, creativesApi, fingerprintApi } from '../../lib/api';
import LockedFeature from '../../components/dashboard/LockedFeature';
import { GLASS_STYLE } from '../../components/ui/GlassCard';
import { creativeProxyUrl } from '../../lib/creativeUrl';
import { useCreativeGallery } from '../../lib/useCreativeGallery';
import { CreativeGridSkeleton } from '../../components/ui/Skeleton';
import CreativeFilterBar, { EMPTY_CREATIVE_FILTERS } from '../../components/dashboard/CreativeFilterBar';
import UploadCreativeButton from '../../components/dashboard/UploadCreativeButton';

// ─── Shared constants ─────────────────────────────────────────────────────────

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TIMEZONES = [
  { label: 'Istanbul (TRT)',   value: 'Europe/Istanbul' },
  { label: 'New York (ET)',    value: 'America/New_York' },
  { label: 'Chicago (CT)',     value: 'America/Chicago' },
  { label: 'Denver (MT)',      value: 'America/Denver' },
  { label: 'Los Angeles (PT)', value: 'America/Los_Angeles' },
  { label: 'Anchorage (AKT)', value: 'America/Anchorage' },
  { label: 'Honolulu (HST)',   value: 'Pacific/Honolulu' },
];

const models = [
  { name: 'Nano Banana 2', meta: 'Fast • $0.06/img',       badge: 'Recommended', badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  { name: 'GPT Image 2',   meta: 'Balanced • $0.20/img',   badge: 'High Quality', badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/20' },
  { name: 'Grok Imagine',  meta: 'Ultra-Fast • $0.02/img', badge: 'Budget',       badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
];

const ratioOptions  = ['1:1 — Square', '4:5 — Portrait', '9:16 — Story', '16:9 — Landscape'];
const resOptions    = ['1K Standard (~$0.08/img)', '2K Pro (~$0.15/img)', '4K Master (~$0.30/img)'];
const formatOptions = ['PNG', 'JPG', 'WebP'];

const designRulePresets = [
  { key: 'realistic', label: 'Realistic' },
  { key: 'cartoon',   label: 'Cartoon' },
  { key: 'character', label: 'Character' },
  { key: 'text-only', label: 'Text Only' },
  { key: 'map',       label: 'Map' },
  { key: 'custom',    label: 'Custom' },
];

const BRIEF_TYPE_META = {
  'on-brand'      : { label: 'On-Brand',      color: 'border-blue-500/40 bg-blue-500/5',     chip: 'bg-blue-500/15 text-blue-400 border-blue-500/30',     Icon: Sparkles },
  'trend-forward' : { label: 'Trend-Forward',  color: 'border-amber-500/40 bg-amber-500/5',   chip: 'bg-amber-500/15 text-amber-400 border-amber-500/30',   Icon: TrendingUp },
  'audience-first': { label: 'Audience-First', color: 'border-green-500/40 bg-green-500/5',   chip: 'bg-green-500/15 text-green-400 border-green-500/30',   Icon: Users },
  'the-bet'       : { label: 'The Bet',        color: 'border-violet-500/40 bg-violet-500/5', chip: 'bg-violet-500/15 text-violet-400 border-violet-500/30', Icon: Flame },
};

const statusStyles = {
  active: { pill: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', dot: 'bg-emerald-500', label: 'Active' },
  paused: { pill: 'bg-amber-500/10  border-amber-500/20  text-amber-400',     dot: 'bg-amber-500',   label: 'Paused' },
};

const REFERENCE_PAGE_SIZE = 24;

// ─── Shared UI components ─────────────────────────────────────────────────────

function SelectField({ label, options, value, onChange }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{label}</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full bg-[#0b0e1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl py-3 px-4 text-sm text-white outline-none appearance-none cursor-pointer transition-all">
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
      </div>
    </div>
  );
}

function AspectRatioSelector({ ratios, onChange }) {
  const canAdd = ratios.length < ratioOptions.length;
  const addRatio = () => { const next = ratioOptions.find(r => !ratios.includes(r)) || ratioOptions[0]; onChange([...ratios, next]); };
  const removeRatio = (i) => onChange(ratios.filter((_, idx) => idx !== i));
  const updateRatio = (i, val) => onChange(ratios.map((r, idx) => idx === i ? val : r));
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Aspect Ratio</label>
        {canAdd && (
          <button type="button" onClick={addRatio} className="text-[10px] font-black text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors uppercase tracking-wider">
            <Plus className="w-3 h-3" /> Add more
          </button>
        )}
      </div>
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {ratios.map((r, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: i > 0 ? 8 : 0 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.18 }}
              className="flex gap-2">
              <div className="relative flex-1">
                <select value={r} onChange={(e) => updateRatio(i, e.target.value)}
                  className="w-full bg-[#0b0e1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl py-3 px-4 text-sm text-white outline-none appearance-none cursor-pointer transition-all">
                  {ratioOptions.map((o) => <option key={o}>{o}</option>)}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
              </div>
              {ratios.length > 1 && (
                <button type="button" onClick={() => removeRatio(i)}
                  className="w-11 h-11 rounded-xl bg-white/4 border border-white/6 hover:bg-red-500/10 hover:border-red-500/20 text-slate-600 hover:text-red-400 flex items-center justify-center transition-all shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {ratios.length > 1 && (
        <p className="text-[10px] text-slate-700">{ratios.length} formats — each generates separately</p>
      )}
    </div>
  );
}

function DesignRuleField({ value, customText, onPresetChange, onCustomTextChange, onClear }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
          Design Rule <span className="text-slate-700 normal-case font-normal">(optional)</span>
        </label>
        <AnimatePresence>
          {value && (
            <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
              onClick={onClear} className="text-[10px] uppercase font-semibold text-red-500/60 hover:text-red-500/80 transition-colors tracking-wider">
              Clear
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {designRulePresets.map((p) => (
          <motion.button key={p.key} onClick={() => onPresetChange(p.key)} whileTap={{ scale: 0.97 }}
            className={`py-2.5 px-2 rounded-xl text-[11px] font-black transition-all border ${value === p.key ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/20' : 'bg-white/4 border-white/6 text-slate-500 hover:text-white hover:border-white/10'}`}>
            {p.label}
          </motion.button>
        ))}
      </div>
      <AnimatePresence>
        {value === 'custom' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="relative mt-1">
              <PenLine className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
              <textarea rows={3} value={customText} onChange={(e) => onCustomTextChange(e.target.value)}
                placeholder="Describe your design style..."
                className="w-full bg-[rgba(12,15,26,0.80)] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl py-3 pl-9 pr-3 text-sm text-white outline-none transition-all resize-none placeholder:text-slate-700" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scheduleDisplay(auto) {
  if (auto.trigger_type !== 'scheduled') return 'Manual';
  if (!auto.schedule_time) return 'Scheduled';
  const days = (auto.schedule_days || []).map(d => DAY_LABELS[d]).join(', ') || 'Daily';
  return `${days} at ${String(auto.schedule_time).slice(0, 5)}`;
}

function normalizeAuto(a) {
  return { ...a, status: a.is_active ? 'active' : 'paused', totalRuns: a.total_runs ?? 0 };
}

function StatCard({ icon: Icon, label, value, color = 'blue' }) {
  const colorMap = {
    blue:   'text-blue-400   bg-blue-500/8   border-blue-500/15',
    emerald:'text-emerald-400 bg-emerald-500/8 border-emerald-500/15',
    purple: 'text-purple-400 bg-purple-500/8  border-purple-500/15',
    amber:  'text-amber-400  bg-amber-500/8   border-amber-500/15',
  };
  const cls = colorMap[color] || colorMap.blue;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={GLASS_STYLE} className="rounded-2xl p-5">
      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center mb-4 ${cls}`}>
        <Icon className={`w-4 h-4 ${cls.split(' ')[0]}`} />
      </div>
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="text-xs font-bold text-slate-500 mt-1">{label}</p>
    </motion.div>
  );
}

// ─── New Pipeline Modal ───────────────────────────────────────────────────────
// Fully self-contained: owns all state, loads its own data on mount.

// helpers for pre-filling from existing pipeline
const _ratioToOption = (r) => ratioOptions.find(o => o.startsWith(r + ' ')) || r;
const _resToOption   = (r) => resOptions.find(o => o.startsWith(r)) || resOptions[0];
const _fmtToOption   = (f) => {
  if (!f) return 'PNG';
  if (f === 'jpeg' || f === 'jpg') return 'JPG';
  if (f === 'webp') return 'WebP';
  return 'PNG';
};
const _styleToRule = (style) => {
  if (!style) return [null, ''];
  const presetKey = designRulePresets.find(p => p.key === style)?.key;
  if (presetKey) return [presetKey, ''];
  return ['custom', style];
};

function NewPipelineModal({ onClose, onCreated, editTarget = null }) {
  const { activeWorkspace, isEditor, credits } = useAuth();
  const isEditing = !!editTarget;

  // ── Pipeline-specific form state ──
  const [formName,             setFormName]             = useState(() => editTarget?.name || '');
  const [formTrigger,          setFormTrigger]          = useState(() => editTarget?.trigger_type || 'scheduled');
  const [formScheduleTime,     setFormScheduleTime]     = useState(() => editTarget?.schedule_time ? String(editTarget.schedule_time).slice(0,5) : '08:00');
  const [formScheduleDays,     setFormScheduleDays]     = useState(() => editTarget?.schedule_days || [0]);
  const [formScheduleTimezone, setFormScheduleTimezone] = useState(() => {
    if (editTarget?.schedule_timezone) return editTarget.schedule_timezone;
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONES.some(t => t.value === browser) ? browser : 'Europe/Istanbul';
  });
  const [creating, setCreating] = useState(false);

  // ── Generation state (pre-filled from editTarget if editing) ──
  const [mode,              setMode]              = useState(() => editTarget?.generation_mode || 'auto');
  const [selectedStatics,   setSelectedStatics]   = useState(() => editTarget?.static_ids || []);
  const [selectedModel,     setSelectedModel]     = useState(() => editTarget?.model_name || 'Nano Banana 2');
  const [ratios,            setRatios]            = useState(() => {
    if (editTarget?.aspect_ratios?.length) return editTarget.aspect_ratios.map(_ratioToOption);
    if (editTarget?.aspect_ratio) return [_ratioToOption(editTarget.aspect_ratio)];
    return ['1:1 — Square', '9:16 — Story'];
  });
  const [numImages,         setNumImages]         = useState(() => editTarget?.num_images ?? 1);
  const [extraPrompt,       setExtraPrompt]       = useState(() => editTarget?.extra_prompt || '');
  const [selectedCharacterId, setSelectedCharacterId] = useState(() => editTarget?.character_id ? String(editTarget.character_id) : '');
  const [blendWeight,       setBlendWeight]       = useState(() => editTarget?.blend_weight ?? 50);
  const [simplicityMode,    setSimplicityMode]    = useState(() => editTarget ? editTarget.simplicity_weight != null : false);
  const [simplicityWeight,  setSimplicityWeight]  = useState(() => editTarget?.simplicity_weight ?? 50);

  // ── Data state ──
  const [allTags,          setAllTags]          = useState([]);
  const [contributorsList, setContributorsList] = useState([]);
  const [campaigns,        setCampaigns]        = useState([]);
  const [characters,       setCharacters]       = useState([]);
  const [fingerprintStatus,setFingerprintStatus]= useState(null);
  const [loadingData,      setLoadingData]      = useState(true);

  // ── Campaign state ──
  const [selectedCampaignId,    setSelectedCampaignId]    = useState(() => editTarget?.campaign_id ? String(editTarget.campaign_id) : '');
  const [isAddingCampaign,      setIsAddingCampaign]      = useState(false);
  const [newCampaignName,       setNewCampaignName]       = useState('');
  const [campaignIntel,         setCampaignIntel]         = useState(null);
  const [intelLoading,          setIntelLoading]          = useState(false);
  const [intelResearching,      setIntelResearching]      = useState(false);
  const [intelBriefs,           setIntelBriefs]           = useState([]);
  const [selectedBriefId,       setSelectedBriefId]       = useState(null);
  const [editingCampaignDetails,setEditingCampaignDetails]= useState(false);
  const [campaignEditData,      setCampaignEditData]      = useState({ target_audience: '', target_region: '', objective: '', campaign_brief: '' });
  const intelPollRef = useRef(null);

  // ── Trend Scout state ──
  const [trendBrief,       setTrendBrief]       = useState(null);
  const [trendLoading,     setTrendLoading]     = useState(false);
  const [activeTrendIdeaId,setActiveTrendIdeaId]= useState(null);
  const trendPollRef = useRef(null);

  // ── Mention state ──
  const [mentionOpen,  setMentionOpen]  = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const [mentionIdx,   setMentionIdx]   = useState(0);
  const extraPromptRef = useRef(null);

  // ── Reference gallery ──
  const [referenceFilters, setReferenceFilters] = useState({ ...EMPTY_CREATIVE_FILTERS, mediaType: 'Photo' });
  const {
    creatives: referenceCreatives,
    setCreatives: setReferenceCreatives,
    loading: loadingReferences,
    hasMore: hasMoreReferences,
    sentinelRef: referencesSentinelRef,
  } = useCreativeGallery(referenceFilters, allTags, { pageSize: REFERENCE_PAGE_SIZE });

  // ── Load data on mount ──
  useEffect(() => {
    if (!activeWorkspace) return;
    (async () => {
      try {
        const [t, c, chars, ctr, fp] = await Promise.allSettled([
          creativesApi.tags(),
          brandKitApi.campaigns(),
          brandKitApi.characters(),
          creativesApi.contributors(),
          fingerprintApi.status(),
        ]);
        if (t.status === 'fulfilled')    setAllTags(t.value?.results || t.value || []);
        if (c.status === 'fulfilled')    setCampaigns(c.value?.results || c.value || []);
        if (chars.status === 'fulfilled') setCharacters(Array.isArray(chars.value) ? chars.value : []);
        if (ctr.status === 'fulfilled') setContributorsList(ctr.value?.results || ctr.value || []);
        if (fp.status === 'fulfilled')  setFingerprintStatus(fp.value);
      } finally {
        setLoadingData(false);
      }
    })();
  }, [activeWorkspace]);

  // ── Trend Scout ──
  const stopTrendPoll = useCallback(() => {
    if (trendPollRef.current) { clearInterval(trendPollRef.current); trendPollRef.current = null; }
  }, []);

  const fetchTrendBrief = useCallback(async (showLoading = false) => {
    if (showLoading) setTrendLoading(true);
    try {
      const data = await fingerprintApi.trendsGet();
      setTrendBrief(data);
      if (data?.status === 'pending') {
        if (!trendPollRef.current) {
          trendPollRef.current = setInterval(async () => {
            try {
              const polled = await fingerprintApi.trendsGet();
              setTrendBrief(polled);
              if (polled?.status !== 'pending') stopTrendPoll();
            } catch (_) {}
          }, 5000);
        }
      } else {
        stopTrendPoll();
      }
    } catch (_) {}
    finally { if (showLoading) setTrendLoading(false); }
  }, [stopTrendPoll]);

  useEffect(() => {
    if (!activeWorkspace) return;
    fetchTrendBrief(true);
    return () => stopTrendPoll();
  }, [activeWorkspace, fetchTrendBrief, stopTrendPoll]);

  const handleRefreshTrends = async () => {
    setTrendLoading(true);
    setActiveTrendIdeaId(null);
    try {
      await fingerprintApi.trendsRefresh();
      setTrendBrief(prev => ({ ...prev, status: 'pending', ideas: [] }));
      stopTrendPoll();
      trendPollRef.current = setInterval(async () => {
        try {
          const polled = await fingerprintApi.trendsGet();
          setTrendBrief(polled);
          if (polled?.status !== 'pending') { stopTrendPoll(); setTrendLoading(false); }
        } catch (_) {}
      }, 5000);
    } catch (_) { setTrendLoading(false); }
  };

  // ── Campaign Intel ──
  const stopIntelPoll = useCallback(() => {
    if (intelPollRef.current) { clearInterval(intelPollRef.current); intelPollRef.current = null; }
  }, []);

  const loadIntelBriefs = useCallback(async (campaignId) => {
    try {
      const data = await fingerprintApi.campaignBriefs(campaignId);
      if (data?.briefs?.length) setIntelBriefs(data.briefs);
    } catch (_) {}
  }, []);

  const fetchIntel = useCallback(async (campaignId, silent = false) => {
    if (!campaignId) { setCampaignIntel(null); setIntelBriefs([]); setSelectedBriefId(null); return; }
    if (!silent) setIntelLoading(true);
    try {
      const data = await fingerprintApi.campaignIntel(campaignId);
      setCampaignIntel(data);
      if (data.brief_status === 'ready' && data.brief_count > 0) await loadIntelBriefs(campaignId);
    } catch (_) {}
    finally { if (!silent) setIntelLoading(false); }
  }, [loadIntelBriefs]);

  useEffect(() => {
    stopIntelPoll();
    setCampaignIntel(null); setIntelBriefs([]); setSelectedBriefId(null); setEditingCampaignDetails(false);
    if (!selectedCampaignId) return;
    fetchIntel(selectedCampaignId);
    const camp = campaigns.find(c => c.id === selectedCampaignId);
    if (camp) setCampaignEditData({ target_audience: camp.target_audience || '', target_region: camp.target_region || '', objective: camp.objective || '', campaign_brief: camp.campaign_brief || '' });
  }, [selectedCampaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    stopIntelPoll();
    if (!selectedCampaignId || !campaignIntel) return;
    const isPending = campaignIntel.research_status === 'pending' || campaignIntel.brief_status === 'pending';
    if (!isPending) return;
    intelPollRef.current = setInterval(async () => {
      try {
        const data = await fingerprintApi.campaignIntel(selectedCampaignId);
        setCampaignIntel(data);
        if (data.brief_status === 'ready' && data.brief_count > 0) { await loadIntelBriefs(selectedCampaignId); stopIntelPoll(); }
        else if (data.research_status === 'failed' || data.brief_status === 'failed') stopIntelPoll();
      } catch (_) {}
    }, 8000);
    return stopIntelPoll;
  }, [campaignIntel?.research_status, campaignIntel?.brief_status, selectedCampaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveCampaignDetails = async () => {
    if (!selectedCampaignId) return;
    try {
      const updated = await brandKitApi.updateCampaign(selectedCampaignId, campaignEditData);
      setCampaigns(prev => prev.map(c => c.id === selectedCampaignId ? { ...c, ...updated } : c));
      setEditingCampaignDetails(false);
      fetchIntel(selectedCampaignId);
    } catch (_) {}
  };

  const handleStartResearch = async () => {
    if (!selectedCampaignId || intelResearching) return;
    setIntelResearching(true);
    try { await fingerprintApi.campaignResearch(selectedCampaignId); await fetchIntel(selectedCampaignId); } catch (_) {}
    finally { setIntelResearching(false); }
  };

  const handleRebrief = async () => {
    if (!selectedCampaignId) return;
    try { await fingerprintApi.campaignRebriefs(selectedCampaignId); setCampaignIntel(prev => prev ? { ...prev, brief_status: 'pending' } : prev); } catch (_) {}
  };

  const handleSelectBrief = (brief) => {
    if (selectedBriefId === brief.id) { setSelectedBriefId(null); setExtraPrompt(''); return; }
    setSelectedBriefId(brief.id);
    setExtraPrompt(brief.extra_prompt || '');
    if (fingerprintStatus?.exists && fingerprintStatus?.has_visual_dna) setUseFingerprint(true);
  };

  const addCampaign = async () => {
    if (!newCampaignName.trim()) return;
    try {
      const created = await brandKitApi.createCampaign(newCampaignName.trim());
      setCampaigns(prev => [...prev, created]);
      setSelectedCampaignId(created.id);
    } catch (_) {}
    setNewCampaignName(''); setIsAddingCampaign(false);
  };

  // ── Mention helpers ──
  const mentionMatches = characters.filter(c => c.name.toLowerCase().startsWith(mentionQuery.toLowerCase()));

  const insertMention = (char) => {
    const before = extraPrompt.slice(0, mentionStart);
    const after = extraPrompt.slice(mentionStart + 1 + mentionQuery.length);
    setExtraPrompt(before + '@[' + char.name + ']' + after);
    setMentionOpen(false);
    setTimeout(() => extraPromptRef.current?.focus(), 0);
  };

  const handleExtraPromptChange = (e) => {
    const val = e.target.value;
    setExtraPrompt(val);
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const m = before.match(/@(\w*)$/);
    if (m && characters.length > 0) { setMentionStart(before.length - m[0].length); setMentionQuery(m[1]); setMentionOpen(true); setMentionIdx(0); }
    else setMentionOpen(false);
  };

  const handleExtraPromptKeyDown = (e) => {
    if (!mentionOpen || !mentionMatches.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, mentionMatches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter')   { e.preventDefault(); insertMention(mentionMatches[mentionIdx]); }
    else if (e.key === 'Escape')  { setMentionOpen(false); }
  };

  const toggleStatic = (id) => setSelectedStatics(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleDay    = (day) => setFormScheduleDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);

  // ── Submit ──
  const handleCreate = async () => {
    if (!formName.trim()) return;
    setCreating(true);
    try {
      const payload = {
        name:             formName.trim(),
        generation_mode:  mode,
        trigger_type:     formTrigger,
        model_name:       mode === 'auto' ? 'GPT Image 2' : selectedModel,
        aspect_ratio:     ratios[0]?.split(' — ')[0] || '1:1',
        aspect_ratios:    ratios.map(r => r.split(' — ')[0]),
        resolution:       '1K',
        num_images:       numImages,
        output_format:    'png',
        style:            '',
        extra_prompt:     extraPrompt,
        static_ids:       selectedStatics,
        character_id:     selectedCharacterId || null,
        campaign_id:      selectedCampaignId || null,
        use_fingerprint:  blendWeight > 0,
        blend_weight:     blendWeight,
        simplicity_mode:  simplicityMode,
        simplicity_weight: simplicityMode ? simplicityWeight : null,
        schedule_time:     formTrigger === 'scheduled' ? formScheduleTime : null,
        schedule_days:     formTrigger === 'scheduled' ? [...formScheduleDays].sort((a, b) => a - b) : [],
        schedule_timezone: formScheduleTimezone,
      };
      const saved = isEditing
        ? await automationApi.update(editTarget.id, payload)
        : await automationApi.create(payload);
      onCreated(saved);
    } catch (_) {}
    setCreating(false);
  };

  const InputCls = "w-full bg-[rgba(12,15,26,0.80)] border border-white/8 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none transition-all placeholder:text-slate-700";
  const creditBalance = credits?.balance ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 bg-black/80 backdrop-blur-md" />

      {/* Panel */}
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="relative w-full max-w-7xl border border-white/10 rounded-2xl shadow-2xl z-50 flex flex-col max-h-[92vh]"
        style={{ background: 'var(--dropdown-bg)', backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)' }}>

        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-black text-white">{isEditing ? 'Edit Pipeline' : 'New Automation Pipeline'}</h2>
            <p className="text-[11px] text-slate-600 mt-0.5">{isEditing ? `Editing "${editTarget.name}"` : 'Configure your recurring AI creative pipeline'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 bg-white/5 hover:bg-white/8 rounded-xl text-slate-500 hover:text-white transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col lg:flex-row overflow-hidden flex-1 min-h-0">

          {/* ── Col 1: Pipeline Config ─────────────────────────────────────── */}
          <div className="lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-white/5 flex flex-col overflow-y-auto">
            <div className="p-5 space-y-4">
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Pipeline</p>

              <div>
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-1.5">Name</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. NFL Sunday Push" className={InputCls} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-1.5">Trigger</label>
                <div className="grid grid-cols-2 gap-2">
                  {[['scheduled', 'Scheduled'], ['manual', 'Manual']].map(([val, lbl]) => (
                    <button key={val} onClick={() => setFormTrigger(val)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-black transition-all ${formTrigger === val ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white/3 border-white/6 text-slate-500 hover:text-white'}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <AnimatePresence>
                {formTrigger === 'scheduled' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
                    <div className="p-3 bg-white/2 border border-white/5 rounded-xl space-y-3">
                      <div>
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-1.5">Time</label>
                        <input type="time" value={formScheduleTime} onChange={e => setFormScheduleTime(e.target.value)} className={InputCls} />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-1.5">Timezone</label>
                        <div className="relative">
                          <select value={formScheduleTimezone} onChange={e => setFormScheduleTimezone(e.target.value)} className={InputCls + ' appearance-none pr-8 cursor-pointer'}>
                            {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-1.5">Days</label>
                        <div className="flex flex-wrap gap-1.5">
                          {DAY_LABELS.map((day, idx) => (
                            <button key={idx} onClick={() => toggleDay(idx)}
                              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black border transition-all ${formScheduleDays.includes(idx) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white/3 border-white/6 text-slate-500 hover:text-white'}`}>
                              {day}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ── Col 2: Reference Photos ─────────────────────────────────────── */}
          <div className="flex-1 border-b lg:border-b-0 lg:border-r border-white/5 flex flex-col overflow-hidden min-w-0">
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <ImageIcon className={`w-4 h-4 ${selectedCharacterId ? 'text-slate-700' : 'text-slate-500'}`} />
                <h3 className={`font-black text-sm ${selectedCharacterId ? 'text-slate-600' : 'text-white'}`}>Reference Photos</h3>
                {selectedCharacterId && <span className="text-[10px] text-slate-600 font-normal">overridden by character</span>}
              </div>
              <div className="flex items-center gap-3">
                {selectedStatics.length > 0 && (
                  <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="text-[10px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg">
                    {selectedStatics.length} selected
                  </motion.span>
                )}
                <AnimatePresence>
                  {selectedStatics.length > 0 && (
                    <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                      onClick={() => setSelectedStatics([])} className="text-[10px] uppercase font-semibold text-red-500/60 hover:text-red-500/80 transition-colors">
                      Clear
                    </motion.button>
                  )}
                </AnimatePresence>
                <UploadCreativeButton
                  onUploaded={(created) => setReferenceCreatives(prev => [{ ...created, thumbnail: created.thumbnail || created.image_url }, ...prev])}
                  label="Upload"
                />
              </div>
            </div>

            {/* Filter bar */}
            <div className="px-5 py-3 border-b border-white/5 shrink-0">
              <CreativeFilterBar
                filters={referenceFilters}
                onChange={setReferenceFilters}
                campaignsList={campaigns}
                allTags={allTags}
                contributorsList={contributorsList}
                showMediaType={false}
                searchPlaceholder="Search reference photos..."
              />
            </div>

            {/* Gallery */}
            <div className="flex-1 overflow-y-auto p-5">
              {loadingReferences ? (
                <CreativeGridSkeleton count={8} columns="grid-cols-2 md:grid-cols-3" gap="gap-3" cardRounded="rounded-xl" showMeta={false} glass={false} />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {referenceCreatives.map((item) => {
                    const selected = selectedStatics.includes(item.id);
                    const captioning = item.caption_status === 'pending' || item.caption_status === 'processing';
                    return (
                      <motion.div key={item.id} onClick={() => toggleStatic(item.id)}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        className={`group relative rounded-xl overflow-hidden aspect-4/5 cursor-pointer border-2 transition-all ${selected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-transparent hover:border-white/15'}`}>
                        <img src={creativeProxyUrl(item.id)}
                          className={`w-full h-full object-cover transition-all duration-300 ${selected ? 'opacity-100' : 'opacity-55 group-hover:opacity-85'}`}
                          alt={item.name} loading="lazy" decoding="async" />
                        <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent" />
                        {captioning && (
                          <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-black/60 text-slate-300 backdrop-blur-sm flex items-center gap-1">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" /> Captioning
                          </span>
                        )}
                        <AnimatePresence>
                          {selected && (
                            <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                              className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-md flex items-center justify-center shadow-lg shadow-blue-600/50 border border-blue-400/40">
                              <Check className="w-3 h-3 text-white stroke-3" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              )}
              {!loadingReferences && hasMoreReferences && (
                <div ref={referencesSentinelRef} className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </div>

          </div>

          {/* ── Col 3: Generation Settings ───────────────────────────────────── */}
          <div className="lg:w-[400px] shrink-0 flex flex-col overflow-hidden">
            {/* Mode switcher */}
            <div className="p-4 border-b border-white/5 shrink-0">
              <div className="bg-white/4 border border-white/6 rounded-2xl p-1.5 flex gap-1.5">
                {[{ key: 'auto', label: 'Auto', Icon: Wand2 }, { key: 'custom', label: 'Custom', Icon: Sliders }].map(({ key, label, Icon }) => (
                  <button key={key} onClick={() => setMode(key)}
                    className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${mode === key ? 'text-white' : 'text-slate-600 hover:text-slate-400'}`}>
                    {mode === key && (
                      <motion.div layoutId="pipe-mode-pill" className="absolute inset-0 bg-blue-600 rounded-xl shadow-lg shadow-blue-600/25" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                    )}
                    <Icon className="relative w-3.5 h-3.5" />
                    <span className="relative">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable settings area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* ── Campaign Selector ── */}
              <div style={GLASS_STYLE} className="rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Campaign</label>
                  <button type="button" onClick={() => setIsAddingCampaign(!isAddingCampaign)}
                    className="text-[10px] font-black text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors uppercase tracking-wider">
                    {isAddingCampaign ? 'Cancel' : '+ New'}
                  </button>
                </div>
                <AnimatePresence mode="wait">
                  {isAddingCampaign ? (
                    <motion.div key="adding" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="flex gap-2">
                      <input type="text" value={newCampaignName} onChange={e => setNewCampaignName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCampaign()}
                        placeholder="Campaign name..." className="flex-1 bg-[#0c0f1a] border border-white/8 focus:border-blue-500 rounded-xl py-2.5 px-3 text-sm text-white outline-none transition-all placeholder:text-slate-700" />
                      <button onClick={addCampaign} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl transition-all">Add</button>
                      <button onClick={() => { setIsAddingCampaign(false); setNewCampaignName(''); }} className="p-2 bg-white/5 border border-white/8 text-slate-400 hover:text-white rounded-xl transition-all"><X className="w-4 h-4" /></button>
                    </motion.div>
                  ) : (
                    <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
                      <select value={selectedCampaignId} onChange={e => setSelectedCampaignId(e.target.value)}
                        className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl py-3 px-4 text-sm text-white outline-none appearance-none cursor-pointer transition-all">
                        <option value="">— No campaign —</option>
                        {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Campaign Intel Panel ── */}
              <AnimatePresence>
                {selectedCampaignId && (
                  <motion.div key="intel" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}
                    style={GLASS_STYLE} className="rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center"><Brain className="w-3 h-3 text-blue-400" /></div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Campaign Intel</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {campaignIntel?.has_audience && !editingCampaignDetails && (
                          <button onClick={() => { const camp = campaigns.find(c => c.id === selectedCampaignId); if (camp) setCampaignEditData({ target_audience: camp.target_audience || '', target_region: camp.target_region || '', objective: camp.objective || '', campaign_brief: camp.campaign_brief || '' }); setEditingCampaignDetails(true); }}
                            className="text-[10px] font-black text-slate-600 hover:text-slate-400 flex items-center gap-1 transition-colors uppercase tracking-wider">
                            <PenLine className="w-3 h-3" /> Edit
                          </button>
                        )}
                        {campaignIntel?.brief_status === 'ready' && campaignIntel?.fingerprint_stale && !editingCampaignDetails && (
                          <button onClick={handleRebrief} className="text-[10px] font-black text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors uppercase tracking-wider">
                            <RefreshCw className="w-3 h-3" /> Refresh
                          </button>
                        )}
                      </div>
                    </div>

                    {intelLoading && (
                      <div className="flex items-center gap-2 py-2">
                        <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
                        <span className="text-xs text-slate-600">Loading intelligence…</span>
                      </div>
                    )}

                    {!intelLoading && campaignIntel && (!campaignIntel.has_audience || editingCampaignDetails) && (
                      <div className="space-y-2 pt-0.5">
                        {!campaignIntel.has_audience && <p className="text-[10px] text-slate-600">Target audience is required to start research.</p>}
                        <textarea rows={2} value={campaignEditData.target_audience} onChange={e => setCampaignEditData(prev => ({ ...prev, target_audience: e.target.value }))}
                          placeholder="Target audience (e.g. 25-35 male, sports fans...)"
                          className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl p-2.5 text-xs text-white outline-none transition-all resize-none placeholder:text-slate-700" />
                        <input type="text" value={campaignEditData.target_region} onChange={e => setCampaignEditData(prev => ({ ...prev, target_region: e.target.value }))}
                          placeholder="Target region (e.g. UK, US, MENA...)"
                          className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl py-2.5 px-3 text-xs text-white outline-none transition-all placeholder:text-slate-700" />
                        <div className="relative">
                          <select value={campaignEditData.objective} onChange={e => setCampaignEditData(prev => ({ ...prev, objective: e.target.value }))}
                            className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl py-2.5 px-3 text-xs text-white outline-none appearance-none cursor-pointer transition-all">
                            <option value="">Select objective...</option>
                            <option value="acquisition">Acquisition</option>
                            <option value="retention">Retention</option>
                            <option value="awareness">Brand Awareness</option>
                            <option value="reactivation">Reactivation</option>
                            <option value="event">Event / Seasonal</option>
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
                        </div>
                        <textarea rows={2} value={campaignEditData.campaign_brief} onChange={e => setCampaignEditData(prev => ({ ...prev, campaign_brief: e.target.value }))}
                          placeholder="Campaign brief (optional)"
                          className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl p-2.5 text-xs text-white outline-none transition-all resize-none placeholder:text-slate-700" />
                        <div className="flex gap-2">
                          <button onClick={saveCampaignDetails} disabled={!campaignEditData.target_audience.trim()}
                            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black text-xs rounded-xl transition-all">
                            Save
                          </button>
                          {editingCampaignDetails && (
                            <button onClick={() => setEditingCampaignDetails(false)}
                              className="px-3 py-2 bg-white/5 border border-white/8 text-slate-400 hover:text-white text-xs rounded-xl transition-all">
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {!intelLoading && campaignIntel?.has_audience && campaignIntel?.research_status === null && (
                      <button onClick={handleStartResearch} disabled={intelResearching}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-500/8 border border-blue-500/20 hover:bg-blue-500/12 hover:border-blue-500/30 rounded-xl text-xs font-black text-blue-400 transition-all disabled:opacity-60">
                        {intelResearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                        Start market research
                      </button>
                    )}

                    {!intelLoading && (campaignIntel?.research_status === 'pending' || (campaignIntel?.research_status === 'ready' && campaignIntel?.brief_status === 'pending')) && (
                      <div className="flex items-center gap-2.5 py-1">
                        <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
                        <div>
                          <p className="text-xs text-slate-400 font-bold">{campaignIntel?.research_status === 'pending' ? 'Researching market…' : 'Preparing brief…'}</p>
                          <p className="text-[10px] text-slate-600">~20-40 seconds</p>
                        </div>
                      </div>
                    )}

                    {!intelLoading && (campaignIntel?.research_status === 'failed' || campaignIntel?.brief_status === 'failed') && (
                      <div className="flex items-center justify-between py-1">
                        <span className="text-[10px] text-red-400">Research failed.</span>
                        <button onClick={handleStartResearch} className="text-[10px] font-black text-blue-400 hover:text-blue-300 transition-colors">Try again</button>
                      </div>
                    )}

                    {!intelLoading && campaignIntel?.brief_status === 'ready' && campaignIntel?.fingerprint_stale && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/8 border border-amber-500/20 rounded-xl">
                        <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="text-[10px] text-amber-400">Fingerprint updated — briefs may be outdated</span>
                      </div>
                    )}

                    {!intelLoading && intelBriefs.length > 0 && (
                      <div className="space-y-2 pt-1">
                        {intelBriefs.map(brief => {
                          const meta = BRIEF_TYPE_META[brief.type] || BRIEF_TYPE_META['on-brand'];
                          const isSelected = selectedBriefId === brief.id;
                          const BriefIcon = meta.Icon;
                          return (
                            <motion.button key={brief.id} onClick={() => handleSelectBrief(brief)} whileHover={{ scale: 1.005 }} whileTap={{ scale: 0.995 }}
                              className={`w-full text-left p-3.5 rounded-xl border transition-all ${isSelected ? meta.color + ' ring-1 ring-inset ring-white/10' : 'border-white/6 hover:border-white/12 bg-white/2 hover:bg-white/4'}`}>
                              <div className="flex items-start gap-2.5">
                                <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${isSelected ? meta.chip.split(' ').slice(0,2).join(' ') : 'bg-white/5'}`}>
                                  <BriefIcon className={`w-3 h-3 ${isSelected ? meta.chip.split(' ')[1] : 'text-slate-600'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${meta.chip}`}>{meta.label}</span>
                                    {brief.confidence === 'experimental' && <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/20">Risk</span>}
                                  </div>
                                  <p className="text-xs font-black text-white truncate">{brief.title}</p>
                                  <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{brief.concept}</p>
                                </div>
                                {isSelected && (
                                  <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                                    <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                                  </div>
                                )}
                              </div>
                            </motion.button>
                          );
                        })}
                        <p className="text-[10px] text-slate-700 text-center pt-1">Select a brief → Extra Instructions auto-fills</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Auto mode panels ── */}
              <AnimatePresence mode="wait">
                {mode === 'auto' ? (
                  <motion.div key="auto" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="space-y-4">
                    {/* Output settings */}
                    <div style={GLASS_STYLE} className="rounded-2xl p-5 space-y-4">
                      <div className="flex items-start gap-2.5 px-3.5 py-3 bg-blue-500/5 border border-blue-500/12 rounded-xl">
                        <Wand2 className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                        <p className="text-[10px] text-slate-500 leading-relaxed">AI automatically selects model, format, and output settings.</p>
                      </div>
                      <AspectRatioSelector ratios={ratios} onChange={setRatios} />
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Images per Reference</label>
                        <div className="flex gap-2">
                          {[1,2,3,4].map(n => (
                            <button key={n} onClick={() => setNumImages(n)}
                              className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${numImages === n ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white/4 border border-white/6 text-slate-500 hover:text-white hover:border-white/10'}`}>
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Trend Scout */}
                    <div style={GLASS_STYLE} className="rounded-2xl p-5 space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-lg bg-orange-500/15 border border-orange-500/20 flex items-center justify-center"><Flame className="w-3 h-3 text-orange-400" /></div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Daily Trend Ideas</span>
                          {trendBrief?.status === 'ready' && trendBrief.ideas?.length > 0 && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/15 text-orange-400 font-black">{trendBrief.ideas.length} ideas</span>
                          )}
                        </div>
                        <button onClick={handleRefreshTrends} disabled={trendLoading || trendBrief?.status === 'pending'}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                          <RefreshCw className={`w-3 h-3 ${trendLoading || trendBrief?.status === 'pending' ? 'animate-spin' : ''}`} />
                          Refresh
                        </button>
                      </div>
                      {(trendLoading || trendBrief?.status === 'pending') && (
                        <div className="flex items-center gap-2 py-1">
                          <Loader2 className="w-3 h-3 text-orange-400 animate-spin shrink-0" />
                          <span className="text-[10px] text-slate-500">Researching trends...</span>
                        </div>
                      )}
                      {trendBrief?.status === 'ready' && trendBrief.ideas?.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                          {trendBrief.ideas.map(idea => {
                            const isActive = activeTrendIdeaId === idea.id;
                            return (
                              <button key={idea.id} onClick={() => setActiveTrendIdeaId(prev => prev === idea.id ? null : idea.id)}
                                className={`shrink-0 w-36 text-left p-2 rounded-xl border transition-all ${isActive ? 'bg-orange-500/12 border-orange-500/40' : 'bg-white/3 border-white/6 hover:border-white/12 hover:bg-white/5'}`}>
                                <p className={`text-[10px] font-black leading-tight mb-1 ${isActive ? 'text-orange-300' : 'text-white'}`}>{idea.theme}</p>
                                <p className="text-[9px] text-slate-500 leading-relaxed line-clamp-2">{idea.concept}</p>
                                <p className="mt-1.5 text-[9px] font-black uppercase tracking-wide">
                                  {isActive ? <span className="text-orange-400 flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5 inline" /> Selected</span> : <span className="text-slate-600">Select →</span>}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {trendBrief?.status === 'failed' && !trendLoading && (
                        <p className="text-xs text-red-400">Trend research failed. Click Refresh to retry.</p>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  // ── Custom mode panels ──
                  <motion.div key="custom" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="space-y-4">
                    {/* Character selector */}
                    {characters.length > 0 && (
                      <div style={GLASS_STYLE} className="rounded-2xl p-5 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center"><Sparkles className="w-3 h-3 text-violet-400" /></div>
                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Character</span>
                          <span className="text-[10px] text-slate-700 font-normal normal-case tracking-normal">(optional)</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => setSelectedCharacterId('')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${!selectedCharacterId ? 'bg-white/8 border-white/15 text-white' : 'border-white/6 text-slate-500 hover:text-slate-300 hover:border-white/10'}`}>
                            None
                          </button>
                          {characters.map(char => (
                            <button key={char.id} onClick={() => setSelectedCharacterId(selectedCharacterId === char.id ? '' : char.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${selectedCharacterId === char.id ? 'bg-violet-500/15 border-violet-500/30 text-violet-300' : 'border-white/6 text-slate-400 hover:text-white hover:border-white/12'}`}>
                              {char.name}
                              {char.images?.length > 0 && <span className="text-[9px] opacity-60">{char.images.length} img</span>}
                            </button>
                          ))}
                        </div>
                        {selectedCharacterId && <p className="text-[10px] text-violet-400/70">Reference photos overridden by character</p>}
                      </div>
                    )}

                    {/* Model selection */}
                    <div style={GLASS_STYLE} className="rounded-2xl p-5 space-y-3">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">AI Model</label>
                      <div className="space-y-2">
                        {models.map(model => (
                          <motion.button key={model.name} whileHover={{ scale: 1.005 }} whileTap={{ scale: 0.995 }} onClick={() => setSelectedModel(model.name)}
                            className={`w-full p-3.5 text-left border rounded-xl transition-all flex items-center justify-between ${selectedModel === model.name ? 'border-blue-500 bg-blue-500/6' : 'border-white/6 hover:border-white/10'}`}>
                            <div>
                              <p className="text-sm font-black text-white">{model.name}</p>
                              <p className="text-[10px] text-slate-600 mt-0.5">{model.meta}</p>
                            </div>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${model.badgeColor}`}>{model.badge}</span>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Custom output settings */}
                    <div style={GLASS_STYLE} className="rounded-2xl p-5 space-y-4">
                      <AspectRatioSelector ratios={ratios} onChange={setRatios} />
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Images per Reference</label>
                        <div className="flex gap-2">
                          {[1,2,3,4].map(n => (
                            <button key={n} onClick={() => setNumImages(n)}
                              className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${numImages === n ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white/4 border border-white/6 text-slate-500 hover:text-white hover:border-white/10'}`}>
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                          Extra Instructions <span className="text-slate-700 normal-case font-normal">(optional{characters.length > 0 ? ' — type @ to mention a character' : ''})</span>
                        </label>
                        <div className="relative">
                          <textarea ref={extraPromptRef} rows={3} value={extraPrompt}
                            onChange={handleExtraPromptChange} onKeyDown={handleExtraPromptKeyDown}
                            onBlur={() => setTimeout(() => setMentionOpen(false), 150)}
                            placeholder="Additional instructions..."
                            className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl p-3 text-sm text-white outline-none transition-all resize-none placeholder:text-slate-700" />
                          {mentionOpen && mentionMatches.length > 0 && (
                            <div className="absolute z-50 top-full left-0 mt-1 w-full bg-[#0c0f1a] border border-white/12 rounded-xl overflow-hidden shadow-xl shadow-black/40">
                              {mentionMatches.map((char, i) => (
                                <button key={char.id} onMouseDown={e => { e.preventDefault(); insertMention(char); }}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${i === mentionIdx ? 'bg-violet-500/15 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                                  <div className="w-5 h-5 rounded-md bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0">
                                    <Sparkles className="w-2.5 h-2.5 text-violet-400" />
                                  </div>
                                  <span className="text-xs font-bold">{char.name}</span>
                                  {char.images?.length > 0 && <span className="text-[10px] text-slate-600 ml-auto">{char.images.length} img</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── CTA / Fingerprint / Simplicity ── */}
              <div style={GLASS_STYLE} className="rounded-2xl p-5 space-y-3">
                {/* Brand Fingerprint — always on */}
                {fingerprintStatus?.exists && fingerprintStatus?.has_visual_dna && (
                  <div>
                    <div className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${blendWeight > 0 ? 'bg-violet-500/10 border-violet-500/30' : 'bg-white/3 border-white/6'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${blendWeight > 0 ? 'bg-violet-400' : 'bg-slate-600'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-black transition-colors ${blendWeight > 0 ? 'text-violet-300' : 'text-slate-500'}`}>✦ Brand Fingerprint</p>
                        <p className="text-[10px] text-slate-600 truncate">
                          {blendWeight > 0
                            ? `Active · ${fingerprintStatus.confidence} confidence · ${fingerprintStatus.corpus_count} imgs`
                            : 'Disabled — Pure References mode'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 px-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-slate-500 font-medium">References</span>
                          <span className="text-[10px] text-violet-400 font-black">
                            {blendWeight <= 20 ? 'Pure References' : blendWeight <= 45 ? 'Refs Dominant' : blendWeight <= 65 ? 'Balanced' : blendWeight <= 85 ? 'DNA Dominant' : 'Pure Brand DNA'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">Brand DNA</span>
                        </div>
                        <input type="range" min={0} max={100} step={5} value={blendWeight} onChange={e => setBlendWeight(Number(e.target.value))}
                          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                          style={{ background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${blendWeight}%, rgba(255,255,255,0.08) ${blendWeight}%, rgba(255,255,255,0.08) 100%)` }} />
                    </div>
                  </div>
                )}

                {/* Simplicity toggle */}
                <div>
                  <button type="button" onClick={() => setSimplicityMode(v => !v)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${simplicityMode ? 'bg-sky-500/10 border-sky-500/30' : 'bg-white/3 border-white/6 hover:border-white/12'}`}>
                    <div className={`rounded-full relative transition-colors shrink-0 ${simplicityMode ? 'bg-sky-500' : 'bg-white/10'}`} style={{ height: '18px', width: '32px' }}>
                      <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all ${simplicityMode ? 'left-[14px]' : 'left-0.5'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-black ${simplicityMode ? 'text-sky-300' : 'text-slate-500'}`}>◈ Simplicity</p>
                      <p className="text-[10px] text-slate-600 truncate">
                        {simplicityMode
                          ? simplicityWeight <= 20 ? 'Rich & Detailed' : simplicityWeight <= 40 ? 'Slightly Simplified' : simplicityWeight <= 60 ? 'Balanced' : simplicityWeight <= 80 ? 'Minimal' : 'Ultra Minimal'
                          : 'Control visual complexity of the output'}
                      </p>
                    </div>
                  </button>
                  {simplicityMode && (
                    <div className="mt-2 px-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-slate-500 font-medium">Rich</span>
                        <span className="text-[10px] text-sky-400 font-black">
                          {simplicityWeight <= 20 ? 'Rich & Detailed' : simplicityWeight <= 40 ? 'Slightly Simplified' : simplicityWeight <= 60 ? 'Balanced' : simplicityWeight <= 80 ? 'Minimal' : 'Ultra Minimal'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">Minimal</span>
                      </div>
                      <input type="range" min={0} max={100} step={5} value={simplicityWeight} onChange={e => setSimplicityWeight(Number(e.target.value))}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                        style={{ background: `linear-gradient(to right, rgba(14,165,233,0.8) 0%, rgba(14,165,233,0.8) ${simplicityWeight}%, rgba(255,255,255,0.08) ${simplicityWeight}%, rgba(255,255,255,0.08) 100%)` }} />
                    </div>
                  )}
                </div>

                {!isEditor && (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/8 border border-red-500/20 rounded-xl">
                    <Lock className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <p className="text-xs text-red-400 font-bold">Analysts cannot create pipelines.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer / Create button */}
            <div className="p-5 border-t border-white/5 shrink-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[10px] text-slate-700">
                <AlertCircle className="w-3 h-3" /> Activates immediately after creation
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="px-5 py-2.5 bg-white/4 border border-white/8 hover:bg-white/6 text-slate-400 hover:text-white rounded-xl font-bold text-sm transition-all">
                  Cancel
                </button>
                <motion.button onClick={handleCreate} disabled={!formName.trim() || creating || !isEditor}
                  whileHover={formName.trim() && !creating && isEditor ? { scale: 1.02 } : {}}
                  whileTap={formName.trim() && !creating && isEditor ? { scale: 0.98 } : {}}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/50 disabled:cursor-not-allowed text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2">
                  {creating && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {isEditing ? 'Save Changes' : 'Create Pipeline'}
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function AutomationPage() {
  const { activeWorkspace } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedPipelineId = searchParams.get('pipeline') || null;
  const setSelectedPipelineId = (id) => {
    if (id) setSearchParams({ pipeline: id }, { replace: true });
    else setSearchParams({}, { replace: true });
  };

  const [automations,     setAutomations]     = useState([]);
  const [brandKitLogos,   setBrandKitLogos]   = useState([]);
  const [brandKitStatics, setBrandKitStatics] = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [pipelineRuns,    setPipelineRuns]    = useState([]);
  const [loadingRuns,     setLoadingRuns]     = useState(false);
  const [generationAnimationId, setGenerationAnimationId] = useState(null);
  const [successToast,    setSuccessToast]    = useState(null);
  const [menuOpenId,      setMenuOpenId]      = useState(null);
  const [isModalOpen,     setIsModalOpen]     = useState(false);
  const [editTarget,      setEditTarget]      = useState(null);

  useEffect(() => {
    if (!activeWorkspace) return;
    (async () => {
      const [autosRes, staticsRes, logosRes] = await Promise.allSettled([
        automationApi.list(),
        creativesApi.gallery({ media_type: 'Photo', page_size: 100 }),
        brandKitApi.logos(),
      ]);
      if (autosRes.status === 'fulfilled')   setAutomations((autosRes.value?.results || autosRes.value || []).map(normalizeAuto));
      if (staticsRes.status === 'fulfilled') setBrandKitStatics(staticsRes.value?.results || staticsRes.value || []);
      if (logosRes.status === 'fulfilled')   setBrandKitLogos(logosRes.value?.results || logosRes.value || []);
      setLoading(false);
    })();
  }, [activeWorkspace]);

  useEffect(() => {
    if (!selectedPipelineId) { setPipelineRuns([]); return; }
    setLoadingRuns(true);
    automationApi.runs(selectedPipelineId)
      .then(data => setPipelineRuns(data?.results || data || []))
      .catch(() => setPipelineRuns([]))
      .finally(() => setLoadingRuns(false));
  }, [selectedPipelineId]);

  const toast = (msg) => { setSuccessToast(msg); setTimeout(() => setSuccessToast(null), 4000); };

  const toggleStatus = async (id) => {
    try {
      const updated = await automationApi.toggle(id);
      setAutomations(prev => prev.map(a => a.id === id ? { ...a, is_active: updated?.is_active ?? !a.is_active, status: updated?.is_active ? 'active' : 'paused' } : a));
    } catch (_) {}
  };

  const runNow = async (id) => {
    setGenerationAnimationId(id);
    try {
      await automationApi.runNow(id);
      toast(`Pipeline "${automations.find(a => a.id === id)?.name}" started!`);
      if (selectedPipelineId === id) {
        setTimeout(() => automationApi.runs(id).then(d => setPipelineRuns(d?.results || d || [])).catch(() => {}), 5000);
      }
    } catch (err) { toast(err.message || 'Run failed'); }
    setGenerationAnimationId(null);
  };

  const deleteAutomation = async (id) => {
    try {
      await automationApi.delete(id);
      setAutomations(prev => prev.filter(a => a.id !== id));
      if (selectedPipelineId === id) setSelectedPipelineId(null);
    } catch (_) {}
    setMenuOpenId(null);
  };

  const selectedPipeline = automations.find(a => a.id === selectedPipelineId);
  const allCreatives     = pipelineRuns.flatMap(r => r.creatives || []);

  return (
    <div className="space-y-6 pb-20 relative">

      {/* Toast */}
      <AnimatePresence>
        {successToast && (
          <motion.div initial={{ opacity: 0, y: -40, x: 40 }} animate={{ opacity: 1, y: 0, x: 0 }} exit={{ opacity: 0, y: -40, x: 40 }}
            className="fixed top-24 right-6 border border-emerald-500/30 text-white p-4 rounded-2xl shadow-2xl z-50 flex items-center gap-3 max-w-sm"
            style={{ background: 'var(--dropdown-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
            <div className="w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center shrink-0"><Check className="w-4 h-4 text-white" /></div>
            <span className="text-sm font-bold">{successToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail / List */}
      <AnimatePresence mode="wait">
        {selectedPipeline ? (

          /* ── DETAIL VIEW ── */
          <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div style={GLASS_STYLE} className="flex items-center justify-between p-4 rounded-2xl">
              <button onClick={() => setSelectedPipelineId(null)} className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors font-bold text-sm">
                <ArrowLeft className="w-4 h-4" /> Back to Pipelines
              </button>
              <div className="flex items-center gap-3">
                <button onClick={() => { setEditTarget(selectedPipeline); setIsModalOpen(true); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-wider border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all">
                  <Settings className="w-3.5 h-3.5" /> Edit
                </button>
                <button onClick={() => toggleStatus(selectedPipeline.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-wider border transition-all ${selectedPipeline.status === 'active' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/15' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15'}`}>
                  {selectedPipeline.status === 'active' ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5" /> Resume</>}
                </button>
                <motion.button onClick={() => runNow(selectedPipeline.id)} disabled={!!generationAnimationId}
                  whileHover={!generationAnimationId ? { scale: 1.02 } : {}} whileTap={!generationAnimationId ? { scale: 0.98 } : {}}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/50 text-white rounded-xl font-black text-[11px] uppercase tracking-wider transition-all shadow-lg shadow-blue-600/20">
                  {generationAnimationId === selectedPipeline.id ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Run Now
                </motion.button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Activity}  label="Total Runs"   value={selectedPipeline.totalRuns}    color="blue" />
              <StatCard icon={ImageIcon} label="Images / Run" value={selectedPipeline.num_images}   color="purple" />
              <StatCard icon={Clock}     label="Last Run"     value={selectedPipeline.last_run_at ? String(selectedPipeline.last_run_at).slice(0, 10) : 'Never'} color="emerald" />
              <StatCard icon={Calendar}  label="Next Run"     value={selectedPipeline.next_run_at ? String(selectedPipeline.next_run_at).slice(0, 10) : '—'}     color="amber" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div style={GLASS_STYLE} className="md:col-span-2 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-black text-white flex items-center gap-2"><Settings className="w-4 h-4 text-slate-500" /> Configuration</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Trigger',      value: selectedPipeline.trigger_type === 'scheduled' ? 'Scheduled' : 'Manual' },
                    { label: 'Schedule',     value: scheduleDisplay(selectedPipeline) },
                    { label: 'Model',        value: selectedPipeline.model_name },
                    { label: 'Aspect Ratio', value: (selectedPipeline.aspect_ratios?.length > 0 ? selectedPipeline.aspect_ratios : [selectedPipeline.aspect_ratio]).join(', ') },
                    { label: 'Format',       value: (selectedPipeline.output_format || '').toUpperCase() },
                    { label: 'Images / Run', value: selectedPipeline.num_images },
                  ].map(item => (
                    <div key={item.label} className="p-3 bg-white/3 border border-white/5 rounded-xl">
                      <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest mb-1">{item.label}</p>
                      <p className="text-xs font-bold text-white truncate">{item.value || '—'}</p>
                    </div>
                  ))}
                </div>
                {selectedPipeline.extra_prompt && (
                  <div className="p-3 bg-blue-500/4 border border-blue-500/12 rounded-xl">
                    <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest mb-1">Extra Prompt</p>
                    <p className="text-xs text-slate-400 italic">"{selectedPipeline.extra_prompt}"</p>
                  </div>
                )}
              </div>

              <div style={GLASS_STYLE} className="rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-black text-white flex items-center gap-2"><Camera className="w-4 h-4 text-slate-500" /> Reference Photos</h3>
                {(selectedPipeline.static_ids?.length ?? 0) > 0 ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    {brandKitStatics.filter(s => selectedPipeline.static_ids.includes(s.id)).map(s => (
                      <div key={s.id} className="aspect-square rounded-lg overflow-hidden bg-white/4 border border-white/6">
                        <img src={s.image_url || s.url} alt={s.name} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center space-y-2 bg-white/2 border border-white/5 rounded-xl">
                    <Camera className="w-6 h-6 text-slate-700" />
                    <p className="text-[10px] text-slate-700">No reference photos</p>
                  </div>
                )}
              </div>
            </div>

            <div style={GLASS_STYLE} className="rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-500" /> Generated Creatives
                <span className="ml-auto text-[10px] font-black text-slate-700">{allCreatives.length} assets</span>
              </h3>
              {loadingRuns ? (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">{[1,2,3,4].map(i => <div key={i} className="aspect-4/5 bg-white/4 rounded-xl animate-pulse" />)}</div>
              ) : allCreatives.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-white/5 rounded-xl space-y-2">
                  <Zap className="w-7 h-7 text-slate-800 mx-auto" />
                  <p className="text-xs text-slate-700">No creatives yet. Run the pipeline to start.</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {allCreatives.map((c, i) => (
                    <div key={c.id ?? i} className="aspect-4/5 bg-white/4 border border-white/6 rounded-xl overflow-hidden">
                      <img src={c.proxy_url || c.image_url} alt={`Creative ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

        ) : (

          /* ── LIST VIEW ── */
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl font-black text-white">Automation Pipelines</h1>
                <p className="text-slate-500 text-sm mt-1">
                  {automations.filter(a => a.status === 'active').length} active · {automations.length} total
                </p>
              </div>
              <motion.button onClick={() => setIsModalOpen(true)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20">
                <Plus className="w-4 h-4" /> New Pipeline
              </motion.button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Zap}       label="Active Pipelines" value={automations.filter(a => a.status === 'active').length} color="blue" />
              <StatCard icon={Activity}  label="Total Runs"       value={automations.reduce((s, a) => s + (a.totalRuns || 0), 0)} color="purple" />
              <StatCard icon={ImageIcon} label="Images Generated" value={automations.reduce((s, a) => s + (a.total_creatives || 0), 0)} color="emerald" />
              <StatCard icon={Pause}     label="Paused"           value={automations.filter(a => a.status !== 'active').length} color="amber" />
            </div>

            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-white/3 rounded-2xl animate-pulse" />)}</div>
            ) : (
              <div className="space-y-3">
                {automations.length === 0 && (
                  <div style={GLASS_STYLE} className="py-20 text-center rounded-2xl space-y-4">
                    <Zap className="w-10 h-10 text-slate-800 mx-auto" />
                    <p className="text-sm font-bold text-slate-400">No pipelines yet</p>
                    <button onClick={() => setIsModalOpen(true)} className="text-xs text-blue-400 font-black hover:text-blue-300 transition-colors">
                      Create your first pipeline →
                    </button>
                  </div>
                )}
                {automations.map((auto, i) => {
                  const s = statusStyles[auto.status] || statusStyles.paused;
                  return (
                    <motion.div key={auto.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                      className="group bg-[#0b0e1a] border border-white/6 hover:border-white/10 rounded-2xl p-5 transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <button onClick={() => setSelectedPipelineId(auto.id)} className="text-base font-black text-white hover:text-blue-400 transition-colors">{auto.name}</button>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider ${s.pill}`}>
                              <motion.span animate={{ opacity: auto.status === 'active' ? [1, 0.3, 1] : 1 }} transition={{ duration: 1.5, repeat: auto.status === 'active' ? Infinity : 0 }} className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                              {s.label}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-600">
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{scheduleDisplay(auto)}</span>
                            <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3" />{auto.num_images}x · {auto.model_name}</span>
                            <span className="text-slate-700">Runs: {auto.totalRuns}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <motion.button onClick={() => runNow(auto.id)} disabled={!!generationAnimationId}
                            whileHover={!generationAnimationId ? { scale: 1.04 } : {}} whileTap={!generationAnimationId ? { scale: 0.97 } : {}}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/40 text-white rounded-xl font-black text-[11px] uppercase tracking-wider transition-all">
                            {generationAnimationId === auto.id ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            Run
                          </motion.button>
                          <button onClick={() => toggleStatus(auto.id)}
                            className={`p-2 rounded-xl border transition-all ${auto.status === 'active' ? 'bg-amber-500/8 border-amber-500/15 text-amber-400 hover:bg-amber-500/15' : 'bg-emerald-500/8 border-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15'}`}>
                            {auto.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                          <div className="relative">
                            <button onClick={() => setMenuOpenId(menuOpenId === auto.id ? null : auto.id)} className="p-2 text-slate-700 hover:text-white hover:bg-white/6 rounded-xl transition-all">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            <AnimatePresence>
                              {menuOpenId === auto.id && (
                                <>
                                  <div className="fixed inset-0 z-20" onClick={() => setMenuOpenId(null)} />
                                  <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                    className="absolute right-0 top-full mt-1 w-40 border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden"
                                    style={{ background: 'var(--dropdown-bg)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>
                                    <button onClick={() => { setSelectedPipelineId(auto.id); setMenuOpenId(null); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-[11px] font-bold text-slate-500 hover:text-white hover:bg-white/4 transition-all">
                                      <Settings className="w-3 h-3" /> View Details
                                    </button>
                                    <button onClick={() => { setEditTarget(auto); setIsModalOpen(true); setMenuOpenId(null); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-[11px] font-bold text-slate-500 hover:text-blue-400 hover:bg-blue-500/5 transition-all">
                                      <PenLine className="w-3 h-3" /> Edit Pipeline
                                    </button>
                                    <button onClick={() => deleteAutomation(auto.id)} className="w-full flex items-center gap-2 px-3 py-2.5 text-[11px] font-bold text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all">
                                      <Trash2 className="w-3 h-3" /> Delete
                                    </button>
                                  </motion.div>
                                </>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── New / Edit Pipeline Modal ── */}
      <AnimatePresence>
        {isModalOpen && (
          <NewPipelineModal
            key={editTarget ? `edit-${editTarget.id}` : 'new-pipeline-modal'}
            editTarget={editTarget || null}
            onClose={() => { setIsModalOpen(false); setEditTarget(null); }}
            onCreated={(saved) => {
              if (editTarget) {
                setAutomations(prev => prev.map(a => a.id === saved.id ? normalizeAuto(saved) : a));
                toast(`Pipeline "${saved.name}" updated!`);
              } else {
                setAutomations(prev => [...prev, normalizeAuto(saved)]);
                toast(`Pipeline "${saved.name}" created!`);
              }
              setIsModalOpen(false);
              setEditTarget(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Automation() {
  const { isFreeTier, isIndividualTier } = useAuth();
  if (isFreeTier || isIndividualTier) return <LockedFeature feature="Automation" />;
  return <AutomationPage />;
}
