import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, Save, Download, RotateCcw, Type, Layout,
  ShieldCheck, Undo2, Redo2, Settings, Eye, History,
  Layers, Palette, Sliders, ZoomIn, ZoomOut, Maximize2, Check
} from 'lucide-react';
import { mockCreatives } from '../../lib/dashboardData';

const layers = [
  { name: 'Primary Logo', type: 'Vector', color: 'text-blue-400', bg: 'bg-blue-500/8 border-blue-500/15' },
  { name: 'Athlete Overlay', type: 'PNG', color: 'text-purple-400', bg: 'bg-purple-500/8 border-purple-500/15' },
  { name: 'Stadium Background', type: 'JPG', color: 'text-emerald-400', bg: 'bg-emerald-500/8 border-emerald-500/15' },
  { name: 'Pattern Overlay', type: 'SVG', color: 'text-amber-400', bg: 'bg-amber-500/8 border-amber-500/15' },
];

const layouts = ['Split', 'Overlap', 'Minimal', 'Dynamic'];
const brandColors = ['#2563EB', '#000000', '#FFFFFF', '#FF0000', '#1E40AF', '#7C3AED'];

export default function CreativeEditor() {
  const { id } = useParams();
  const creative = mockCreatives.find((c) => c.id === id) || mockCreatives[0];

  const [headline, setHeadline] = useState('GET A $500 BONUS BET TODAY');
  const [cta, setCta] = useState('BET NOW');
  const [selectedLayout, setSelectedLayout] = useState('Split');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeLeftPanel, setActiveLeftPanel] = useState('layers');

  const handleRegenerate = () => {
    setIsRegenerating(true);
    setTimeout(() => setIsRegenerating(false), 2000);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 bg-[#0b0e1a] border border-white/6 rounded-2xl gap-4">
        <div className="flex items-center gap-3">
          <Link to="/dashboard/creatives" className="p-2 hover:bg-white/6 border border-transparent hover:border-white/8 rounded-xl transition-all text-slate-500 hover:text-white">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div className="w-px h-5 bg-white/8" />
          <div>
            <p className="text-sm font-black text-white truncate max-w-48">{creative.name}</p>
            <p className="text-[10px] text-slate-600 font-mono">{creative.campaign}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* History */}
          <div className="flex items-center gap-1">
            <button className="p-1.5 text-slate-600 hover:text-white hover:bg-white/5 rounded-lg transition-all">
              <Undo2 className="w-4 h-4" />
            </button>
            <button className="p-1.5 text-slate-600 hover:text-white hover:bg-white/5 rounded-lg transition-all">
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
          <div className="w-px h-5 bg-white/8" />
          <button className="flex items-center gap-1.5 px-3 py-2 bg-white/4 border border-white/6 hover:bg-white/6 text-slate-400 hover:text-white rounded-xl font-bold text-xs transition-all">
            <Eye className="w-3.5 h-3.5" /> Preview
          </button>
          <motion.button
            onClick={handleSave}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/4 border border-white/6 hover:bg-white/6 text-slate-400 hover:text-white rounded-xl font-bold text-xs transition-all"
          >
            {saved ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Saved</> : <><Save className="w-3.5 h-3.5" /> Save</>}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs transition-all shadow-lg shadow-blue-600/20"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </motion.button>
        </div>
      </div>

      {/* Three-panel layout */}
      <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
        {/* Left Panel */}
        <div className="w-64 flex flex-col gap-3 overflow-y-auto">
          {/* Panel tabs */}
          <div className="flex gap-1 p-1 bg-[#0b0e1a] border border-white/6 rounded-xl">
            {[
              { id: 'layers', icon: Layers, label: 'Layers' },
              { id: 'palette', icon: Palette, label: 'Style' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveLeftPanel(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${activeLeftPanel === tab.id ? 'bg-white/8 text-white' : 'text-slate-600 hover:text-slate-400'}`}
              >
                <tab.icon className="w-3 h-3" />
                {tab.label}
              </button>
            ))}
          </div>

          {activeLeftPanel === 'layers' && (
            <div className="bg-[#0b0e1a] border border-white/6 rounded-2xl p-4 space-y-3">
              <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center justify-between">
                Assets <History className="w-3 h-3" />
              </h3>
              <div className="space-y-2">
                {layers.map((layer, i) => (
                  <div key={i} className={`p-3 border rounded-xl hover:border-white/10 transition-all cursor-pointer flex items-center gap-3 group ${layer.bg}`}>
                    <div className="w-7 h-7 rounded-lg bg-white/4 border border-white/6 flex items-center justify-center">
                      <Layout className={`w-3.5 h-3.5 ${layer.color}`} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{layer.name}</p>
                      <p className="text-[9px] text-slate-700 uppercase">{layer.type}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full py-2.5 border border-dashed border-white/8 hover:border-blue-500/30 rounded-xl text-[10px] font-black text-slate-700 hover:text-blue-400 transition-all uppercase tracking-wider">
                + Add Surface
              </button>
            </div>
          )}

          {activeLeftPanel === 'palette' && (
            <div className="bg-[#0b0e1a] border border-white/6 rounded-2xl p-4 space-y-4">
              <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Brand Colors</h3>
              <div className="flex flex-wrap gap-2">
                {brandColors.map((c, i) => (
                  <button key={i} className="w-8 h-8 rounded-xl border-2 border-white/10 hover:border-blue-500 transition-all hover:scale-110" style={{ backgroundColor: c }} />
                ))}
                <button className="w-8 h-8 rounded-xl border-2 border-dashed border-white/10 hover:border-blue-500/30 flex items-center justify-center text-slate-700 hover:text-white transition-all text-xs font-black">+</button>
              </div>
            </div>
          )}
        </div>

        {/* Center – Canvas */}
        <div className="flex-1 bg-[#0b0e1a] border border-white/6 rounded-2xl relative flex items-center justify-center overflow-hidden">
          {/* Canvas controls */}
          <div className="absolute top-4 left-4 flex gap-1.5">
            <button className="p-1.5 bg-black/50 backdrop-blur-md border border-white/8 rounded-lg text-slate-500 hover:text-white transition-all">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button className="p-1.5 bg-black/50 backdrop-blur-md border border-white/8 rounded-lg text-slate-500 hover:text-white transition-all">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button className="p-1.5 bg-black/50 backdrop-blur-md border border-white/8 rounded-lg text-slate-500 hover:text-white transition-all">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Canvas */}
          <div className="aspect-4/5 w-80 bg-black shadow-2xl relative overflow-hidden group rounded-xl border border-white/8">
            <img src={creative.thumbnail} className="w-full h-full object-cover opacity-90" alt="canvas" />
            {/* Safe zone guides */}
            <div className="absolute inset-0 border border-blue-500/10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute top-1/2 w-full h-px bg-blue-500/8" />
              <div className="absolute left-1/2 h-full w-px bg-blue-500/8" />
              <div className="absolute inset-4 border border-blue-500/10 border-dashed" />
            </div>
            {/* Headline preview */}
            <div className="absolute top-8 inset-x-6 text-center">
              <p className="text-xs font-black text-white drop-shadow-lg leading-tight">{headline}</p>
            </div>
            {/* CTA preview */}
            <div className="absolute bottom-16 inset-x-8 flex justify-center">
              <div className="px-4 py-2 bg-blue-600 rounded-lg">
                <p className="text-[10px] font-black text-white">{cta}</p>
              </div>
            </div>
            {/* Disclaimer */}
            <div className="absolute bottom-3 inset-x-4 text-center">
              <p className="text-[7px] text-white/40 font-mono uppercase tracking-tighter">21+ Only. Terms Apply. Gamble Responsibly.</p>
            </div>
          </div>

          {/* Canvas info bar */}
          <div className="absolute bottom-4 flex items-center gap-2">
            <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md border border-white/8 rounded-full text-[9px] font-black text-slate-400 uppercase tracking-widest">
              1080 × 1350 px
            </div>
            <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[9px] font-black text-emerald-400 uppercase tracking-widest">
              Safe Zone Active
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-72 flex flex-col gap-3 overflow-y-auto">
          {/* Core Logic */}
          <div className="bg-[#0b0e1a] border border-white/6 rounded-2xl p-5 space-y-5">
            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
              <Settings className="w-3 h-3" /> Core Logic
            </h3>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Headline</label>
              <div className="relative">
                <Type className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-600" />
                <textarea
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="w-full bg-[#0c0f1a] border border-white/8 focus:border-blue-500 rounded-xl py-2.5 pl-9 pr-3 text-sm text-white outline-none transition-all resize-none"
                  rows={2}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Call to Action</label>
              <input
                type="text"
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                className="w-full bg-[#0c0f1a] border border-white/8 focus:border-blue-500 rounded-xl py-2.5 px-3 text-sm text-white outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Visual Layout</label>
              <div className="grid grid-cols-2 gap-1.5">
                {layouts.map((l) => (
                  <button
                    key={l}
                    onClick={() => setSelectedLayout(l)}
                    className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${selectedLayout === l ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20' : 'border-white/6 bg-white/3 text-slate-600 hover:border-white/10 hover:text-white'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <motion.button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              whileHover={!isRegenerating ? { scale: 1.01 } : {}}
              whileTap={!isRegenerating ? { scale: 0.99 } : {}}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/50 text-white rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
            >
              {isRegenerating ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" /> Regenerate
                </>
              )}
            </motion.button>
          </div>

          {/* Compliance Panel */}
          <div className="bg-red-500/4 border border-red-500/12 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-red-400" />
              <h3 className="text-[10px] font-black text-red-400 uppercase tracking-widest">Compliance Review</h3>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">Disclaimers must occupy at least 15% of total vertical height for New Jersey campaigns.</p>
            <button className="text-[10px] font-black text-red-400 hover:text-red-300 transition-colors">Apply Compliance Template →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
