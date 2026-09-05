import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap, Play, Pause, Trash2, Plus, ArrowLeft, Check, X,
  Calendar, Clock, Image as ImageIcon, Settings, Sparkles,
  ChevronDown, MoreVertical, AlertCircle, RefreshCw,
  Activity, Camera, Layers, Wand2, Sliders, CheckCircle2, PenLine,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { automationApi, brandKitApi } from '../../lib/api';
import LockedFeature from '../../components/dashboard/LockedFeature';

// ─── Shared constants (mirrors GenerateCreatives) ────────────────────────────

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TIMEZONES = [
  { label: 'Istanbul (TRT)',       value: 'Europe/Istanbul' },
  { label: 'New York (ET)',        value: 'America/New_York' },
  { label: 'Chicago (CT)',         value: 'America/Chicago' },
  { label: 'Denver (MT)',          value: 'America/Denver' },
  { label: 'Los Angeles (PT)',     value: 'America/Los_Angeles' },
  { label: 'Anchorage (AKT)',      value: 'America/Anchorage' },
  { label: 'Honolulu (HST)',       value: 'Pacific/Honolulu' },
];

const models = [
  { name: 'Nano Banana 2', meta: 'Fast • $0.06/img', badge: 'Recommended', badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  { name: 'GPT Image 2',   meta: 'Balanced • $0.20/img', badge: 'High Quality', badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/20' },
  { name: 'Grok Imagine',  meta: 'Ultra-Fast • $0.02/img', badge: 'Budget', badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
];

const ratioOptions  = ['1:1 — Square', '4:5 — Portrait', '9:16 — Story', '16:9 — Landscape'];
const resOptions    = ['1K Standard (~$0.08/img)', '2K Pro (~$0.15/img)', '4K Master (~$0.30/img)'];
const formatOptions = ['PNG', 'JPG', 'WebP'];
const designRulePresets = [
  { key: 'realistic',  label: 'Realistic' },
  { key: 'cartoon',    label: 'Cartoon' },
  { key: 'character',  label: 'Character' },
  { key: 'text-only',  label: 'Text Only' },
  { key: 'map',        label: 'Map' },
  { key: 'custom',     label: 'Custom' },
];

const statusStyles = {
  active: { pill: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', dot: 'bg-emerald-500', label: 'Active' },
  paused: { pill: 'bg-amber-500/10  border-amber-500/20  text-amber-400',   dot: 'bg-amber-500',   label: 'Paused' },
};

// ─── Shared UI components (same style as GenerateCreatives) ──────────────────

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
                className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl py-3 pl-9 pr-3 text-sm text-white outline-none transition-all resize-none placeholder:text-slate-700" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-[#0b0e1a] border border-white/6 rounded-2xl p-5">
      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center mb-4 ${cls}`}>
        <Icon className={`w-4 h-4 ${cls.split(' ')[0]}`} />
      </div>
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="text-xs font-bold text-slate-500 mt-1">{label}</p>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function AutomationPage() {
  const { activeWorkspace } = useAuth();

  // list & detail state
  const [automations, setAutomations]         = useState([]);
  const [brandKitStatics, setBrandKitStatics] = useState([]);
  const [brandKitLogos, setBrandKitLogos]     = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [selectedPipelineId, setSelectedPipelineId] = useState(null);
  const [pipelineRuns, setPipelineRuns]       = useState([]);
  const [loadingRuns, setLoadingRuns]         = useState(false);
  const [generationAnimationId, setGenerationAnimationId] = useState(null);
  const [successToast, setSuccessToast]       = useState(null);
  const [menuOpenId, setMenuOpenId]           = useState(null);

  // modal open/close
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating]       = useState(false);

  // ── Form state (mirrors GenerateCreatives right panel) ──
  const [formName,          setFormName]          = useState('');
  const [formTrigger,       setFormTrigger]       = useState('scheduled');
  const [formScheduleTime,     setFormScheduleTime]     = useState('08:00');
  const [formScheduleDays,     setFormScheduleDays]     = useState([0]); // 0 = Mon
  const [formScheduleTimezone, setFormScheduleTimezone] = useState(() => {
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONES.some(t => t.value === browser) ? browser : 'Europe/Istanbul';
  });
  const [selectedStaticIds, setSelectedStaticIds] = useState([]);
  const [selectedLogoId, setSelectedLogoId]       = useState(null);
  const [genMode,           setGenMode]           = useState('auto');
  const [selectedModel,     setSelectedModel]     = useState('Nano Banana 2');
  const [aspectRatio,       setAspectRatio]       = useState('1:1 — Square');
  const [resolution,        setResolution]        = useState('1K Standard (~$0.08/img)');
  const [outputFormat,      setOutputFormat]      = useState('PNG');
  const [numImages,         setNumImages]         = useState(1);
  const [designRule,        setDesignRule]        = useState(null);
  const [customDesignText,  setCustomDesignText]  = useState('');
  const [extraPrompt,       setExtraPrompt]       = useState('');

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeWorkspace) return;
    (async () => {
      const [autosRes, staticsRes, logosRes] = await Promise.allSettled([
        automationApi.list(),
        brandKitApi.statics(),
        brandKitApi.logos(),
      ]);
      if (autosRes.status === 'fulfilled') {
        const list = autosRes.value?.results || autosRes.value || [];
        setAutomations(list.map(normalizeAuto));
      }
      if (staticsRes.status === 'fulfilled') {
        const list = staticsRes.value?.results || staticsRes.value || [];
        setBrandKitStatics(list);
      }
      if (logosRes.status === 'fulfilled') {
        const list = logosRes.value?.results || logosRes.value || [];
        setBrandKitLogos(list);
      }
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

  // ── Actions ────────────────────────────────────────────────────────────────
  const toast = (msg) => { setSuccessToast(msg); setTimeout(() => setSuccessToast(null), 4000); };

  const toggleStatus = async (id) => {
    try {
      const updated = await automationApi.toggle(id);
      setAutomations(prev => prev.map(a => a.id === id ? {
        ...a,
        is_active: updated?.is_active ?? !a.is_active,
        status: updated?.is_active ? 'active' : 'paused',
      } : a));
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

  const toggleDay = (day) => setFormScheduleDays(prev =>
    prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
  );

  const toggleStatic = (id) => setSelectedStaticIds(prev =>
    prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
  );

  const resetModal = () => {
    setIsModalOpen(false);
    setFormName(''); setFormTrigger('scheduled');
    setFormScheduleTime('08:00'); setFormScheduleDays([0]); setFormScheduleTimezone('Europe/Istanbul');
    setSelectedStaticIds([]); setSelectedLogoId(null); setGenMode('auto');
    setSelectedModel('Nano Banana 2'); setAspectRatio('1:1 — Square');
    setResolution('1K Standard (~$0.08/img)'); setOutputFormat('PNG');
    setNumImages(1); setDesignRule(null); setCustomDesignText(''); setExtraPrompt('');
  };

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setCreating(true);
    try {
      const styleValue = designRule === 'custom' ? customDesignText : (designRule || '');
      const payload = {
        name:          formName.trim(),
        trigger_type:  formTrigger,
        model_name:    selectedModel,
        aspect_ratio:  aspectRatio.split(' — ')[0],
        resolution:    resolution.split(' ')[0],
        num_images:    numImages,
        output_format: outputFormat.toLowerCase().replace('jpg', 'jpeg'),
        style:         styleValue,
        extra_prompt:  extraPrompt,
        static_ids:    selectedStaticIds,
        logo_id:       selectedLogoId || null,
      };
      if (formTrigger === 'scheduled') {
        payload.schedule_time     = formScheduleTime;
        payload.schedule_days     = [...formScheduleDays].sort((a, b) => a - b);
        payload.schedule_timezone = formScheduleTimezone;
      }
      const created = await automationApi.create(payload);
      setAutomations(prev => [...prev, normalizeAuto(created)]);
      resetModal();
      toast(`Pipeline "${formName.trim()}" created!`);
    } catch (err) { toast(err.message || 'Failed to create pipeline'); }
    setCreating(false);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedPipeline = automations.find(a => a.id === selectedPipelineId);
  const allCreatives     = pipelineRuns.flatMap(r => r.creatives || []);

  const InputCls = "w-full bg-[#0c0f1a] border border-white/8 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none transition-all placeholder:text-slate-700";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-20 relative">

      {/* Toast */}
      <AnimatePresence>
        {successToast && (
          <motion.div initial={{ opacity: 0, y: -40, x: 40 }} animate={{ opacity: 1, y: 0, x: 0 }} exit={{ opacity: 0, y: -40, x: 40 }}
            className="fixed top-24 right-6 bg-[#0b0e1a] border border-emerald-500/30 text-white p-4 rounded-2xl shadow-2xl z-50 flex items-center gap-3 max-w-sm">
            <div className="w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center shrink-0"><Check className="w-4 h-4 text-white" /></div>
            <span className="text-sm font-bold">{successToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Detail / List ─────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {selectedPipeline ? (

          /* ── DETAIL VIEW ──────────────────────────────────────────────── */
          <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-[#0b0e1a] border border-white/6 rounded-2xl">
              <button onClick={() => setSelectedPipelineId(null)} className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors font-bold text-sm">
                <ArrowLeft className="w-4 h-4" /> Back to Pipelines
              </button>
              <div className="flex items-center gap-3">
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
              <StatCard icon={Activity}  label="Total Runs"     value={selectedPipeline.totalRuns} color="blue" />
              <StatCard icon={ImageIcon} label="Images / Run"   value={selectedPipeline.num_images} color="purple" />
              <StatCard icon={Clock}     label="Last Run"        value={selectedPipeline.last_run_at ? String(selectedPipeline.last_run_at).slice(0, 10) : 'Never'} color="emerald" />
              <StatCard icon={Calendar}  label="Next Run"        value={selectedPipeline.next_run_at ? String(selectedPipeline.next_run_at).slice(0, 10) : '—'} color="amber" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 bg-[#0b0e1a] border border-white/6 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-black text-white flex items-center gap-2"><Settings className="w-4 h-4 text-slate-500" /> Configuration</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Trigger',      value: selectedPipeline.trigger_type === 'scheduled' ? 'Scheduled' : 'Manual' },
                    { label: 'Schedule',     value: scheduleDisplay(selectedPipeline) },
                    { label: 'Model',        value: selectedPipeline.model_name },
                    { label: 'Aspect Ratio', value: selectedPipeline.aspect_ratio },
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

              <div className="bg-[#0b0e1a] border border-white/6 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-black text-white flex items-center gap-2"><Camera className="w-4 h-4 text-slate-500" /> Reference Photos</h3>
                {(selectedPipeline.static_ids?.length ?? 0) > 0 ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    {brandKitStatics.filter(s => selectedPipeline.static_ids.includes(s.id)).map(s => (
                      <div key={s.id} className="aspect-square rounded-lg overflow-hidden bg-white/4 border border-white/6">
                        <img src={s.url} alt={s.name} className="w-full h-full object-cover" />
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

            <div className="bg-[#0b0e1a] border border-white/6 rounded-2xl p-5 space-y-4">
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
                      <img src={c.logo_applied_url || c.image_url} alt={`Creative ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

        ) : (

          /* ── LIST VIEW ────────────────────────────────────────────────── */
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
              <StatCard icon={Activity}  label="Total Runs"        value={automations.reduce((s, a) => s + (a.totalRuns || 0), 0)} color="purple" />
              <StatCard icon={ImageIcon} label="Images Generated"  value={automations.reduce((s, a) => s + (a.total_creatives || 0), 0)} color="emerald" />
              <StatCard icon={Pause}     label="Paused"            value={automations.filter(a => a.status !== 'active').length} color="amber" />
            </div>

            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-white/3 rounded-2xl animate-pulse" />)}</div>
            ) : (
              <div className="space-y-3">
                {automations.length === 0 && (
                  <div className="py-20 text-center bg-[#0b0e1a] border border-white/6 rounded-2xl space-y-4">
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
                                    className="absolute right-0 top-full mt-1 w-40 bg-[#0c0f1a] border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden">
                                    <button onClick={() => { setSelectedPipelineId(auto.id); setMenuOpenId(null); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-[11px] font-bold text-slate-500 hover:text-white hover:bg-white/4 transition-all">
                                      <Settings className="w-3 h-3" /> View Details
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

      {/* ── CREATE MODAL ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={resetModal} className="fixed inset-0 bg-black/80 backdrop-blur-md" />

            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="relative w-full max-w-5xl bg-[#0a0d14] border border-white/10 rounded-2xl shadow-2xl z-50 flex flex-col max-h-[92vh]">

              {/* Header */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="font-black text-white">New Automation Pipeline</h2>
                  <p className="text-[11px] text-slate-600 mt-0.5">Configure your AI creative pipeline</p>
                </div>
                <button onClick={resetModal} className="p-1.5 bg-white/5 hover:bg-white/8 rounded-xl text-slate-500 hover:text-white transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body — 3-column layout */}
              <div className="flex flex-col lg:flex-row overflow-hidden flex-1 min-h-0">

                {/* ── Col 1: Name & Schedule ─────────────────────────────── */}
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
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          className="space-y-3 overflow-hidden">
                          <div className="p-3 bg-white/2 border border-white/5 rounded-xl space-y-3">
                            <div>
                              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-1.5">Time</label>
                              <input type="time" value={formScheduleTime} onChange={e => setFormScheduleTime(e.target.value)} className={InputCls} />
                            </div>
                            <div>
                              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-1.5">Timezone</label>
                              <div className="relative">
                                <select value={formScheduleTimezone} onChange={e => setFormScheduleTimezone(e.target.value)} className={InputCls + ' appearance-none pr-8 cursor-pointer'}>
                                  {TIMEZONES.map(tz => (
                                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                                  ))}
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

                {/* ── Col 2: Reference Photos ────────────────────────────── */}
                <div className="lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-white/5 flex flex-col overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-slate-500" />
                      <h3 className="font-black text-white text-sm">Reference Photos</h3>
                    </div>
                    <div className="flex items-center gap-3">
                      {selectedStaticIds.length > 0 && (
                        <span className="text-[10px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-lg">
                          {selectedStaticIds.length} selected
                        </span>
                      )}
                      {selectedStaticIds.length > 0 && (
                        <button onClick={() => setSelectedStaticIds([])} className="text-[10px] uppercase font-semibold text-red-500/60 hover:text-red-500/80 transition-colors">
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4">
                    {brandKitStatics.length === 0 ? (
                      <div className="py-12 text-center space-y-3">
                        <Camera className="w-8 h-8 text-slate-700 mx-auto" />
                        <p className="text-[11px] text-slate-600">No photos in Brand Kit yet</p>
                        <Link to="/dashboard/brand-kit" onClick={resetModal} className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors">Go to Brand Kit →</Link>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {brandKitStatics.map(item => {
                          const selected = selectedStaticIds.includes(item.id);
                          return (
                            <motion.div key={item.id} onClick={() => toggleStatic(item.id)}
                              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                              className={`group relative rounded-xl overflow-hidden aspect-4/5 cursor-pointer border-2 transition-all ${selected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-transparent hover:border-white/15'}`}>
                              <img src={item.image_url || item.url}
                                className={`w-full h-full object-cover transition-all duration-400 ${selected ? 'opacity-90' : 'opacity-50 grayscale group-hover:opacity-80 group-hover:grayscale-0'}`}
                                alt={item.name} />
                              <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent" />
                              <div className="absolute inset-x-0 bottom-0 p-2">
                                <p className="text-[8px] font-black text-white uppercase truncate">{item.name}</p>
                              </div>
                              <AnimatePresence>
                                {selected && (
                                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                                    className="absolute top-2 right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-600/40">
                                    <CheckCircle2 className="w-3 h-3 text-white" />
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          );
                        })}
                        <Link to="/dashboard/brand-kit" onClick={resetModal}
                          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/8 hover:border-blue-500/30 hover:bg-blue-500/4 transition-all group aspect-4/5">
                          <div className="w-8 h-8 rounded-xl bg-white/4 group-hover:bg-blue-500/10 border border-white/6 group-hover:border-blue-500/20 flex items-center justify-center mb-1.5 transition-all">
                            <Plus className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-400 transition-colors" />
                          </div>
                          <span className="text-[8px] font-black text-slate-700 group-hover:text-blue-400 uppercase tracking-widest transition-colors text-center">Add Photo</span>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Logo section (bottom of Col 2) ───────────────────────── */}
                <div className="shrink-0 border-t border-white/5">
                  <div className="px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-slate-500" />
                      <h3 className="font-black text-white text-sm">Logo</h3>
                    </div>
                    {selectedLogoId && (
                      <button onClick={() => setSelectedLogoId(null)} className="text-[10px] uppercase font-semibold text-red-500/60 hover:text-red-500/80 transition-colors">Clear</button>
                    )}
                  </div>
                  <div className="px-4 pb-4">
                    {brandKitLogos.length === 0 ? (
                      <div className="py-4 text-center">
                        <p className="text-[11px] text-slate-600">No logos in Brand Kit</p>
                        <Link to="/dashboard/brand-kit" onClick={resetModal} className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors">Go to Brand Kit →</Link>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {brandKitLogos.map(logo => {
                          const selected = selectedLogoId === logo.id;
                          const url = logo.file_url || logo.file || logo.url;
                          return (
                            <motion.button key={logo.id} onClick={() => setSelectedLogoId(selected ? null : logo.id)}
                              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                              className={`relative w-14 h-14 rounded-xl border-2 overflow-hidden flex items-center justify-center transition-all bg-white/5 ${selected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-white/8 hover:border-white/20'}`}>
                              <img src={url} alt={logo.name} className="w-full h-full object-contain p-1" />
                              <AnimatePresence>
                                {selected && (
                                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                                    className="absolute top-0.5 right-0.5 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center shadow">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Col 3: Generation Settings (same as GenerateCreatives right panel) ── */}
                <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                  {/* Mode switcher */}
                  <div className="p-4 border-b border-white/5 shrink-0">
                    <div className="bg-white/4 border border-white/6 rounded-2xl p-1.5 flex gap-1.5">
                      {[{ key: 'auto', label: 'Auto', Icon: Wand2 }, { key: 'custom', label: 'Custom', Icon: Sliders }].map(({ key, label, Icon }) => (
                        <button key={key} onClick={() => setGenMode(key)}
                          className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${genMode === key ? 'text-white' : 'text-slate-600 hover:text-slate-400'}`}>
                          {genMode === key && (
                            <motion.div layoutId="auto-mode-pill" className="absolute inset-0 bg-blue-600 rounded-xl shadow-lg shadow-blue-600/25" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                          )}
                          <Icon className="relative w-3.5 h-3.5" />
                          <span className="relative">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <AnimatePresence mode="wait">
                      {genMode === 'auto' ? (
                        <motion.div key="auto" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="space-y-4">
                          <div className="flex items-start gap-2.5 px-3.5 py-3 bg-blue-500/5 border border-blue-500/12 rounded-xl">
                            <Wand2 className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                            <p className="text-[10px] text-slate-500 leading-relaxed">AI automatically selects model, format, and output settings.</p>
                          </div>
                          <SelectField label="Aspect Ratio" options={ratioOptions} value={aspectRatio} onChange={setAspectRatio} />
                          <SelectField label="Resolution" options={resOptions} value={resolution} onChange={setResolution} />
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Images per Reference</label>
                            <div className="flex gap-2">
                              {[1, 2, 3, 4].map(n => (
                                <button key={n} onClick={() => setNumImages(n)}
                                  className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${numImages === n ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white/4 border border-white/6 text-slate-500 hover:text-white hover:border-white/10'}`}>
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>
                          <DesignRuleField value={designRule} customText={customDesignText}
                            onPresetChange={setDesignRule} onCustomTextChange={setCustomDesignText}
                            onClear={() => { setDesignRule(null); setCustomDesignText(''); }} />
                        </motion.div>
                      ) : (
                        <motion.div key="custom" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="space-y-4">
                          {/* Model */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">AI Model</label>
                            <div className="space-y-2">
                              {models.map(model => (
                                <motion.button key={model.name} whileHover={{ scale: 1.005 }} whileTap={{ scale: 0.995 }}
                                  onClick={() => setSelectedModel(model.name)}
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
                          <SelectField label="Aspect Ratio" options={ratioOptions} value={aspectRatio} onChange={setAspectRatio} />
                          <SelectField label="Resolution" options={resOptions} value={resolution} onChange={setResolution} />
                          <SelectField label="Output Format" options={formatOptions} value={outputFormat} onChange={setOutputFormat} />
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Images per Reference</label>
                            <div className="flex gap-2">
                              {[1, 2, 3, 4].map(n => (
                                <button key={n} onClick={() => setNumImages(n)}
                                  className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${numImages === n ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white/4 border border-white/6 text-slate-500 hover:text-white hover:border-white/10'}`}>
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>
                          <DesignRuleField value={designRule} customText={customDesignText}
                            onPresetChange={setDesignRule} onCustomTextChange={setCustomDesignText}
                            onClear={() => { setDesignRule(null); setCustomDesignText(''); }} />
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                              Extra Instructions <span className="text-slate-700 normal-case font-normal">(optional)</span>
                            </label>
                            <textarea rows={3} value={extraPrompt} onChange={e => setExtraPrompt(e.target.value)}
                              placeholder="Additional instructions..."
                              className="w-full bg-[#0c0f1a] border border-white/8 hover:border-white/12 focus:border-blue-500 rounded-xl p-3 text-sm text-white outline-none transition-all resize-none placeholder:text-slate-700" />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-[10px] text-slate-700">
                  <AlertCircle className="w-3 h-3" /> Activates immediately after creation
                </div>
                <div className="flex gap-3">
                  <button onClick={resetModal} className="px-5 py-2.5 bg-white/4 border border-white/8 hover:bg-white/6 text-slate-400 hover:text-white rounded-xl font-bold text-sm transition-all">
                    Cancel
                  </button>
                  <motion.button onClick={handleCreate} disabled={!formName.trim() || creating}
                    whileHover={formName.trim() && !creating ? { scale: 1.02 } : {}}
                    whileTap={formName.trim() && !creating ? { scale: 0.98 } : {}}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/50 disabled:cursor-not-allowed text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2">
                    {creating && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    Create Pipeline
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
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
