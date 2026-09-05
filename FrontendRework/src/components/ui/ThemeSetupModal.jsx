import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Monitor, Layout, Sun, Moon, Sparkles, ArrowRight, ChevronLeft } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const UI_DESIGNS = [
  {
    id: 'rework',
    label: 'Rework',
    subtitle: 'Modern · Bottom dock · Glassmorphism',
    description: 'Floating bottom navigation with animated glass surfaces and a dynamic WebGL background.',
    preview: (
      <div className="w-full h-24 rounded-xl overflow-hidden relative bg-[#05070d] border border-white/10">
        {/* Simulated WebGL bg */}
        <div className="absolute inset-0 bg-linear-to-br from-blue-900/30 via-transparent to-purple-900/20" />
        {/* Simulated glass card */}
        <div className="absolute top-3 left-3 right-3 h-9 rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm flex items-center px-3 gap-2">
          <div className="w-3 h-3 rounded-sm bg-blue-500/60" />
          <div className="h-1.5 w-16 rounded-full bg-white/20" />
          <div className="ml-auto flex gap-1.5">
            <div className="w-4 h-4 rounded-md bg-white/10" />
            <div className="w-4 h-4 rounded-md bg-white/10" />
          </div>
        </div>
        {/* Bottom dock */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-black/60 backdrop-blur-sm">
          {[...Array(5)].map((_, i) => (
            <div key={i} className={`w-4 h-4 rounded-md ${i === 0 ? 'bg-blue-500/60' : 'bg-white/10'}`} />
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'classic',
    label: 'Classic',
    subtitle: 'Traditional · Sidebar · Structured',
    description: 'Left-side navigation panel with a clean, structured layout. Familiar and efficient.',
    preview: (
      <div className="w-full h-24 rounded-xl overflow-hidden relative bg-[#0b0e1a] border border-white/10 flex">
        {/* Simulated sidebar */}
        <div className="w-14 h-full border-r border-white/5 bg-black/40 flex flex-col items-center pt-3 gap-2 shrink-0">
          {[...Array(5)].map((_, i) => (
            <div key={i} className={`w-6 h-6 rounded-lg ${i === 0 ? 'bg-blue-500/60' : 'bg-white/8'}`} />
          ))}
        </div>
        {/* Content area */}
        <div className="flex-1 p-3 space-y-2">
          <div className="h-2 w-20 rounded-full bg-white/20" />
          <div className="grid grid-cols-2 gap-1.5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-6 rounded-lg bg-white/5 border border-white/5" />
            ))}
          </div>
        </div>
      </div>
    ),
  },
];

const COLOR_MODES = [
  {
    id: 'dark',
    label: 'Dark',
    subtitle: 'Default — deep navy blacks',
    icon: Moon,
    palette: ['#05070d', '#10141d', '#1e2433', '#3b82f6'],
    preview: 'bg-linear-to-br from-[#05070d] to-[#10141d]',
    textClass: 'text-white',
    borderClass: 'border-white/10',
  },
  {
    id: 'light',
    label: 'Light',
    subtitle: 'Clean — soft slate whites',
    icon: Sun,
    palette: ['#f0f4f8', '#e2e8f0', '#94a3b8', '#2563eb'],
    preview: 'bg-linear-to-br from-[#f0f4f8] to-[#e2e8f0]',
    textClass: 'text-slate-800',
    borderClass: 'border-slate-200',
  },
  {
    id: 'custom',
    label: 'Sunset',
    subtitle: 'Warm — cream pastel + orange',
    icon: Sparkles,
    palette: ['#fdf8f1', '#f3ebe0', '#e8d5b8', '#f97316'],
    preview: 'bg-linear-to-br from-[#fdf8f1] to-[#f3ebe0]',
    textClass: 'text-orange-900',
    borderClass: 'border-orange-400/30',
  },
];

export default function ThemeSetupModal() {
  const { isSetupComplete, setUiDesign, setColorMode } = useTheme();
  const [step, setStep] = useState(1); // 1 = design, 2 = color
  const [selectedDesign, setSelectedDesign] = useState('rework');
  const [selectedColor, setSelectedColor] = useState('dark');
  const [visible, setVisible] = useState(!isSetupComplete);

  const handleFinish = () => {
    setUiDesign(selectedDesign);
    setColorMode(selectedColor);
    setVisible(false);
  };

  if (isSetupComplete || !visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-9999 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="w-full max-w-xl rounded-3xl overflow-hidden"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            boxShadow: 'inset 0 1px 0 var(--glass-rim), 0 32px 80px var(--shadow-far)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-8 pt-8 pb-0">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h2 className="text-base font-black text-white tracking-tight">Welcome to Troxa</h2>
                <p className="text-[11px] text-gray-500">Customize your experience in 2 quick steps</p>
              </div>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 mt-5">
              {[1, 2].map(s => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                    s < step ? 'bg-blue-500 text-white' :
                    s === step ? 'bg-blue-500/20 border border-blue-500/50 text-blue-400' :
                    'bg-white/5 border border-white/10 text-gray-600'
                  }`}>
                    {s < step ? <Check className="w-2.5 h-2.5" /> : s}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${s === step ? 'text-white' : 'text-gray-600'}`}>
                    {s === 1 ? 'UI Design' : 'Color Mode'}
                  </span>
                  {s < 2 && <div className="w-8 h-px bg-white/10 mx-1" />}
                </div>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="px-8 py-6">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div>
                    <p className="text-sm font-bold text-white mb-0.5">Choose your UI layout</p>
                    <p className="text-xs text-gray-500">You can change this anytime from Settings → Appearance.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {UI_DESIGNS.map(d => (
                      <button
                        key={d.id}
                        onClick={() => setSelectedDesign(d.id)}
                        className={`p-4 rounded-2xl border text-left transition-all group ${
                          selectedDesign === d.id
                            ? 'border-blue-500 bg-blue-500/8 shadow-accent-glow'
                            : 'border-white/8 hover:border-white/15 bg-white/2'
                        }`}
                      >
                        {d.preview}
                        <div className="mt-3 flex items-start justify-between">
                          <div>
                            <p className="text-xs font-black text-white">{d.label}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{d.subtitle}</p>
                          </div>
                          {selectedDesign === d.id && (
                            <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div>
                    <p className="text-sm font-bold text-white mb-0.5">Choose your color palette</p>
                    <p className="text-xs text-gray-500">You can change this anytime from Settings → Appearance.</p>
                  </div>
                  <div className="space-y-2.5">
                    {COLOR_MODES.map(c => {
                      const Icon = c.icon;
                      return (
                        <button
                          key={c.id}
                          onClick={() => setSelectedColor(c.id)}
                          className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center gap-4 ${
                            selectedColor === c.id
                              ? 'border-blue-500 bg-blue-500/8 shadow-accent-glow'
                              : 'border-white/8 hover:border-white/15 bg-white/2'
                          }`}
                        >
                          {/* Color palette preview */}
                          <div className={`w-14 h-10 rounded-xl overflow-hidden shrink-0 border ${c.borderClass} ${c.preview}`}>
                            <div className="flex h-full">
                              {c.palette.map((color, i) => (
                                <div key={i} className="flex-1 h-full" style={{ background: color }} />
                              ))}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <p className="text-xs font-black text-white">{c.label}</p>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-0.5">{c.subtitle}</p>
                          </div>
                          {selectedColor === c.id && (
                            <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-8 pb-8 flex items-center justify-between">
            <button
              onClick={() => step > 1 ? setStep(s => s - 1) : undefined}
              className={`flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-white transition-colors ${step === 1 ? 'invisible' : ''}`}
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>

            {step < 2 ? (
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-black rounded-xl shadow-lg shadow-blue-600/25 transition-all"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-black rounded-xl shadow-lg shadow-blue-600/25 transition-all"
              >
                <Check className="w-4 h-4" /> Get Started
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
