import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Check, Plus, Zap, X, Sparkles, Image, SlidersHorizontal, ChevronDown, Info, Wand2, Sliders, PenLine, AlertTriangle, ArrowRight, Loader2, Lock, Brain, RefreshCw, TrendingUp, Users, Flame } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useGeneration } from '../../contexts/GenerationContext';
import { brandKitApi, creativesApi, fingerprintApi } from '../../lib/api';
import { GLASS_STYLE } from '../../components/ui/GlassCard';
import { CreativeGridSkeleton } from '../../components/ui/Skeleton';
import { creativeProxyUrl } from '../../lib/creativeUrl';
import { useCreativeGallery } from '../../lib/useCreativeGallery';
import UploadCreativeButton from '../../components/dashboard/UploadCreativeButton';
import CreativeFilterBar, { EMPTY_CREATIVE_FILTERS } from '../../components/dashboard/CreativeFilterBar';

const STEPS = [
  { key: 'captioning',         label: 'Analysing references...',   desc: 'Florence-2 is reading your reference photos' },
  { key: 'generating_prompt',  label: 'Building master prompt...',  desc: 'GPT-4.1 is crafting the ad strategy' },
  { key: 'generating_images',  label: 'Rendering images...',        desc: 'AI model is generating high-quality outputs' },
  { key: 'saving',             label: 'Saving results...',          desc: 'Writing creatives to the database' },
  { key: 'done',               label: 'Done!',                      desc: 'Your creatives are ready to view' },
];

