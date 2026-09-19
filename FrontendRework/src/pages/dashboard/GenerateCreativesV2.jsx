import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Plus, Zap, X, Sparkles, Wand2, AlertTriangle, ArrowRight, Loader2, Lock, Brain, ChevronDown, Info } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useGeneration } from '../../contexts/GenerationContext';
import { brandKitApi, creativesApi, fingerprintApi } from '../../lib/api';
import { useGenerationSettings } from '../../lib/useGenerationSettings';
import { GLASS_STYLE } from '../../components/ui/GlassCard';
import UploadCreativeButton from '../../components/dashboard/UploadCreativeButton';
import GenerationSettingsPanel from '../../components/dashboard/GenerationSettingsPanel';
import { MODELS } from '../../lib/generationOptions';

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

  const activeJob   = jobs.find(j => j.status !== 'done' && j.status !== 'error') || jobs[0];
  const stepIndex   = STEPS.findIndex(s => s.key === activeJob?.current_step);
  const currentStep = STEPS[stepIndex] || STEPS[0];

  const isError  = anyError && allSettled && !allDone;
  const isSingle = jobs.length === 1;

  return (
    <div className="flex flex-col items-center justify-center min-h-125 gap-10 py-16">
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

      {!allSettled && (
        <motion.button initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} onClick={onContinue}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 bg-[#10141d] border border-white/10 hover:border-blue-500/40 text-white text-sm font-black rounded-2xl shadow-2xl transition-all hover:bg-[#13182a]">
          <Sparkles className="w-4 h-4 text-blue-400" />
          Continue Generating
          <ArrowRight className="w-4 h-4 text-slate-400" />
        </motion.button>
      )}
    </div>
  );
}

export default function GenerateCreatives() {
  const navigate = useNavigate();
  const { credits, refreshCredits, activeWorkspace, isEditor } = useAuth();
  const { activeJobs, setActiveJobs, clearJobs, allSettled } = useGeneration();
  const s = useGenerationSettings();

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [architectLoading, setArchitectLoading] = useState(false);

  const handleCreativeUploaded = (created) => {
    s.handleCreativeUploaded(created);
  };

  useEffect(() => {
    if (allSettled && activeJobs.some(j => j.status === 'done')) refreshCredits();
  }, [allSettled]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerateError(null);
    clearJobs();
    setShowForm(false);

    let prebuiltMasterPrompt = null;
    if (s.mode === 'auto' && s.activeTrendIdeaId && s.trendBrief?.ideas) {
      const idea = s.trendBrief.ideas.find(i => i.id === s.activeTrendIdeaId);
      if (idea) {
        setArchitectLoading(true);
        try {
          const primaryRatio = s.ratios[0]?.split(' ')[0] || '1:1';
          const data = await fingerprintApi.buildPrompt(
            { theme: idea.theme, concept: idea.concept, visual_direction: idea.visual_direction, extra_notes: idea.extra_prompt || '' },
            primaryRatio,
            s.useFingerprint,
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
      ...s.buildBasePayload(),
      prebuilt_master_prompt: prebuiltMasterPrompt || null,
    };

    s.setNegativePrompt('');

    try {
      const jobs = await Promise.all(
        s.ratios.map(r => creativesApi.generate({ ...basePayload, aspect_ratio: r.split(' — ')[0] }))
      );
      setActiveJobs(jobs);
      setIsGenerating(false);

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

  const costPerImg = (MODELS.find(m => m.name === s.selectedModel)?.credits ?? 1);
  const totalNeeded = Math.max(s.selectedStatics.length, 1) * s.numImages * s.ratios.length * costPerImg;
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

  const footer = (
    <>
      <div style={GLASS_STYLE} className="rounded-2xl p-5">
        {s.mode === 'custom' && (
          <>
            <div className="flex items-center justify-between mb-4 p-3 bg-blue-500/4 border border-blue-500/12 rounded-xl">
              <div className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Credits needed</span>
              </div>
              <span className="text-sm font-black text-white">{totalNeeded}</span>
            </div>
            {s.selectedStatics.length === 0 && (
              <div className="mb-3 flex items-center gap-2 text-[10px] text-slate-600">
                <Wand2 className="w-3 h-3 text-blue-500/60 shrink-0" />
                <span>No reference selected — AI will generate a betting ad autonomously</span>
              </div>
            )}
            <div className="flex items-center justify-between text-[10px] text-slate-700 mb-4">
              <span>{Math.max(s.selectedStatics.length, 1)} ref{s.selectedStatics.length !== 1 ? 's' : ''}</span>
              <span>×</span>
              <span>{s.numImages} img{s.numImages !== 1 ? 's' : ''}</span>
              {s.ratios.length > 1 && <><span>×</span><span>{s.ratios.length} formats</span></>}
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
        {s.mode === 'auto' && !s.defaultLogoId && s.brandKitLogos.length === 0 && (
          <div className="mb-3 flex items-center gap-2 px-4 py-2.5 bg-amber-500/8 border border-amber-500/20 rounded-xl">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <p className="text-[10px] text-amber-300">Auto mode requires a logo. <Link to="/dashboard/brand-kit" className="text-blue-400 hover:text-blue-300">Add to Brand Kit →</Link></p>
          </div>
        )}

        <motion.button
          onClick={handleGenerate}
          disabled={isGenerating || architectLoading || creditBalance < totalNeeded || !isEditor || (s.mode === 'auto' && !s.defaultLogoId)}
          whileHover={!isGenerating && !architectLoading && isEditor ? { scale: 1.01 } : {}}
          whileTap={!isGenerating && !architectLoading && isEditor ? { scale: 0.99 } : {}}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/50 disabled:cursor-not-allowed text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2">
          {architectLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Building prompt...</>
          ) : isGenerating ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</>
          ) : (
            <>
              {s.mode === 'auto' && s.activeTrendIdeaId ? <Brain className="w-4 h-4" /> : <Zap className="w-4 h-4 fill-current" />}
              {s.ratios.length > 1 ? `Generate ${s.ratios.length} Formats` : 'Start Generation'}
              {s.mode === 'auto' && s.activeTrendIdeaId && <span className="text-[10px] font-normal opacity-70 ml-1">· Trend</span>}
            </>
          )}
        </motion.button>
      </div>
    </>
  );

  return (
    <div className="pb-10">
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

      <AnimatePresence>
        {s.uploadNotice && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-3.5 bg-emerald-500/8 border border-emerald-500/20 rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-xs font-bold text-emerald-300">{s.uploadNotice}</p>
              <Link to="/dashboard/gallery" className="text-xs text-blue-400 hover:text-blue-300">View in Gallery →</Link>
            </div>
            <button onClick={() => s.setUploadNotice(null)} className="text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {generateError && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className={`mb-6 p-4 rounded-2xl flex items-start gap-3 ${generateError.type === 'credits' ? 'bg-amber-500/8 border border-amber-500/20' : 'bg-red-500/8 border border-red-500/20'}`}>
            <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${generateError.type === 'credits' ? 'text-amber-400' : 'text-red-400'}`} />
            <div className="flex-1">
              <p className={`text-sm font-bold ${generateError.type === 'credits' ? 'text-amber-300' : 'text-red-300'}`}>{generateError.message}</p>
              {generateError.type === 'credits' && (
                <Link to="/dashboard/workspace?tab=billing" className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block">Upgrade your plan →</Link>
              )}
            </div>
            <button onClick={() => setGenerateError(null)} className="text-slate-600 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <GenerationSettingsPanel settings={s} footer={footer} />
    </div>
  );
}
