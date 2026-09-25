import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap, Play, Pause, Trash2, Plus, ArrowLeft, Check, X,
  Calendar, Clock, Image as ImageIcon, Settings, ChevronDown,
  MoreVertical, PenLine, RefreshCw, Activity, Camera, Layers,
  AlertCircle, AlertTriangle, Lock, Loader2,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { automationApi, brandKitApi, creativesApi } from '../../lib/api';
import { useGenerationSettings } from '../../lib/useGenerationSettings';
import LockedFeature from '../../components/dashboard/LockedFeature';
import { GLASS_STYLE } from '../../components/ui/GlassCard';
import { CreativeImg } from '../../components/ui/CreativeImg';
import GenerationSettingsPanel from '../../components/dashboard/GenerationSettingsPanel';
import ScheduleEditor, { TIMEZONES } from '../../components/dashboard/ScheduleEditor';

// ─── Shared constants ─────────────────────────────────────────────────────────

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const statusStyles = {
  active: { pill: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', dot: 'bg-emerald-500', label: 'Active' },
  paused: { pill: 'bg-amber-500/10  border-amber-500/20  text-amber-400',     dot: 'bg-amber-500',   label: 'Paused' },
};

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

const NAME_MAX = 60;
const NAME_IDEAS = ['Daily promo drop', 'Weekend push', 'Monday fresh statics', 'Matchday creatives'];

// ─── Pipeline Builder — full-page view, not a modal ───────────────────────────
// Its generation settings (mode, model, ratios, campaign, Trend Scout,
// Campaign Intel, reference photos, character, logo, fingerprint blend,
// simplicity, @mentions...) come entirely from useGenerationSettings() +
// <GenerationSettingsPanel>, the exact same hook and component the Generate
// tab renders. Only pipeline-specific bits (name, trigger, schedule) and the
// submit action are local to this view — so a field added to Generate can
// no longer silently miss Automation, or vice versa.

function PipelineBuilderView({ onClose, onCreated, editTarget = null }) {
  const { isEditor, credits } = useAuth();
  const isEditing = !!editTarget;

  const [formName, setFormName] = useState(() => editTarget?.name || '');
  const [formTrigger, setFormTrigger] = useState(() => editTarget?.trigger_type || 'scheduled');
  const [formScheduleTime, setFormScheduleTime] = useState(() => editTarget?.schedule_time ? String(editTarget.schedule_time).slice(0, 5) : '08:00');
  // An empty day list on a saved pipeline has always meant "daily".
  const [formScheduleDays, setFormScheduleDays] = useState(() => (
    editTarget ? (editTarget.schedule_days?.length ? editTarget.schedule_days : [0, 1, 2, 3, 4, 5, 6]) : [0]
  ));
  const [formScheduleTimezone, setFormScheduleTimezone] = useState(() => {
    if (editTarget?.schedule_timezone) return editTarget.schedule_timezone;
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONES.some(t => t.value === browser) ? browser : 'Europe/Istanbul';
  });
  const [creating, setCreating] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const s = useGenerationSettings(editTarget || {});
  const nameRef = useRef(null);
  useEffect(() => { if (!isEditing) nameRef.current?.focus(); }, [isEditing]);

  const handleSave = async () => {
    if (!formName.trim()) return;
    setCreating(true);
    setSaveError(null);
    try {
      const payload = {
        name: formName.trim(),
        trigger_type: formTrigger,
        ...s.buildBasePayload(),
        aspect_ratio: s.ratios[0]?.split(' — ')[0] || '1:1',
        aspect_ratios: s.ratios.map(r => r.split(' — ')[0]),
        schedule_time: formTrigger === 'scheduled' ? formScheduleTime : null,
        schedule_days: formTrigger === 'scheduled' ? [...formScheduleDays].sort((a, b) => a - b) : [],
        schedule_timezone: formScheduleTimezone,
      };
      const saved = isEditing
        ? await automationApi.update(editTarget.id, payload)
        : await automationApi.create(payload);
      onCreated(saved);
    } catch (err) {
      setSaveError(err?.data?.detail || err?.message || 'Save failed. Please try again.');
    }
    setCreating(false);
  };

  const canSave = !!formName.trim() && !creating && isEditor;
  const creditBalance = credits?.balance ?? 0;

  const footer = (
    <div style={GLASS_STYLE} className="rounded-2xl p-5 space-y-3">
      {saveError && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-red-500/8 border border-red-500/20 rounded-xl">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <p className="text-xs text-red-300">{saveError}</p>
        </div>
      )}
      {!isEditor && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/8 border border-red-500/20 rounded-xl">
          <Lock className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <p className="text-xs text-red-400 font-bold">Analysts cannot create pipelines.</p>
        </div>
      )}
      <div className="flex items-center gap-2 text-[10px] text-slate-700">
        <AlertCircle className="w-3 h-3 shrink-0" /> {isEditing ? 'Changes apply to future runs.' : 'Activates immediately after creation.'}
      </div>
      <motion.button onClick={handleSave} disabled={!canSave}
        whileHover={canSave ? { scale: 1.01 } : {}}
        whileTap={canSave ? { scale: 0.99 } : {}}
        className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/50 disabled:cursor-not-allowed text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2">
        {creating && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
        {isEditing ? 'Save Changes' : 'Create Pipeline'}
      </motion.button>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: 'var(--bg-page)' }}
    >
      {/* Header — back, the pipeline's name, and save. */}
      <div className="sticky top-0 z-10 border-b border-(--border-subtle) backdrop-blur-xl" style={{ background: 'color-mix(in srgb, var(--bg-page) 88%, transparent)' }}>
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-3.5 flex items-center gap-3 md:gap-5">
          <button onClick={onClose} aria-label="Back to Automation"
            className="w-10 h-10 rounded-xl border border-(--border-default) flex items-center justify-center text-(--text-muted) hover:text-(--text-primary) hover:border-(--border-strong) transition-colors shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Where you are + the name as it'll read in the list */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-(--text-muted) flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
              <Zap className="w-3 h-3 text-(--accent) shrink-0" /> <span className="truncate">Automation · {isEditing ? 'Edit pipeline' : 'New pipeline'}</span>
            </p>
            <p className={`text-sm font-black truncate ${formName.trim() ? 'text-(--text-primary)' : 'text-(--text-faint)'}`}>
              {formName.trim() || 'Untitled pipeline'}
            </p>
          </div>

          <button onClick={onClose}
            className="hidden sm:block px-4 py-2.5 rounded-xl text-xs font-bold text-(--text-muted) hover:text-(--text-primary) transition-colors shrink-0">
            Cancel
          </button>
          <motion.button onClick={handleSave} disabled={!canSave}
            whileTap={canSave ? { scale: 0.97 } : {}}
            title={!formName.trim() ? 'Give the pipeline a name first' : undefined}
            className="px-5 py-2.5 bg-(--accent) hover:bg-(--accent-hover) disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-accent-glow flex items-center gap-2 shrink-0">
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {isEditing ? 'Save' : 'Create'}
          </motion.button>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 pb-16 space-y-8">
        {/* Name */}
        <div style={GLASS_STYLE} className="relative rounded-2xl overflow-hidden p-5 md:p-6 flex items-start gap-4 md:gap-5">
          <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-(--accent) opacity-[0.08] blur-3xl pointer-events-none" />
          <div className="relative hidden sm:flex w-12 h-12 md:w-14 md:h-14 rounded-2xl items-center justify-center shrink-0 shadow-lg shadow-accent-glow"
            style={{ background: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #8b5cf6))' }}>
            <Zap className="w-6 h-6 text-white fill-white/20" />
          </div>
          <div className="relative flex-1 min-w-0">
            <label htmlFor="pipeline-name" className="text-[10px] font-black uppercase tracking-widest text-(--text-muted)">
              Pipeline name
            </label>
            <div className="mt-1 flex items-center gap-3 border-b-2 border-(--border-default) focus-within:border-(--accent) transition-colors">
              <input id="pipeline-name" ref={nameRef} type="text" value={formName} maxLength={NAME_MAX}
                onChange={e => setFormName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && canSave) handleSave(); }}
                placeholder="e.g. Weekend promo drop"
                className="flex-1 min-w-0 bg-transparent! border-none py-2 text-2xl md:text-3xl font-black tracking-tight text-(--text-primary) outline-none placeholder:text-(--text-faint)" />
              <span className={`text-[10px] font-bold tabular-nums shrink-0 transition-opacity ${formName.length > NAME_MAX - 15 ? 'opacity-100 text-(--text-muted)' : 'opacity-0'}`}>
                {formName.length}/{NAME_MAX}
              </span>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              {formName.trim() ? (
                <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="mt-3 text-xs text-(--text-muted)">
                  This is how it shows in your Automation list. Press Enter to {isEditing ? 'save' : 'create'}.
                </motion.p>
              ) : (
                <motion.div key="ideas" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-(--text-muted) mr-1">Try</span>
                  {NAME_IDEAS.map((idea) => (
                    <button key={idea} type="button" onClick={() => { setFormName(idea); nameRef.current?.focus(); }}
                      className="px-2.5 py-1 rounded-full text-[11px] font-bold border border-(--border-default) text-(--text-secondary) hover:text-(--accent) hover:border-(--accent) hover:bg-(--accent-muted) transition-colors">
                      {idea}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <ScheduleEditor
          trigger={formTrigger} onTriggerChange={setFormTrigger}
          days={formScheduleDays} onDaysChange={setFormScheduleDays}
          time={formScheduleTime} onTimeChange={setFormScheduleTime}
          timezone={formScheduleTimezone} onTimezoneChange={setFormScheduleTimezone}
        />

        {/* Generation settings — the same component as the Generate tab */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-(--accent)" />
            <h2 className="text-sm font-black text-(--text-primary)">What should it make?</h2>
            <span className="text-[11px] text-(--text-muted)">· same settings as the Generate tab</span>
          </div>
          <GenerationSettingsPanel settings={s} footer={footer} />
        </section>
      </div>
    </motion.div>
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
  const [brandKitStatics, setBrandKitStatics] = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [pipelineRuns,    setPipelineRuns]    = useState([]);
  const [loadingRuns,     setLoadingRuns]     = useState(false);
  const [generationAnimationId, setGenerationAnimationId] = useState(null);
  const [successToast,    setSuccessToast]    = useState(null);
  const [menuOpenId,      setMenuOpenId]      = useState(null);
  const [isBuilderOpen,   setIsBuilderOpen]   = useState(false);
  const [editTarget,      setEditTarget]      = useState(null);

  useEffect(() => {
    if (!activeWorkspace) return;
    (async () => {
      const [autosRes, staticsRes] = await Promise.allSettled([
        automationApi.list(),
        creativesApi.gallery({ media_type: 'Photo', page_size: 100 }),
      ]);
      if (autosRes.status === 'fulfilled')   setAutomations((autosRes.value?.results || autosRes.value || []).map(normalizeAuto));
      if (staticsRes.status === 'fulfilled') setBrandKitStatics(staticsRes.value?.results || staticsRes.value || []);
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

  const openBuilder = (target = null) => { setEditTarget(target); setIsBuilderOpen(true); };
  const closeBuilder = () => { setIsBuilderOpen(false); setEditTarget(null); };

  const selectedPipeline = automations.find(a => a.id === selectedPipelineId);
  const allCreatives     = pipelineRuns.flatMap(r => r.creatives || []);

  if (isBuilderOpen) {
    return (
      <AnimatePresence>
        <PipelineBuilderView
          key={editTarget ? `edit-${editTarget.id}` : 'new-pipeline'}
          editTarget={editTarget}
          onClose={closeBuilder}
          onCreated={(saved) => {
            if (editTarget) {
              setAutomations(prev => prev.map(a => a.id === saved.id ? normalizeAuto(saved) : a));
              toast(`Pipeline "${saved.name}" updated!`);
            } else {
              setAutomations(prev => [...prev, normalizeAuto(saved)]);
              toast(`Pipeline "${saved.name}" created!`);
            }
            closeBuilder();
          }}
        />
      </AnimatePresence>
    );
  }

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
                <button onClick={() => openBuilder(selectedPipeline)}
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
                        <CreativeImg creativeId={s.id} alt={s.name} className="w-full h-full object-cover" />
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
                      <CreativeImg creativeId={c.id} alt={`Creative ${i + 1}`} className="w-full h-full object-cover" />
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
              <motion.button onClick={() => openBuilder()} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
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
                    <button onClick={() => openBuilder()} className="text-xs text-blue-400 font-black hover:text-blue-300 transition-colors">
                      Create your first pipeline →
                    </button>
                  </div>
                )}
                {automations.map((auto, i) => {
                  const st = statusStyles[auto.status] || statusStyles.paused;
                  return (
                    <motion.div key={auto.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                      className="group bg-[#0b0e1a] border border-white/6 hover:border-white/10 rounded-2xl p-5 transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <button onClick={() => setSelectedPipelineId(auto.id)} className="text-base font-black text-white hover:text-blue-400 transition-colors">{auto.name}</button>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider ${st.pill}`}>
                              <motion.span animate={{ opacity: auto.status === 'active' ? [1, 0.3, 1] : 1 }} transition={{ duration: 1.5, repeat: auto.status === 'active' ? Infinity : 0 }} className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                              {st.label}
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
                                    <button onClick={() => { openBuilder(auto); setMenuOpenId(null); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-[11px] font-bold text-slate-500 hover:text-blue-400 hover:bg-blue-500/5 transition-all">
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
    </div>
  );
}

export default function Automation() {
  const { isFreeTier, isIndividualTier } = useAuth();
  if (isFreeTier || isIndividualTier) return <LockedFeature feature="Automation" />;
  return <AutomationPage />;
}