function ProgressScreen({ jobs, onView, onReset, onContinue }) {
  const allDone    = jobs.every(j => j.status === 'done');
  const allSettled = jobs.every(j => j.status === 'done' || j.status === 'error');
  const anyError   = jobs.some(j => j.status === 'error');
  const doneCount  = jobs.filter(j => j.status === 'done').length;

  // For step indicators use the furthest-along active job
  const activeJob   = jobs.find(j => j.status !== 'done' && j.status !== 'error') || jobs[0];
  const stepIndex   = STEPS.findIndex(s => s.key === activeJob?.current_step);
  const currentStep = STEPS[stepIndex] || STEPS[0];

  const isError  = anyError && allSettled && !allDone;
  const isSingle = jobs.length === 1;

  return (
    <div className="flex flex-col items-center justify-center min-h-125 gap-10 py-16">
      {/* Animated icon */}
      <div className="relative">
        <div className={`w-24 h-24 rounded-full border-2 flex items-center justify-center ${
          allDone ? 'border-green-500 bg-green-500/10' :
          isError  ? 'border-amber-500 bg-amber-500/10' :
          'border-blue-500/40 bg-blue-500/5'
        }`}>
          {allDone ? (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </motion.div>
          ) : isError ? (
            <AlertTriangle className="w-10 h-10 text-amber-400" />
          ) : (
            <>
              <Sparkles className="w-8 h-8 text-blue-400" />
              <div className="absolute inset-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            </>
          )}
        </div>
      </div>

      {/* Label */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-black text-white">
          {allDone ? 'Done!' : isError ? 'Some formats failed' : currentStep.label}
        </h2>
        <p className="text-sm text-gray-500">
          {!isSingle
            ? `${doneCount} / ${jobs.length} formats completed`
            : isError ? (activeJob?.error_message || 'Something went wrong.') : currentStep.desc}
        </p>
      </div>

      {/* Multi-job rows */}
      {!isSingle && (
        <div className="w-full max-w-sm space-y-2">
          {jobs.map((job) => {
            const done  = job.status === 'done';
            const error = job.status === 'error';
            const si    = STEPS.findIndex(s => s.key === job.current_step);
            const step  = STEPS[si] || STEPS[0];
            const ratio = job.aspect_ratio || '?';
            return (
              <div key={job.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/3 border border-white/6">
                <span className="text-[10px] font-black text-slate-400 uppercase w-10 shrink-0">{ratio}</span>
                {done  ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" /> :
                 error ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" /> :
                         <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />}
                <span className="text-xs text-slate-500 truncate">
                  {done ? 'Done' : error ? (job.error_message || 'Failed') : step.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Step indicators (single job only) */}
      {isSingle && (
        <div className="flex items-center gap-3 flex-wrap justify-center">
          {STEPS.slice(0, -1).map((step, i) => {
            const done   = stepIndex > i || allDone;
            const active = stepIndex === i && !allDone;
            return (
              <div key={step.key} className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                  done   ? 'bg-green-500/15 border-green-500/30 text-green-400' :
                  active ? 'bg-blue-500/15 border-blue-500/40 text-blue-300' :
                           'bg-white/3 border-white/8 text-gray-600'
                }`}>
                  {done   && <CheckCircle2 className="w-3 h-3" />}
                  {active && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>{step.label.replace('...', '').replace('!', '')}</span>
                </div>
                {i < STEPS.length - 2 && <div className={`w-6 h-px ${done ? 'bg-green-500/40' : 'bg-white/8'}`} />}
              </div>
            );
          })}
        </div>
      )}

      {/* CTA */}
      {(allDone || (allSettled && doneCount > 0)) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-3">
          <button onClick={onView}
            className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-blue-600/25">
            View Creatives <ArrowRight className="w-4 h-4" />
          </button>
          <button onClick={onReset} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">Start new generation</button>
        </motion.div>
      )}
      {allSettled && doneCount === 0 && (
        <button onClick={onReset} className="px-6 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-sm rounded-xl transition-all">
          Try again
        </button>
      )}

      {/* Continue Generating — fixed bottom-right, only while running */}
      {!allSettled && (
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          onClick={onContinue}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 bg-[#10141d] border border-white/10 hover:border-blue-500/40 text-white text-sm font-black rounded-2xl shadow-2xl transition-all hover:bg-[#13182a]"
        >
          <Sparkles className="w-4 h-4 text-blue-400" />
          Continue Generating
          <ArrowRight className="w-4 h-4 text-slate-400" />
        </motion.button>
      )}
    </div>
  );
}

const models = [
  { name: 'Nano Banana 2',    credits: 1 },
  { name: 'Nano Banana Pro',  credits: 2 },
  { name: 'GPT Image 2',      credits: 2 },
  { name: 'Grok Imagine',     credits: 1 },
  { name: 'Seedream 5.0 Pro', credits: 2 },
  { name: 'Ideogram v4',      credits: 1 },
  { name: 'Qwen Image 2 Pro', credits: 1 },
];

const REFERENCE_PAGE_SIZE = 12;
const ratioOptions = ['1:1 — Square', '4:5 — Portrait', '9:16 — Story', '16:9 — Landscape'];
const resOptions   = ['1K Standard (~$0.08/img)', '2K Pro (~$0.15/img)', '4K Master (~$0.30/img)'];
const formatOptions = ['PNG', 'JPG', 'WebP'];

const designRulePresets = [
  { key: 'realistic',  label: 'Realistic' },
  { key: 'cartoon',   label: 'Cartoon' },
  { key: 'character', label: 'Character' },
  { key: 'text-only', label: 'Text Only' },
  { key: 'map',       label: 'Map' },
  { key: 'custom',    label: 'Custom' },
];

function SelectField({ label, options, value, onChange }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-[#0b0e1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl py-3 px-4 text-sm text-white outline-none appearance-none cursor-pointer transition-all"
        >
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
      </div>
    </div>
  );
}

function AspectRatioSelector({ ratios, onChange }) {
  const canAdd = ratios.length < ratioOptions.length;

  const addRatio = () => {
    const next = ratioOptions.find(r => !ratios.includes(r)) || ratioOptions[0];
    onChange([...ratios, next]);
  };

  const removeRatio = (i) => onChange(ratios.filter((_, idx) => idx !== i));

  const updateRatio = (i, val) => onChange(ratios.map((r, idx) => idx === i ? val : r));

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Aspect Ratio</label>
        {canAdd && (
          <button
            type="button"
            onClick={addRatio}
            className="text-[10px] font-black text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors uppercase tracking-wider"
          >
            <Plus className="w-3 h-3" /> Add more
          </button>
        )}
      </div>

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {ratios.map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: i > 0 ? 8 : 0 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.18 }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <select
                  value={r}
                  onChange={(e) => updateRatio(i, e.target.value)}
                  className="w-full bg-[#0b0e1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl py-3 px-4 text-sm text-white outline-none appearance-none cursor-pointer transition-all"
                >
                  {ratioOptions.map((o) => <option key={o}>{o}</option>)}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
              </div>
              {ratios.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRatio(i)}
                  className="w-11 h-11 rounded-xl bg-white/4 border border-white/6 hover:bg-red-500/10 hover:border-red-500/20 text-slate-600 hover:text-red-400 flex items-center justify-center transition-all shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {ratios.length > 1 && (
        <p className="text-[10px] text-slate-700">
          {ratios.length} formats — each generates {ratios.length > 1 ? 'separately' : ''}
        </p>
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
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              onClick={onClear}
              className="text-[10px] uppercase font-semibold text-red-500/60 hover:text-red-500/80 transition-colors tracking-wider"
            >
              Clear
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {designRulePresets.map((preset) => (
          <motion.button
            key={preset.key}
            onClick={() => onPresetChange(preset.key)}
            whileTap={{ scale: 0.97 }}
            className={`py-2.5 px-2 rounded-xl text-[11px] font-black transition-all border ${
              value === preset.key
                ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/20'
                : 'bg-white/4 border-white/6 text-slate-500 hover:text-white hover:border-white/10'
            }`}
          >
            {preset.label}
          </motion.button>
        ))}
      </div>
      <AnimatePresence>
        {value === 'custom' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="relative mt-1">
              <PenLine className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
              <textarea
                rows={3}
                value={customText}
                onChange={(e) => onCustomTextChange(e.target.value)}
                placeholder="Describe your design style..."
                className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl py-3 pl-9 pr-3 text-sm text-white outline-none transition-all resize-none placeholder:text-slate-700"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function GenerateCreatives() {
  const navigate = useNavigate();
  const { credits, refreshCredits, activeWorkspace, isEditor } = useAuth();
  const { activeJobs, setActiveJobs, clearJobs, allSettled } = useGeneration();
  const [mode, setMode] = useState('auto');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedStatics, setSelectedStatics] = useState([]);
  const [selectedModel, setSelectedModel] = useState('Nano Banana 2');
  const [selectedDisclaimer, setSelectedDisclaimer] = useState('');
  const [numImages, setNumImages] = useState(1);
  const [ratios, setRatios] = useState(['1:1 — Square', '9:16 — Story']);
  const [res, setRes] = useState('1K Standard (~$0.08/img)');
  const [format, setFormat] = useState('PNG');
  const [designRule, setDesignRule] = useState(null);
  const [customDesignText, setCustomDesignText] = useState('');
  const [extraPrompt, setExtraPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [isAddingCampaign, setIsAddingCampaign] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  const [disclaimers, setDisclaimers] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [brandKitLogos, setBrandKitLogos] = useState([]);
  const [defaultLogoId, setDefaultLogoId] = useState(null);
  const [selectedLogoId, setSelectedLogoId] = useState(null);
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [uploadingStatic, setUploadingStatic] = useState(false);
  const [uploadNotice, setUploadNotice] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const [mentionIdx, setMentionIdx] = useState(0);
  const staticInputRef = useRef(null);
  const extraPromptRef = useRef(null);
  const useFingerprint = true; // always on — no user toggle
  const [fingerprintStatus, setFingerprintStatus] = useState(null);
  const [blendWeight, setBlendWeight] = useState(50); // 0=pure refs, 100=pure fingerprint
  const [simplicityMode, setSimplicityMode] = useState(false);
  const [simplicityWeight, setSimplicityWeight] = useState(50); // 0=rich/detailed, 100=ultra-minimal

  // Trend Scout (campaign-independent daily ideas)
  const [trendBrief, setTrendBrief] = useState(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [activeTrendIdeaId, setActiveTrendIdeaId] = useState(null);
  const trendPollRef = useRef(null);
  // Prompt Architect runs at generate-time (not on card select)
  const [architectLoading, setArchitectLoading] = useState(false);

  // Campaign Intelligence
  const [campaignIntel, setCampaignIntel] = useState(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelResearching, setIntelResearching] = useState(false);
  const [selectedBriefId, setSelectedBriefId] = useState(null);
  const [intelBriefs, setIntelBriefs] = useState([]);
  const [showBriefDetail, setShowBriefDetail] = useState(null);
  const intelPollRef = useRef(null);
  const [editingCampaignDetails, setEditingCampaignDetails] = useState(false);
  const [campaignEditData, setCampaignEditData] = useState({ target_audience: '', target_region: '', objective: '', campaign_brief: '' });

  // Any creative (generated, uploaded, or edited) can be used as a reference
  // photo, so this picker is just the regular creatives gallery locked to photos.
  const [allTags, setAllTags] = useState([]);
  const [contributorsList, setContributorsList] = useState([]);
  const [referenceFilters, setReferenceFilters] = useState({ ...EMPTY_CREATIVE_FILTERS, mediaType: 'Photo' });
  const {
    creatives: referenceCreatives, setCreatives: setReferenceCreatives,
    loading: loadingReferences, hasMore: hasMoreReferences, sentinelRef: referencesSentinelRef,
  } = useCreativeGallery(referenceFilters, allTags, { pageSize: REFERENCE_PAGE_SIZE });

  useEffect(() => {
    if (!activeWorkspace) return;
    (async () => {
      try {
        const [t, c, d, l, ctr, chars, fp] = await Promise.allSettled([
          creativesApi.tags(),
          brandKitApi.campaigns(),
          brandKitApi.disclaimers(),
          brandKitApi.logos(),
          creativesApi.contributors(),
          brandKitApi.characters(),
          fingerprintApi.status(),
        ]);
        if (t.status === 'fulfilled') {
          setAllTags(t.value?.results || t.value || []);
        }
        if (ctr.status === 'fulfilled') {
          setContributorsList(ctr.value?.results || ctr.value || []);
        }
        if (c.status === 'fulfilled') {
          const list = c.value?.results || c.value || [];
          setCampaigns(list);
          // default: no campaign selected
        }
        if (d.status === 'fulfilled') {
          setDisclaimers(d.value?.results || d.value || []);
        }
        if (l.status === 'fulfilled') {
          const logos = l.value?.results || l.value || [];
          setBrandKitLogos(logos);
          const primary = logos.find(lg => lg.is_primary) || logos[0] || null;
          if (primary) setDefaultLogoId(primary.id);
        }
        if (chars.status === 'fulfilled') {
          setCharacters(Array.isArray(chars.value) ? chars.value : []);
        }
        if (fp.status === 'fulfilled') {
          setFingerprintStatus(fp.value);
        }
      } finally {
        setLoadingData(false);
      }
    })();
  }, [activeWorkspace]);

  // ─── Trend Scout fetch + polling ──────────────────────────────────────────
  const stopTrendPoll = () => {
    if (trendPollRef.current) { clearInterval(trendPollRef.current); trendPollRef.current = null; }
  };

  const fetchTrendBrief = useCallback(async (showLoading = false) => {
    if (showLoading) setTrendLoading(true);
    try {
      const data = await fingerprintApi.trendsGet();
      setTrendBrief(data);
      if (data?.status === 'pending') {
        // Start polling
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
    } catch (_) {
      if (showLoading) setTrendLoading(false);
    } finally {
      if (showLoading) setTrendLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeWorkspace) return;
    fetchTrendBrief(true);
    return () => stopTrendPoll();
  }, [activeWorkspace, fetchTrendBrief]);

  const handleRefreshTrends = async () => {
    setTrendLoading(true);
    setActiveTrendIdeaId(null);
    try {
      await fingerprintApi.trendsRefresh();
      // Backend returns pending; poll will pick it up
      setTrendBrief(prev => ({ ...prev, status: 'pending', ideas: [] }));
      // Start polling
      stopTrendPoll();
      trendPollRef.current = setInterval(async () => {
        try {
          const polled = await fingerprintApi.trendsGet();
          setTrendBrief(polled);
          if (polled?.status !== 'pending') { stopTrendPoll(); setTrendLoading(false); }
        } catch (_) {}
      }, 5000);
    } catch (_) {
      setTrendLoading(false);
    }
  };

  const handleSelectTrendIdea = (idea) => {
    // Just toggle selection — architect runs at generate time
    setActiveTrendIdeaId(prev => prev === idea.id ? null : idea.id);
  };

  // ─── Campaign Intel fetch + polling ───────────────────────────────────────
  const stopIntelPoll = () => {
    if (intelPollRef.current) { clearInterval(intelPollRef.current); intelPollRef.current = null; }
  };

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
      if (data.brief_status === 'ready' && data.brief_count > 0) {
        await loadIntelBriefs(campaignId);
      }
    } catch (_) {}
    finally { if (!silent) setIntelLoading(false); }
  }, [loadIntelBriefs]);

  useEffect(() => {
    stopIntelPoll();
    setCampaignIntel(null);
    setIntelBriefs([]);
    setSelectedBriefId(null);
    setShowBriefDetail(null);
    setEditingCampaignDetails(false);
    if (!selectedCampaignId) return;
    fetchIntel(selectedCampaignId);
    // Pre-fill edit form from campaigns list
    const camp = campaigns.find(c => c.id === selectedCampaignId);
    if (camp) {
      setCampaignEditData({
        target_audience: camp.target_audience || '',
        target_region  : camp.target_region   || '',
        objective      : camp.objective        || '',
        campaign_brief : camp.campaign_brief   || '',
      });
    }
  }, [selectedCampaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll when research or brief generation is pending
  useEffect(() => {
    stopIntelPoll();
    if (!selectedCampaignId || !campaignIntel) return;
    const isPending = campaignIntel.research_status === 'pending' || campaignIntel.brief_status === 'pending';
    if (!isPending) return;
    intelPollRef.current = setInterval(async () => {
      try {
        const data = await fingerprintApi.campaignIntel(selectedCampaignId);
        setCampaignIntel(data);
        if (data.brief_status === 'ready' && data.brief_count > 0) {
          await loadIntelBriefs(selectedCampaignId);
          stopIntelPoll();
        } else if (data.research_status === 'failed' || data.brief_status === 'failed') {
          stopIntelPoll();
        }
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
    try {
      await fingerprintApi.campaignResearch(selectedCampaignId);
      await fetchIntel(selectedCampaignId);
    } catch (_) {}
    finally { setIntelResearching(false); }
  };

  const handleRebrief = async () => {
    if (!selectedCampaignId) return;
    try {
      await fingerprintApi.campaignRebriefs(selectedCampaignId);
      setCampaignIntel(prev => prev ? { ...prev, brief_status: 'pending' } : prev);
    } catch (_) {}
  };

  const handleSelectBrief = (brief) => {
    if (selectedBriefId === brief.id) {
      setSelectedBriefId(null);
      setExtraPrompt('');
      return;
    }
    setSelectedBriefId(brief.id);
    setExtraPrompt(brief.extra_prompt || '');
    // fingerprint is always on — no setter needed
  };

  const BRIEF_TYPE_META = {
    'on-brand'      : { label: 'On-Brand',      color: 'border-blue-500/40 bg-blue-500/5',   chip: 'bg-blue-500/15 text-blue-400 border-blue-500/30',   Icon: Sparkles },
    'trend-forward' : { label: 'Trend-Forward',  color: 'border-amber-500/40 bg-amber-500/5', chip: 'bg-amber-500/15 text-amber-400 border-amber-500/30', Icon: TrendingUp },
    'audience-first': { label: 'Audience-First', color: 'border-green-500/40 bg-green-500/5', chip: 'bg-green-500/15 text-green-400 border-green-500/30',  Icon: Users },
    'the-bet'       : { label: 'The Bet',        color: 'border-violet-500/40 bg-violet-500/5', chip: 'bg-violet-500/15 text-violet-400 border-violet-500/30', Icon: Flame },
  };

  const toggleStatic = (id) => {
    setSelectedStatics((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const handleStaticUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingStatic(true);
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      try {
        const created = await creativesApi.upload(fd);
        setReferenceCreatives((prev) => [{ ...created, thumbnail: created.thumbnail || created.image_url }, ...prev]);
      } catch (_) {}
    }
    e.target.value = '';
    setUploadingStatic(false);
  };

  const handleCreativeUploaded = (created) => {
    setUploadNotice('Uploaded to your creative library.');
    setReferenceCreatives((prev) => [{ ...created, thumbnail: created.thumbnail || created.image_url }, ...prev]);
  };

  // Refresh credits when jobs finish
  useEffect(() => {
    if (allSettled && activeJobs.some(j => j.status === 'done')) refreshCredits();
  }, [allSettled]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerateError(null);
    clearJobs();
    setShowForm(false);

    // If a trend idea is selected, build master prompt via Architect first
    let prebuiltMasterPrompt = null;
    if (mode === 'auto' && activeTrendIdeaId && trendBrief?.ideas) {
      const idea = trendBrief.ideas.find(i => i.id === activeTrendIdeaId);
      if (idea) {
        setArchitectLoading(true);
        try {
          const primaryRatio = ratios[0]?.split(' ')[0] || '1:1';
          const data = await fingerprintApi.buildPrompt(
            { theme: idea.theme, concept: idea.concept, visual_direction: idea.visual_direction, extra_notes: idea.extra_prompt || '' },
            primaryRatio,
            useFingerprint,
          );
          prebuiltMasterPrompt = data.master_prompt || null;
        } catch (_err) {
          setArchitectLoading(false);
          setIsGenerating(false);
          setGenerateError({ type: 'error', message: 'Failed to build trend prompt. Please try again.' });
          return;
        }
        setArchitectLoading(false);
      }
    }

    const basePayload = {
      generation_mode: mode,
      static_ids: selectedStatics,
      character_id: selectedCharacterId || null,
      model_name: mode === 'auto' ? 'GPT Image 2' : selectedModel,
      num_images: numImages,
      resolution: '1K',
      output_format: 'png',
      style: null,
      campaign_id: selectedCampaignId || null,
      disclaimer_id: selectedDisclaimer || null,
      extra_prompt: extraPrompt || null,
      negative_prompt: negativePrompt || null,
      use_fingerprint: useFingerprint,
      blend_weight: blendWeight,
      simplicity_mode: simplicityMode,
      simplicity_weight: simplicityMode ? simplicityWeight : null,
      logo_id: mode === 'auto' ? (defaultLogoId || null) : (selectedLogoId || null),
      // Architect-built prompt (from trend idea): backend skips DNA build, uses this directly
      prebuilt_master_prompt: prebuiltMasterPrompt || null,
    };

    setNegativePrompt('');

    try {
      const jobs = await Promise.all(
        ratios.map(r => creativesApi.generate({
          ...basePayload,
          aspect_ratio: r.split(' — ')[0],
        }))
      );
      setActiveJobs(jobs);
      setIsGenerating(false);

      // Save job metadata to localStorage so the Creatives gallery can
      // show placeholder cards while generation runs in the background.
      try {
        const stored = JSON.parse(localStorage.getItem('troxa_pending_jobs') || '[]');
        const entries = jobs.map(j => ({
          id: j.id,
          aspect_ratio: j.aspect_ratio || basePayload.aspect_ratio || '1:1',
          num_images: basePayload.num_images || 1,
        }));
        localStorage.setItem('troxa_pending_jobs', JSON.stringify([...stored, ...entries]));
      } catch { /* localStorage not available */ }
    } catch (err) {
      if (err.status === 402) {
        setGenerateError({
          type: 'credits',
          message: err.data?.detail || `Not enough credits. Need ${err.data?.required || totalNeeded}, have ${err.data?.balance ?? credits?.balance ?? 0}.`,
        });
      } else {
        setGenerateError({ type: 'error', message: err.message || 'Generation failed. Please try again.' });
      }
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    clearJobs();
    setIsGenerating(false);
    setShowForm(false);
  };

  const addCampaign = async () => {
    if (!newCampaignName.trim()) return;
    try {
      const created = await brandKitApi.createCampaign(newCampaignName.trim());
      setCampaigns((prev) => [...prev, created]);
      setSelectedCampaignId(created.id);
    } catch (_) {}
    setNewCampaignName('');
    setIsAddingCampaign(false);
  };

  const costPerImg = (models.find(m => m.name === selectedModel)?.credits ?? 1);
  const totalNeeded = Math.max(selectedStatics.length, 1) * numImages * ratios.length * costPerImg;
  const creditBalance = credits?.balance ?? 0;

  if (activeJobs.length > 0 && !showForm) {
    return (
      <div className="pb-10">
        <AnimatePresence mode="wait">
          <motion.div key="progress" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <ProgressScreen
              jobs={activeJobs}
              onView={() => navigate('/dashboard/gallery')}
              onReset={handleReset}
              onContinue={() => { setShowForm(true); setIsGenerating(false); }}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  const mentionMatches = characters.filter(c =>
    c.name.toLowerCase().startsWith(mentionQuery.toLowerCase())
  );

  const handleExtraPromptChange = (e) => {
    const val = e.target.value;
    setExtraPrompt(val);
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const m = before.match(/@(\w*)$/);
    if (m && characters.length > 0) {
      setMentionStart(before.length - m[0].length);
      setMentionQuery(m[1]);
      setMentionOpen(true);
      setMentionIdx(0);
    } else {
      setMentionOpen(false);
    }
  };

  const insertMention = (char) => {
    const before = extraPrompt.slice(0, mentionStart);
    const after = extraPrompt.slice(mentionStart + 1 + mentionQuery.length);
    setExtraPrompt(before + '@[' + char.name + ']' + after);
    setMentionOpen(false);
    setTimeout(() => extraPromptRef.current?.focus(), 0);
  };

  const handleExtraPromptKeyDown = (e) => {
    if (!mentionOpen || !mentionMatches.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, mentionMatches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); insertMention(mentionMatches[mentionIdx]); }
    else if (e.key === 'Escape') { setMentionOpen(false); }
  };

  return (
    <>
    <div className="pb-10">

      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-blue-400" />
            </div>
            AI Creative Engine
          </h1>
          <p className="text-slate-500 text-sm mt-1 ml-12">Transform reference photos into high-performance iGaming assets</p>
        </div>
        <div className="flex items-center gap-2 ml-12 md:ml-0">
          <span className="px-3 py-1.5 bg-white/4 border border-white/6 rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-widest">
            {creditBalance} Credits Left
          </span>
          <UploadCreativeButton onUploaded={handleCreativeUploaded} label="Upload" />
        </div>
      </div>

      {/* Upload notice */}
      <AnimatePresence>
        {uploadNotice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-3.5 bg-emerald-500/8 border border-emerald-500/20 rounded-2xl flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-xs font-bold text-emerald-300">{uploadNotice}</p>
              <Link to="/dashboard/gallery" className="text-xs text-blue-400 hover:text-blue-300">View in Gallery →</Link>
            </div>
            <button onClick={() => setUploadNotice(null)} className="text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error banner */}
      <AnimatePresence>
        {generateError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mb-6 p-4 rounded-2xl flex items-start gap-3 ${generateError.type === 'credits' ? 'bg-amber-500/8 border border-amber-500/20' : 'bg-red-500/8 border border-red-500/20'}`}
          >
            <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${generateError.type === 'credits' ? 'text-amber-400' : 'text-red-400'}`} />
            <div className="flex-1">
              <p className={`text-sm font-bold ${generateError.type === 'credits' ? 'text-amber-300' : 'text-red-300'}`}>{generateError.message}</p>
              {generateError.type === 'credits' && (
                <Link to="/dashboard/workspace?tab=billing" className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block">Upgrade your plan →</Link>
              )}
            </div>
            <button onClick={() => setGenerateError(null)} className="text-slate-600 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left – Reference Photo Grid */}
        <div style={GLASS_STYLE} className="flex-1 rounded-2xl overflow-hidden flex flex-col min-h-96">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image className={`w-4 h-4 ${selectedCharacterId ? 'text-slate-700' : 'text-slate-500'}`} />
              <h2 className={`font-black text-sm ${selectedCharacterId ? 'text-slate-600' : 'text-white'}`}>Reference Photos</h2>
              {selectedCharacterId && <span className="text-[10px] text-slate-600 font-normal">overridden by character</span>}
            </div>
            <div className="flex items-center gap-3">
              {selectedStatics.length > 0 && (
                <motion.span
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-[10px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg"
                >
                  {selectedStatics.length} selected
                </motion.span>
              )}
              <AnimatePresence>
                {selectedStatics.length > 0 && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => setSelectedStatics([])}
                    className="text-[10px] uppercase font-semibold text-red-500/60 hover:text-red-500/80 transition-colors"
                  >
                    Clear
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="px-6 py-4 border-b border-white/5">
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

          <div className="flex-1 p-5">
            {loadingReferences ? (
              <CreativeGridSkeleton count={8} columns="grid-cols-2 md:grid-cols-3 xl:grid-cols-4" gap="gap-3" cardRounded="rounded-xl" showMeta={false} glass={false} />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {referenceCreatives.map((item) => {
                  const selected = selectedStatics.includes(item.id);
                  const captioning = item.caption_status === 'pending' || item.caption_status === 'processing';
                  return (
                    <motion.div
                      key={item.id}
                      onClick={() => toggleStatic(item.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`group relative rounded-xl overflow-hidden aspect-4/5 cursor-pointer border-2 transition-all ${selected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-transparent hover:border-white/15'}`}
                    >
                      <img
                        src={creativeProxyUrl(item.id)}
                        className={`w-full h-full object-cover transition-all duration-300 ${selected ? 'opacity-100' : 'opacity-55 group-hover:opacity-85'}`}
                        alt={item.name}
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent" />
                      {captioning && (
                        <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-black/60 text-slate-300 backdrop-blur-sm flex items-center gap-1">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" /> Captioning
                        </span>
                      )}
                      <AnimatePresence>
                        {selected && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-md flex items-center justify-center shadow-lg shadow-blue-600/50 border border-blue-400/40"
                          >
                            <Check className="w-3 h-3 text-white stroke-3" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}

                <input ref={staticInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleStaticUpload} />
                <button
                  type="button"
                  onClick={() => staticInputRef.current?.click()}
                  disabled={uploadingStatic}
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/8 hover:border-blue-500/30 hover:bg-blue-500/4 transition-all group aspect-4/5 cursor-pointer disabled:opacity-60"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/4 group-hover:bg-blue-500/10 border border-white/6 group-hover:border-blue-500/20 flex items-center justify-center mb-2 transition-all">
                    {uploadingStatic ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" /> : <Plus className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors" />}
                  </div>
                  <span className="text-[9px] font-black text-slate-700 group-hover:text-blue-400 uppercase tracking-widest transition-colors text-center">{uploadingStatic ? 'Uploading…' : 'Add Reference'}</span>
                </button>
              </div>
            )}
            {!loadingReferences && hasMoreReferences && (
              <div ref={referencesSentinelRef} className="flex items-center justify-center py-6">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Right – Settings Panel */}
        <div className="w-full lg:w-96 space-y-4">
          {/* Mode Switcher */}
          <div style={GLASS_STYLE} className="rounded-2xl p-1.5 flex gap-1.5">
            {[{ key: 'auto', label: 'Auto', Icon: Wand2 }, { key: 'custom', label: 'Custom', Icon: Sliders }].map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${mode === key ? 'text-white' : 'text-slate-600 hover:text-slate-400'}`}
              >
                {mode === key && (
                  <motion.div
                    layoutId="mode-pill"
                    className="absolute inset-0 bg-blue-600 rounded-xl shadow-lg shadow-blue-600/25"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className="relative w-3.5 h-3.5" />
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>

          {/* ── Campaign Selector (visible in both modes) ── */}
          <div style={GLASS_STYLE} className="rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Campaign</label>
              <button type="button" onClick={() => setIsAddingCampaign(!isAddingCampaign)} className="text-[10px] font-black text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors uppercase tracking-wider">
                {isAddingCampaign ? 'Cancel' : '+ New'}
              </button>
            </div>
            <AnimatePresence mode="wait">
              {isAddingCampaign ? (
                <motion.div key="adding" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="flex gap-2">
                  <input type="text" value={newCampaignName} onChange={(e) => setNewCampaignName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCampaign()} placeholder="Campaign name..." className="flex-1 bg-[#0c0f1a] border border-white/8 focus:border-blue-500 rounded-xl py-2.5 px-3 text-sm text-white outline-none transition-all placeholder:text-slate-700" />
                  <button onClick={addCampaign} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl transition-all">Add</button>
                  <button onClick={() => { setIsAddingCampaign(false); setNewCampaignName(''); }} className="p-2 bg-white/5 border border-white/8 text-slate-400 hover:text-white rounded-xl transition-all"><X className="w-4 h-4" /></button>
                </motion.div>
              ) : (
                <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
                  <select value={selectedCampaignId} onChange={(e) => setSelectedCampaignId(e.target.value)} className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl py-3 px-4 text-sm text-white outline-none appearance-none cursor-pointer transition-all">
                    <option value="">— No campaign —</option>
                    {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Campaign Intelligence Panel (visible in both modes) ── */}
          <AnimatePresence>
          {selectedCampaignId && (
                  <motion.div
                    key="intel-panel"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    style={GLASS_STYLE}
                    className="rounded-2xl p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                          <Brain className="w-3 h-3 text-blue-400" />
                        </div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Campaign Intel</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {campaignIntel?.has_audience && !editingCampaignDetails && (
                          <button
                            onClick={() => {
                              const camp = campaigns.find(c => c.id === selectedCampaignId);
                              if (camp) setCampaignEditData({ target_audience: camp.target_audience || '', target_region: camp.target_region || '', objective: camp.objective || '', campaign_brief: camp.campaign_brief || '' });
                              setEditingCampaignDetails(true);
                            }}
                            className="text-[10px] font-black text-slate-600 hover:text-slate-400 flex items-center gap-1 transition-colors uppercase tracking-wider"
                          >
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

                    {/* Loading intel */}
                    {intelLoading && (
                      <div className="flex items-center gap-2 py-2">
                        <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
                        <span className="text-xs text-slate-600">Loading intelligence…</span>
                      </div>
                    )}

                    {/* Campaign detail form — shown when no audience OR editing */}
                    {!intelLoading && campaignIntel && (!campaignIntel.has_audience || editingCampaignDetails) && (
                      <div className="space-y-2 pt-0.5">
                        {!campaignIntel.has_audience && (
                          <p className="text-[10px] text-slate-600">Target audience is required to start research.</p>
                        )}
                        <textarea
                          rows={2}
                          value={campaignEditData.target_audience}
                          onChange={(e) => setCampaignEditData(prev => ({ ...prev, target_audience: e.target.value }))}
                          placeholder="Target audience (e.g. 25-35 male, sports fans...)"
                          className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl p-2.5 text-xs text-white outline-none transition-all resize-none placeholder:text-slate-700"
                        />
                        <input
                          type="text"
                          value={campaignEditData.target_region}
                          onChange={(e) => setCampaignEditData(prev => ({ ...prev, target_region: e.target.value }))}
                          placeholder="Target region (e.g. UK, US, MENA...)"
                          className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl py-2.5 px-3 text-xs text-white outline-none transition-all placeholder:text-slate-700"
                        />
                        <div className="relative">
                          <select
                            value={campaignEditData.objective}
                            onChange={(e) => setCampaignEditData(prev => ({ ...prev, objective: e.target.value }))}
                            className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl py-2.5 px-3 text-xs text-white outline-none appearance-none cursor-pointer transition-all"
                          >
                            <option value="">Select objective...</option>
                            <option value="acquisition">Acquisition</option>
                            <option value="retention">Retention</option>
                            <option value="awareness">Brand Awareness</option>
                            <option value="reactivation">Reactivation</option>
                            <option value="event">Event / Seasonal</option>
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
                        </div>
                        <textarea
                          rows={2}
                          value={campaignEditData.campaign_brief}
                          onChange={(e) => setCampaignEditData(prev => ({ ...prev, campaign_brief: e.target.value }))}
                          placeholder="Campaign brief (optional)"
                          className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl p-2.5 text-xs text-white outline-none transition-all resize-none placeholder:text-slate-700"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={saveCampaignDetails}
                            disabled={!campaignEditData.target_audience.trim()}
                            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black text-xs rounded-xl transition-all"
                          >
                            Save
                          </button>
                          {editingCampaignDetails && (
                            <button
                              onClick={() => setEditingCampaignDetails(false)}
                              className="px-3 py-2 bg-white/5 border border-white/8 text-slate-400 hover:text-white text-xs rounded-xl transition-all"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Research not started */}
                    {!intelLoading && campaignIntel?.has_audience && campaignIntel?.research_status === null && (
                      <button
                        onClick={handleStartResearch}
                        disabled={intelResearching}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-500/8 border border-blue-500/20 hover:bg-blue-500/12 hover:border-blue-500/30 rounded-xl text-xs font-black text-blue-400 transition-all disabled:opacity-60"
                      >
                        {intelResearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                        Start market research
                      </button>
                    )}

                    {/* Pending: research running */}
                    {!intelLoading && (campaignIntel?.research_status === 'pending' || (campaignIntel?.research_status === 'ready' && campaignIntel?.brief_status === 'pending')) && (
                      <div className="flex items-center gap-2.5 py-1">
                        <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
                        <div>
                          <p className="text-xs text-slate-400 font-bold">
                            {campaignIntel?.research_status === 'pending' ? 'Researching market…' : 'Preparing brief…'}
                          </p>
                          <p className="text-[10px] text-slate-600">~20-40 seconds</p>
                        </div>
                      </div>
                    )}

                    {/* Failed */}
                    {!intelLoading && (campaignIntel?.research_status === 'failed' || campaignIntel?.brief_status === 'failed') && (
                      <div className="flex items-center justify-between py-1">
                        <span className="text-[10px] text-red-400">Research failed.</span>
                        <button onClick={handleStartResearch} className="text-[10px] font-black text-blue-400 hover:text-blue-300 transition-colors">Try again</button>
                      </div>
                    )}

                    {/* Stale warning */}
                    {!intelLoading && campaignIntel?.brief_status === 'ready' && campaignIntel?.fingerprint_stale && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/8 border border-amber-500/20 rounded-xl">
                        <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="text-[10px] text-amber-400">Fingerprint updated — briefs may be outdated</span>
                      </div>
                    )}

                    {/* Brief cards */}
                    {!intelLoading && intelBriefs.length > 0 && (
                      <div className="space-y-2 pt-1">
                        {intelBriefs.map((brief) => {
                          const meta = BRIEF_TYPE_META[brief.type] || BRIEF_TYPE_META['on-brand'];
                          const isSelected = selectedBriefId === brief.id;
                          const BriefIcon = meta.Icon;
                          return (
                            <motion.button
                              key={brief.id}
                              onClick={() => handleSelectBrief(brief)}
                              whileHover={{ scale: 1.005 }}
                              whileTap={{ scale: 0.995 }}
                              className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                                isSelected
                                  ? meta.color + ' ring-1 ring-inset ring-white/10'
                                  : 'border-white/6 hover:border-white/12 bg-white/2 hover:bg-white/4'
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${isSelected ? meta.chip.split(' ').slice(0,2).join(' ') : 'bg-white/5'}`}>
                                  <BriefIcon className={`w-3 h-3 ${isSelected ? meta.chip.split(' ')[1] : 'text-slate-600'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${meta.chip}`}>
                                      {meta.label}
                                    </span>
                                    {brief.confidence === 'experimental' && (
                                      <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/20">
                                        Risk
                                      </span>
                                    )}
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

          {/* ── Auto mode: output settings ── */}
          {mode === 'auto' && (
            <div style={GLASS_STYLE} className="rounded-2xl p-5 space-y-4">
              <AspectRatioSelector ratios={ratios} onChange={setRatios} />
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Images per Reference</label>
                <div className="flex gap-2">
                  {[1,2,3,4].map((n) => (
                    <button key={n} onClick={() => setNumImages(n)} className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${numImages === n ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white/4 border border-white/6 text-slate-500 hover:text-white hover:border-white/10'}`}>{n}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Auto mode: Trend Scout ideas ── */}
          {mode === 'auto' && (
            <div style={GLASS_STYLE} className="rounded-2xl p-5 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-lg bg-orange-500/15 border border-orange-500/20 flex items-center justify-center">
                    <Flame className="w-3 h-3 text-orange-400" />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Daily Trend Ideas</span>
                  {trendBrief?.status === 'ready' && trendBrief.ideas?.length > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/15 text-orange-400 font-black">
                      {trendBrief.ideas.length} ideas
                    </span>
                  )}
                </div>
                <button
                  onClick={handleRefreshTrends}
                  disabled={trendLoading || trendBrief?.status === 'pending'}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3 h-3 ${trendLoading || trendBrief?.status === 'pending' ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {/* Trend brief loading */}
              {(trendLoading || trendBrief?.status === 'pending') && (
                <div className="flex items-center gap-2 py-1">
                  <Loader2 className="w-3 h-3 text-orange-400 animate-spin shrink-0" />
                  <span className="text-[10px] text-slate-500">Researching trends...</span>
                </div>
              )}

              {/* Idea cards — horizontal scroll */}
              {trendBrief?.status === 'ready' && trendBrief.ideas?.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {trendBrief.ideas.map(idea => {
                    const isActive = activeTrendIdeaId === idea.id;
                    return (
                      <button
                        key={idea.id}
                        onClick={() => handleSelectTrendIdea(idea)}
                        className={`shrink-0 w-36 text-left p-2 rounded-xl border transition-all ${
                          isActive
                            ? 'bg-orange-500/12 border-orange-500/40'
                            : 'bg-white/3 border-white/6 hover:border-white/12 hover:bg-white/5'
                        }`}
                      >
                        <p className={`text-[10px] font-black leading-tight mb-1 ${isActive ? 'text-orange-300' : 'text-white'}`}>
                          {idea.theme}
                        </p>
                        <p className="text-[9px] text-slate-500 leading-relaxed line-clamp-2">
                          {idea.concept}
                        </p>
                        <p className="mt-1.5 text-[9px] font-black uppercase tracking-wide">
                          {isActive
                            ? <span className="text-orange-400 flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5 inline" /> Selected</span>
                            : <span className="text-slate-600">Select →</span>
                          }
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Failed state */}
              {trendBrief?.status === 'failed' && !trendLoading && (
                <p className="text-xs text-red-400">Trend research failed. You can click the Refresh button.</p>
              )}
            </div>
          )}

          {/* ── Custom mode: Character + Model + Settings ── */}
          {mode === 'custom' && (
            <>
              {/* Character Selector */}
              {characters.length > 0 && (
                <div style={GLASS_STYLE} className="rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
                      <Sparkles className="w-3 h-3 text-violet-400" />
                    </div>
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Character</span>
                    <span className="text-[10px] text-slate-700 font-normal normal-case tracking-normal">(optional)</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedCharacterId('')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        !selectedCharacterId
                          ? 'bg-white/8 border-white/15 text-white'
                          : 'border-white/6 text-slate-500 hover:text-slate-300 hover:border-white/10'
                      }`}
                    >
                      None
                    </button>
                    {characters.map(char => (
                      <button
                        key={char.id}
                        onClick={() => setSelectedCharacterId(selectedCharacterId === char.id ? '' : char.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          selectedCharacterId === char.id
                            ? 'bg-violet-500/15 border-violet-500/30 text-violet-300'
                            : 'border-white/6 text-slate-400 hover:text-white hover:border-white/12'
                        }`}
                      >
                        {char.name}
                        {char.images?.length > 0 && (
                          <span className="text-[9px] opacity-60">{char.images.length} img</span>
                        )}
                      </button>
                    ))}
                  </div>
                  {selectedCharacterId && (
                    <p className="text-[10px] text-violet-400/70">Reference photos overridden by character</p>
                  )}
                </div>
              )}

              {/* Model Selection */}
              <div style={GLASS_STYLE} className="rounded-2xl p-5 space-y-3">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">AI Model</label>
                <div className="space-y-2">
                  {models.map((model) => (
                    <motion.button key={model.name} whileHover={{ scale: 1.005 }} whileTap={{ scale: 0.995 }} onClick={() => setSelectedModel(model.name)} className={`w-full px-3.5 py-3 text-left border rounded-xl transition-all flex items-center justify-between ${selectedModel === model.name ? 'border-blue-500 bg-blue-500/6' : 'border-white/6 hover:border-white/10'}`}>
                      <p className="text-sm font-black text-white">{model.name}</p>
                      <span className="text-[10px] text-slate-500 font-bold shrink-0">{model.credits} cr/img</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Settings */}
              <div style={GLASS_STYLE} className="rounded-2xl p-5 space-y-4">
                <AspectRatioSelector ratios={ratios} onChange={setRatios} />
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Images per Reference</label>
                  <div className="flex gap-2">
                    {[1,2,3,4].map((n) => (
                      <button key={n} onClick={() => setNumImages(n)} className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${numImages === n ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white/4 border border-white/6 text-slate-500 hover:text-white hover:border-white/10'}`}>{n}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                    Extra Instructions <span className="text-slate-700 normal-case font-normal">(optional{characters.length > 0 ? ' — type @ to mention a character' : ''})</span>
                  </label>
                  <div className="relative">
                    <textarea
                      ref={extraPromptRef}
                      rows={3}
                      value={extraPrompt}
                      onChange={handleExtraPromptChange}
                      onKeyDown={handleExtraPromptKeyDown}
                      onBlur={() => setTimeout(() => setMentionOpen(false), 150)}
                      placeholder="Additional instructions..."
                      className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl p-3 text-sm text-white outline-none transition-all resize-none placeholder:text-slate-700"
                    />
                    {mentionOpen && mentionMatches.length > 0 && (
                      <div className="absolute z-50 top-full left-0 mt-1 w-full bg-[#0c0f1a] border border-white/12 rounded-xl overflow-hidden shadow-xl shadow-black/40">
                        {mentionMatches.map((char, i) => (
                          <button
                            key={char.id}
                            onMouseDown={(e) => { e.preventDefault(); insertMention(char); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${i === mentionIdx ? 'bg-violet-500/15 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                          >
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
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Negative Prompt <span className="text-slate-700 normal-case font-normal">(optional)</span></label>
                  <textarea rows={2} value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} placeholder="What to avoid: blur, text, watermark..." className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-red-500/50 rounded-xl p-3 text-sm text-white outline-none transition-all resize-none placeholder:text-slate-700" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Disclaimer Overlay <span className="text-slate-700 normal-case font-normal">(optional)</span></label>
                  <div className="relative">
                    <select value={selectedDisclaimer} onChange={(e) => setSelectedDisclaimer(e.target.value)} className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl py-3 px-4 text-sm text-white outline-none appearance-none cursor-pointer transition-all">
                      <option value="">None</option>
                      {disclaimers.map((d) => <option key={d.id} value={d.id}>{d.text?.substring(0, 40)}...</option>)}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                  </div>
                </div>
                {/* Logo */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Logo <span className="text-slate-700 normal-case font-normal">(optional)</span></label>
                  {(() => {
                    const sel = brandKitLogos.find(l => l.id === selectedLogoId);
                    return sel ? (
                      <div className="flex items-center gap-3 p-2.5 bg-white/4 border border-white/8 rounded-xl">
                        <img src={sel.file_url} alt={sel.name} className="w-10 h-10 object-contain rounded-lg bg-white/5 p-1 shrink-0" loading="lazy" decoding="async" />
                        <span className="flex-1 text-xs text-white truncate">{sel.name}</span>
                        <button onClick={() => setShowLogoModal(true)} className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors">Change</button>
                        <button onClick={() => setSelectedLogoId(null)} className="p-1 text-slate-500 hover:text-white transition-colors"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <button onClick={() => setShowLogoModal(true)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 bg-white/4 border border-dashed border-white/10 hover:border-blue-500/40 hover:bg-blue-500/5 rounded-xl text-xs text-slate-500 hover:text-blue-400 font-black uppercase tracking-widest transition-all">
                        <Plus className="w-3.5 h-3.5" /> Add Logo
                      </button>
                    );
                  })()}
                </div>
              </div>
            </>
          )}

          {/* CTA */}
          <div style={GLASS_STYLE} className="rounded-2xl p-5">
            {mode === 'custom' && (
              <>
                <div className="flex items-center justify-between mb-4 p-3 bg-blue-500/4 border border-blue-500/12 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Credits needed</span>
                  </div>
                  <span className="text-sm font-black text-white">{totalNeeded}</span>
                </div>

                {selectedStatics.length === 0 && (
                  <div className="mb-3 flex items-center gap-2 text-[10px] text-slate-600">
                    <Wand2 className="w-3 h-3 text-blue-500/60 shrink-0" />
                    <span>No reference selected — AI will generate a betting ad autonomously</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] text-slate-700 mb-4">
                  <span>{Math.max(selectedStatics.length, 1)} ref{selectedStatics.length !== 1 ? 's' : ''}</span>
                  <span>×</span>
                  <span>{numImages} img{numImages !== 1 ? 's' : ''}</span>
                  {ratios.length > 1 && <><span>×</span><span>{ratios.length} formats</span></>}
                  <span>=</span>
                  <span className="font-bold text-slate-500">{totalNeeded} total</span>
                </div>
              </>
            )}

            {creditBalance < totalNeeded && (
              <div className="mb-3 p-2.5 bg-amber-500/8 border border-amber-500/20 rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <p className="text-[10px] text-amber-300">Only {creditBalance} credits left. <Link to="/dashboard/workspace?tab=billing" className="text-blue-400 hover:text-blue-300">Upgrade →</Link></p>
              </div>
            )}

            {!isEditor && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/8 border border-red-500/20 rounded-xl">
                <Lock className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <p className="text-xs text-red-400 font-bold">Analysts cannot generate creatives.</p>
              </div>
            )}
            {mode === 'auto' && !defaultLogoId && brandKitLogos.length === 0 && (
              <div className="mb-3 flex items-center gap-2 px-4 py-2.5 bg-amber-500/8 border border-amber-500/20 rounded-xl">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <p className="text-[10px] text-amber-300">Auto mode requires a logo. <Link to="/dashboard/brand-kit" className="text-blue-400 hover:text-blue-300">Add to Brand Kit →</Link></p>
              </div>
            )}
            {/* Brand Fingerprint — always on, no toggle */}
            {fingerprintStatus?.exists && fingerprintStatus?.has_visual_dna && (
              <div className="mb-3">
                <div className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border bg-violet-500/10 border-violet-500/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-violet-300">✦ Brand Fingerprint</p>
                    <p className="text-[10px] text-slate-600 truncate">
                      Active · {fingerprintStatus.confidence} confidence · {fingerprintStatus.corpus_count} imgs
                    </p>
                  </div>
                </div>

                {/* Blend slider — shown when references are selected */}
                {selectedStatics.length > 0 && (
                  <div className="mt-2 px-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-slate-500 font-medium">References</span>
                      <span className="text-[10px] text-violet-400 font-black">
                        {blendWeight <= 20 ? 'Pure References' : blendWeight <= 45 ? 'Refs Dominant' : blendWeight <= 65 ? 'Balanced' : blendWeight <= 85 ? 'DNA Dominant' : 'Pure Brand DNA'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">Brand DNA</span>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={blendWeight}
                        onChange={e => setBlendWeight(Number(e.target.value))}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${blendWeight}%, rgba(255,255,255,0.08) ${blendWeight}%, rgba(255,255,255,0.08) 100%)`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Simplicity toggle */}
            <div className="mb-3">
              <button
                type="button"
                onClick={() => setSimplicityMode(v => !v)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                  simplicityMode
                    ? 'bg-sky-500/10 border-sky-500/30'
                    : 'bg-white/3 border-white/6 hover:border-white/12'
                }`}
              >
                <div className={`rounded-full relative transition-colors shrink-0 ${simplicityMode ? 'bg-sky-500' : 'bg-white/10'}`}
                  style={{ height: '18px', width: '32px' }}>
                  <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all ${simplicityMode ? 'left-[14px]' : 'left-0.5'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-black ${simplicityMode ? 'text-sky-300' : 'text-slate-500'}`}>
                    ◈ Simplicity
                  </p>
                  <p className="text-[10px] text-slate-600 truncate">
                    {simplicityMode
                      ? simplicityWeight <= 20 ? 'Rich & Detailed' : simplicityWeight <= 40 ? 'Slightly Simplified' : simplicityWeight <= 60 ? 'Balanced' : simplicityWeight <= 80 ? 'Minimal' : 'Ultra Minimal'
                      : 'Control visual complexity of the output'
                    }
                  </p>
                </div>
              </button>

              {/* Simplicity weight slider — shown when toggle is ON */}
              {simplicityMode && (
                <div className="mt-2 px-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-slate-500 font-medium">Rich</span>
                    <span className="text-[10px] text-sky-400 font-black">
                      {simplicityWeight <= 20 ? 'Rich & Detailed' : simplicityWeight <= 40 ? 'Slightly Simplified' : simplicityWeight <= 60 ? 'Balanced' : simplicityWeight <= 80 ? 'Minimal' : 'Ultra Minimal'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">Minimal</span>
                  </div>
                  <div className="relative">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={simplicityWeight}
                      onChange={e => setSimplicityWeight(Number(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, rgba(14,165,233,0.8) 0%, rgba(14,165,233,0.8) ${simplicityWeight}%, rgba(255,255,255,0.08) ${simplicityWeight}%, rgba(255,255,255,0.08) 100%)`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <motion.button
              onClick={handleGenerate}
              disabled={isGenerating || architectLoading || creditBalance < totalNeeded || !isEditor || (mode === 'auto' && !defaultLogoId)}
              whileHover={!isGenerating && !architectLoading && isEditor ? { scale: 1.01 } : {}}
              whileTap={!isGenerating && !architectLoading && isEditor ? { scale: 0.99 } : {}}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/50 disabled:cursor-not-allowed text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
            >
              {architectLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Building prompt...</>
              ) : isGenerating ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</>
              ) : (
                <>
                  {mode === 'auto' && activeTrendIdeaId ? <Brain className="w-4 h-4" /> : <Zap className="w-4 h-4 fill-current" />}
                  {ratios.length > 1 ? `Generate ${ratios.length} Formats` : 'Start Generation'}
                  {mode === 'auto' && activeTrendIdeaId && (
                    <span className="text-[10px] font-normal opacity-70 ml-1">· Trend</span>
                  )}
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </div>

    {/* Logo picker modal */}

    <AnimatePresence>
      {showLogoModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-9999 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowLogoModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ duration: 0.18 }}
            className="bg-[#10141d] border border-white/8 rounded-3xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-black text-white uppercase tracking-widest">Select Logo</h2>
              <button onClick={() => setShowLogoModal(false)} className="p-1.5 text-slate-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {brandKitLogos.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <p className="text-sm text-slate-500">No logos in your Brand Kit yet.</p>
                <Link to="/dashboard/brand-kit" onClick={() => setShowLogoModal(false)}
                  className="inline-block text-xs font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest transition-colors">
                  Go to Brand Kit →
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {brandKitLogos.map((logo) => {
                  const isSelected = selectedLogoId === logo.id;
                  return (
                    <button key={logo.id}
                      onClick={() => { setSelectedLogoId(isSelected ? null : logo.id); setShowLogoModal(false); }}
                      className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${isSelected ? 'border-blue-500 bg-blue-500/10' : 'border-white/8 bg-white/3 hover:border-white/20 hover:bg-white/6'}`}>
                      <div className="w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden">
                        <img src={logo.file_url} alt={logo.name} className="w-full h-full object-contain p-2" loading="lazy" decoding="async" />
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate w-full text-center">{logo.name}</span>
                      {isSelected && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle2 className="w-4 h-4 text-blue-400" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
