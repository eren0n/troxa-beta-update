import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Check, Plus, Zap, X, Sparkles, Image, SlidersHorizontal, ChevronDown, Info, Wand2, Sliders, PenLine, AlertTriangle, ArrowRight, Loader2, Lock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useGeneration } from '../../contexts/GenerationContext';
import { brandKitApi, creativesApi } from '../../lib/api';

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
    <div className="flex flex-col items-center justify-center min-h-[500px] gap-10 py-16">
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
  { name: 'Nano Banana 2', meta: 'Fast • $0.06/img', badge: 'Recommended', badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  { name: 'GPT Image 2', meta: 'Balanced • $0.20/img', badge: 'High Quality', badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/20' },
  { name: 'Grok Imagine', meta: 'Ultra-Fast • $0.02/img', badge: 'Budget', badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
];

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
  const [statics, setStatics] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [disclaimers, setDisclaimers] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [brandKitLogos, setBrandKitLogos] = useState([]);
  const [defaultLogoId, setDefaultLogoId] = useState(null);
  const [selectedLogoId, setSelectedLogoId] = useState(null);
  const [showLogoModal, setShowLogoModal] = useState(false);

  useEffect(() => {
    if (!activeWorkspace) return;
    (async () => {
      try {
        const [s, c, d, l] = await Promise.allSettled([
          brandKitApi.statics(),
          brandKitApi.campaigns(),
          brandKitApi.disclaimers(),
          brandKitApi.logos(),
        ]);
        if (s.status === 'fulfilled') {
          setStatics(s.value?.results || s.value || []);
        }
        if (c.status === 'fulfilled') {
          const list = c.value?.results || c.value || [];
          setCampaigns(list);
          if (list.length > 0) setSelectedCampaignId(list[0].id);
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
      } finally {
        setLoadingData(false);
      }
    })();
  }, [activeWorkspace]);

  const toggleStatic = (id) => {
    setSelectedStatics((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
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
    const basePayload = {
      generation_mode: mode,
      static_ids: selectedStatics,
      model_name: selectedModel,
      num_images: numImages,
      resolution: res.split(' ')[0],
      output_format: format.toLowerCase().replace('jpg', 'jpeg'),
      style: designRule === 'custom' ? customDesignText : (designRule || null),
      campaign_id: selectedCampaignId || null,
      disclaimer_id: selectedDisclaimer || null,
      extra_prompt: extraPrompt || null,
      negative_prompt: negativePrompt || null,
      logo_id: mode === 'auto' ? (defaultLogoId || null) : (selectedLogoId || null),
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

  const totalNeeded = Math.max(selectedStatics.length, 1) * numImages * ratios.length;
  const creditBalance = credits?.balance ?? 0;

  if (activeJobs.length > 0 && !showForm) {
    return (
      <div className="pb-10">
        <AnimatePresence mode="wait">
          <motion.div key="progress" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <ProgressScreen
              jobs={activeJobs}
              onView={() => navigate('/dashboard/creatives')}
              onReset={handleReset}
              onContinue={() => { setShowForm(true); setIsGenerating(false); }}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

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
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/8 border border-emerald-500/15 rounded-lg">
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Engine Ready</span>
          </div>
        </div>
      </div>

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
                <Link to="/dashboard/billing" className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block">Upgrade your plan →</Link>
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
        <div className="flex-1 bg-[#0b0e1a] border border-white/6 rounded-2xl overflow-hidden flex flex-col min-h-96">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image className="w-4 h-4 text-slate-500" />
              <h2 className="font-black text-white text-sm">Reference Photos</h2>
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

          <div className="flex-1 p-5">
            {loadingData ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {[1,2,3,4].map((i) => <div key={i} className="aspect-4/5 bg-white/3 rounded-xl animate-pulse" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {statics.map((item) => {
                  const selected = selectedStatics.includes(item.id);
                  return (
                    <motion.div
                      key={item.id}
                      onClick={() => toggleStatic(item.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`group relative rounded-xl overflow-hidden aspect-4/5 cursor-pointer border-2 transition-all ${selected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-transparent hover:border-white/15'}`}
                    >
                      <img
                        src={item.image_url || item.url}
                        className={`w-full h-full object-cover transition-all duration-300 ${selected ? 'opacity-100' : 'opacity-55 group-hover:opacity-85'}`}
                        alt={item.name}
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent" />
                      <AnimatePresence>
                        {selected && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-md flex items-center justify-center shadow-lg shadow-blue-600/50 border border-blue-400/40"
                          >
                            <Check className="w-3 h-3 text-white stroke-[3]" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}

                <Link
                  to="/dashboard/brand-kit"
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/8 hover:border-blue-500/30 hover:bg-blue-500/4 transition-all group aspect-4/5 cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/4 group-hover:bg-blue-500/10 border border-white/6 group-hover:border-blue-500/20 flex items-center justify-center mb-2 transition-all">
                    <Plus className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors" />
                  </div>
                  <span className="text-[9px] font-black text-slate-700 group-hover:text-blue-400 uppercase tracking-widest transition-colors text-center">Add Reference</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right – Settings Panel */}
        <div className="w-full lg:w-96 space-y-4">
          {/* Mode Switcher */}
          <div className="bg-[#0b0e1a] border border-white/6 rounded-2xl p-1.5 flex gap-1.5">
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

          <AnimatePresence mode="wait">
            {mode === 'auto' ? (
              <motion.div key="auto" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="space-y-4">
                <div className="flex items-start gap-2.5 px-3.5 py-3 bg-blue-500/5 border border-blue-500/12 rounded-xl">
                  <Wand2 className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-slate-500 leading-relaxed">AI automatically selects model, format, and output settings.</p>
                </div>
                <div className="bg-[#0b0e1a] border border-white/6 rounded-2xl p-5 space-y-4">
                  <AspectRatioSelector ratios={ratios} onChange={setRatios} />
                  <SelectField label="Resolution" options={resOptions} value={res} onChange={setRes} />
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Images per Reference</label>
                    <div className="flex gap-2">
                      {[1,2,3,4].map((n) => (
                        <button key={n} onClick={() => setNumImages(n)} className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${numImages === n ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white/4 border border-white/6 text-slate-500 hover:text-white hover:border-white/10'}`}>{n}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="custom" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="space-y-4">
                {/* Campaign */}
                <div className="bg-[#0b0e1a] border border-white/6 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                    <h3 className="font-black text-white text-sm">Generation Settings</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Campaign Target</label>
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
                            {campaigns.length === 0 && <option value="">No campaigns yet</option>}
                            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                          <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Model Selection */}
                <div className="bg-[#0b0e1a] border border-white/6 rounded-2xl p-5 space-y-3">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">AI Model</label>
                  <div className="space-y-2">
                    {models.map((model) => (
                      <motion.button key={model.name} whileHover={{ scale: 1.005 }} whileTap={{ scale: 0.995 }} onClick={() => setSelectedModel(model.name)} className={`w-full p-3.5 text-left border rounded-xl transition-all flex items-center justify-between ${selectedModel === model.name ? 'border-blue-500 bg-blue-500/6' : 'border-white/6 hover:border-white/10'}`}>
                        <div>
                          <p className="text-sm font-black text-white">{model.name}</p>
                          <p className="text-[10px] text-slate-600 mt-0.5">{model.meta}</p>
                        </div>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${model.badgeColor}`}>{model.badge}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#0b0e1a] border border-white/6 rounded-2xl p-5 space-y-4">
                  <AspectRatioSelector ratios={ratios} onChange={setRatios} />
                  <SelectField label="Resolution" options={resOptions} value={res} onChange={setRes} />
                  <SelectField label="Output Format" options={formatOptions} value={format} onChange={setFormat} />
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Images per Reference</label>
                    <div className="flex gap-2">
                      {[1,2,3,4].map((n) => (
                        <button key={n} onClick={() => setNumImages(n)} className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${numImages === n ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white/4 border border-white/6 text-slate-500 hover:text-white hover:border-white/10'}`}>{n}</button>
                      ))}
                    </div>
                  </div>
                  <DesignRuleField value={designRule} customText={customDesignText} onPresetChange={setDesignRule} onCustomTextChange={setCustomDesignText} onClear={() => { setDesignRule(null); setCustomDesignText(''); }} />
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Extra Instructions <span className="text-slate-700 normal-case font-normal">(optional)</span></label>
                    <textarea rows={3} value={extraPrompt} onChange={(e) => setExtraPrompt(e.target.value)} placeholder="Additional instructions..." className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl p-3 text-sm text-white outline-none transition-all resize-none placeholder:text-slate-700" />
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
                          <img src={sel.file_url} alt={sel.name} className="w-10 h-10 object-contain rounded-lg bg-white/5 p-1 shrink-0" />
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
              </motion.div>
            )}
          </AnimatePresence>

          {/* CTA */}
          <div className="bg-[#0b0e1a] border border-white/6 rounded-2xl p-5">
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
                <p className="text-[10px] text-amber-300">Only {creditBalance} credits left. <Link to="/dashboard/billing" className="text-blue-400 hover:text-blue-300">Upgrade →</Link></p>
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
            <motion.button
              onClick={handleGenerate}
              disabled={isGenerating || creditBalance < totalNeeded || !isEditor || (mode === 'auto' && !defaultLogoId)}
              whileHover={!isGenerating && isEditor ? { scale: 1.01 } : {}}
              whileTap={!isGenerating && isEditor ? { scale: 0.99 } : {}}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/50 disabled:cursor-not-allowed text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</>
              ) : (
                <><Zap className="w-4 h-4 fill-current" />
                  {ratios.length > 1 ? `Generate ${ratios.length} Formats` : 'Start Generation'}
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
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
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
                        <img src={logo.file_url} alt={logo.name} className="w-full h-full object-contain p-2" />
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
