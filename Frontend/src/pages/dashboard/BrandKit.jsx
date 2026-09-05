import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Palette, Upload, Plus, Trash2, Zap, MessageSquareQuote,
  Edit2, Check, X, FolderKanban, Image, ShieldCheck, Loader2, Star
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { brandKitApi } from '../../lib/api';
import LockedFeature from '../../components/dashboard/LockedFeature';

function SectionHeader({ icon: Icon, iconColor, title, desc, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-xl ${iconColor} flex items-center justify-center shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h3 className="font-black text-white">{title}</h3>
          {desc && <p className="text-[11px] text-slate-600 mt-0.5">{desc}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function BrandKitPage() {
  const { activeWorkspace, isEditor, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('assets');

  const [logos, setLogos] = useState([]);
  const [statics, setStatics] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [disclaimers, setDisclaimers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logoDimensions, setLogoDimensions] = useState({});

  const [newDisclaimer, setNewDisclaimer] = useState('');
  const [newCampaign, setNewCampaign] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const logoInputRef = useRef(null);
  const staticInputRef = useRef(null);

  useEffect(() => {
    if (!activeWorkspace) return;
    (async () => {
      const [logosRes, staticsRes, campsRes, disclaimersRes] = await Promise.allSettled([
        brandKitApi.logos(),
        brandKitApi.statics(),
        brandKitApi.campaigns(),
        brandKitApi.disclaimers(),
      ]);
      if (logosRes.status === 'fulfilled') setLogos(logosRes.value?.results || logosRes.value || []);
      if (staticsRes.status === 'fulfilled') setStatics(staticsRes.value?.results || staticsRes.value || []);
      if (campsRes.status === 'fulfilled') setCampaigns(campsRes.value?.results || campsRes.value || []);
      if (disclaimersRes.status === 'fulfilled') setDisclaimers(disclaimersRes.value?.results || disclaimersRes.value || []);
      setLoading(false);
    })();
  }, [activeWorkspace]);

  // Poll while any static is being captioned
  useEffect(() => {
    const hasPending = statics.some((s) => s.caption_status === 'pending' || s.caption_status === 'processing');
    if (!hasPending) return;
    const timer = setTimeout(async () => {
      try {
        const res = await brandKitApi.statics();
        const list = res?.results || res || [];
        setStatics(list);
      } catch (_) {}
    }, 3000);
    return () => clearTimeout(timer);
  }, [statics]);

  const addCampaign = async () => {
    if (!newCampaign.trim()) return;
    try {
      const created = await brandKitApi.createCampaign(newCampaign.trim());
      setCampaigns((prev) => [...prev, created]);
      setNewCampaign('');
    } catch (_) {}
  };

  const removeCampaign = async (id) => {
    try {
      await brandKitApi.deleteCampaign(id);
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
    } catch (_) {}
  };

  const startEditing = (c) => { setEditingId(c.id); setEditingValue(c.name); };
  const cancelEditing = () => { setEditingId(null); setEditingValue(''); };

  const saveEditing = async (id) => {
    if (!editingValue.trim()) return cancelEditing();
    try {
      const updated = await brandKitApi.updateCampaign(id, editingValue.trim());
      setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, name: updated.name || editingValue.trim() } : c));
    } catch (_) {}
    cancelEditing();
  };

  const addDisclaimer = async () => {
    if (!newDisclaimer.trim()) return;
    try {
      const created = await brandKitApi.createDisclaimer(newDisclaimer.trim());
      setDisclaimers((prev) => [...prev, created]);
      setNewDisclaimer('');
    } catch (_) {}
  };

  const removeDisclaimer = async (id) => {
    try {
      await brandKitApi.deleteDisclaimer(id);
      setDisclaimers((prev) => prev.filter((d) => d.id !== id));
    } catch (_) {}
  };

  const setDefaultDisclaimer = async (id) => {
    try {
      await brandKitApi.setDefaultDisclaimer(id);
      setDisclaimers((prev) => prev.map((d) => ({ ...d, is_default: d.id === id })));
    } catch (_) {}
  };

  const setPrimaryLogo = async (id) => {
    try {
      await brandKitApi.setPrimaryLogo(id);
      setLogos((prev) => prev.map((l) => ({ ...l, is_primary: l.id === id })));
    } catch (_) {}
  };

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingStatic, setUploadingStatic] = useState(false);

  const handleLogoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingLogo(true);
    const fd = new FormData();
    files.forEach((f) => fd.append('file', f));
    try {
      const created = await brandKitApi.uploadLogo(fd);
      setLogos((prev) => [...prev, ...(Array.isArray(created) ? created : [created])]);
    } catch (_) {}
    e.target.value = '';
    setUploadingLogo(false);
  };

  const handleStaticUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingStatic(true);
    const fd = new FormData();
    files.forEach((f) => fd.append('file', f));
    try {
      const created = await brandKitApi.uploadStatic(fd);
      setStatics((prev) => [...prev, ...(Array.isArray(created) ? created : [created])]);
    } catch (_) {}
    e.target.value = '';
    setUploadingStatic(false);
  };

  const tabs = [
    { id: 'assets',     label: 'Assets'     },
    { id: 'campaigns',  label: 'Campaigns'  },
    { id: 'compliance', label: 'Compliance' },
  ];

  const headerActions = {
    assets:     isEditor ? <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20">{uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload Logo</motion.button> : null,
    campaigns:  isEditor ? <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => document.getElementById('new-campaign-input')?.focus()} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20"><Plus className="w-4 h-4" /> New Campaign</motion.button> : null,
    compliance: isEditor ? <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => document.getElementById('new-disclaimer-input')?.focus()} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20"><Plus className="w-4 h-4" /> Add Disclaimer</motion.button> : null,
  };

  return (
    <div className="space-y-8 pb-20">
      <input ref={logoInputRef} type="file" accept="image/*,.svg" multiple className="hidden" onChange={handleLogoUpload} />
      <input ref={staticInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleStaticUpload} />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Brand Kit</h1>
          <p className="text-slate-500 text-sm mt-1">Logos, campaigns, reference statics, and compliance guardrails</p>
        </div>
        {headerActions[activeTab]}
      </div>

      <div className="flex items-center gap-1 p-1 bg-blue-500/10 border border-white/6 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-5 py-2 rounded-lg text-sm font-black transition-all ${activeTab === tab.id ? 'text-white' : 'text-slate-400 hover:text-slate-300'}`}
          >
            {activeTab === tab.id && (
              <motion.div layoutId="brandkit-tab" className="absolute inset-0 bg-blue-500/10 border border-blue-500/20 rounded-lg" />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'assets' && (
          <motion.div key="assets" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
            {/* Logo Management */}
            <div className="bg-[#0b0e1a] border border-white/6 rounded-2xl p-6">
              <SectionHeader icon={Palette} iconColor="bg-blue-500/10 border border-blue-500/15 text-blue-400" title="Logo Management" desc="Brand identity assets used in creative generation" />
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {[1,2,3].map((i) => <div key={i} className="aspect-square bg-white/3 rounded-xl animate-pulse" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {logos.map((logo, i) => (
                    <motion.div
                      key={logo.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.07 }}
                      className={`group relative p-4 border rounded-xl transition-all ${logo.is_primary ? 'bg-amber-500/5 border-amber-500/25' : 'bg-white/3 border-white/6 hover:border-white/10'}`}
                    >
                      <div className="aspect-square rounded-xl overflow-hidden bg-white/4 flex items-center justify-center mb-3 border border-white/5 p-2">
                        {logo.file_url || logo.url ? (
                          <img
                            src={logo.file_url || logo.url}
                            alt={logo.name}
                            className="w-full h-full object-contain brightness-70 group-hover:brightness-100 grayscale-50 group-hover:grayscale-0 transition-all duration-300"
                            referrerPolicy="no-referrer"
                            onLoad={(e) => setLogoDimensions(prev => ({ ...prev, [logo.id]: { w: e.target.naturalWidth, h: e.target.naturalHeight } }))}
                          />
                        ) : (
                          <Image className="w-8 h-8 text-slate-700" />
                        )}
                      </div>
                      <p className="text-xs font-black text-white truncate">{logo.name}</p>
                      {logo.is_primary ? (
                        <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full mt-1">
                          <Star className="w-2 h-2 fill-amber-400" /> Default
                        </span>
                      ) : (
                        <p className="text-[9px] text-slate-700 uppercase tracking-wider mt-0.5">{logo.file_type || logo.type || 'Image'}</p>
                      )}
                      {logoDimensions[logo.id] && (
                        <p className="text-[9px] text-slate-600 mt-0.5 font-mono">
                          {logoDimensions[logo.id].w} × {logoDimensions[logo.id].h}
                        </p>
                      )}
                      {isEditor && (
                        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          {!logo.is_primary && (
                            <button onClick={() => setPrimaryLogo(logo.id)} title="Set as default" className="p-1 bg-[#0b0e1a] border border-white/8 text-slate-600 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all">
                              <Star className="w-3 h-3" />
                            </button>
                          )}
                          {isAdmin && (
                            <button onClick={() => { brandKitApi.deleteLogo(logo.id).then(() => setLogos((p) => p.filter((l) => l.id !== logo.id))).catch(() => {}); }} className="p-1 bg-[#0b0e1a] border border-white/8 text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ))}
                  {isEditor && <button onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo} className="aspect-square border-2 border-dashed border-white/6 hover:border-blue-500/30 hover:bg-blue-500/4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all group cursor-pointer disabled:opacity-60">
                    <div className="w-9 h-9 rounded-xl bg-white/4 group-hover:bg-blue-500/10 border border-white/6 group-hover:border-blue-500/20 flex items-center justify-center transition-all">
                      {uploadingLogo ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" /> : <Upload className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors" />}
                    </div>
                    <span className="text-[9px] font-black text-slate-700 group-hover:text-blue-400 uppercase tracking-widest transition-colors text-center">{uploadingLogo ? 'Uploading…' : 'Upload'}</span>
                  </button>}
                </div>
              )}
            </div>

            {/* Winning Statics */}
            <div className="bg-[#0b0e1a] border border-white/6 rounded-2xl p-6">
              <SectionHeader
                icon={Zap}
                iconColor="bg-amber-500/10 border border-amber-500/15 text-amber-400"
                title="Winning Statics Library"
                desc="Historical top-performers used to guide AI aesthetic"
              />
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {[1,2,3,4].map((i) => <div key={i} className="aspect-4/5 bg-white/3 rounded-xl animate-pulse" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {statics.map((item, i) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.07 }}
                      className="group relative rounded-xl overflow-hidden cursor-pointer"
                    >
                      <div className="aspect-4/5 rounded-xl overflow-hidden border border-white/6 group-hover:border-blue-500/25 transition-all">
                        {item.image_url || item.file_url || item.url ? (
                          <img src={item.image_url || item.file_url || item.url} alt={item.name} className="w-full h-full object-cover opacity-60 group-hover:opacity-90 group-hover:scale-105 transition-all duration-400" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full bg-white/4 flex items-center justify-center"><Image className="w-8 h-8 text-slate-700" /></div>
                        )}
                        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-2.5">
                          <p className="text-[9px] font-black text-white uppercase truncate">{item.name}</p>
                          {item.caption_status === 'processing' && (
                            <span className="text-[8px] text-amber-400 font-bold flex items-center gap-1 mt-0.5">
                              <Loader2 className="w-2.5 h-2.5 animate-spin" /> Captioning…
                            </span>
                          )}
                          {item.caption_status === 'done' && item.caption && (
                            <span className="text-[8px] text-emerald-400 font-bold mt-0.5 block truncate" title={item.caption}>✓ Captioned</span>
                          )}
                          {item.caption_status === 'error' && (
                            <span className="text-[8px] text-red-400 font-bold mt-0.5">✗ Caption failed</span>
                          )}
                        </div>
                        {isAdmin && (
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => { brandKitApi.deleteStatic(item.id).then(() => setStatics((p) => p.filter((s) => s.id !== item.id))).catch(() => {}); }} className="p-1 bg-[#0b0e1a]/80 border border-white/10 text-red-400 hover:bg-red-500/15 rounded-lg transition-all">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {isEditor && <button onClick={() => staticInputRef.current?.click()} disabled={uploadingStatic} className="aspect-4/5 border-2 border-dashed border-white/6 hover:border-blue-500/30 hover:bg-blue-500/4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all group cursor-pointer disabled:opacity-60">
                    <div className="w-9 h-9 rounded-xl bg-white/4 group-hover:bg-blue-500/10 border border-white/6 group-hover:border-blue-500/20 flex items-center justify-center transition-all">
                      {uploadingStatic ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" /> : <Plus className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors" />}
                    </div>
                    <span className="text-[9px] font-black text-slate-700 group-hover:text-blue-400 uppercase tracking-widest text-center px-2 transition-colors">{uploadingStatic ? 'Uploading…' : 'Add Reference'}</span>
                  </button>}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'campaigns' && (
          <motion.div key="campaigns" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
            <div className="bg-[#0b0e1a] border border-white/6 rounded-2xl p-6">
              <SectionHeader icon={FolderKanban} iconColor="bg-purple-500/10 border border-purple-500/15 text-purple-400" title="Active Campaigns" desc="Edit campaign name to auto-update all linked creatives" />
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                  {[1,2,3,4].map((i) => <div key={i} className="h-20 bg-white/3 rounded-xl animate-pulse" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                  <AnimatePresence>
                    {campaigns.map((camp) => (
                      <motion.div
                        key={camp.id}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        className="group p-4 bg-white/3 border border-white/6 hover:border-white/10 rounded-xl transition-all relative min-h-20"
                      >
                        {editingId === camp.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(camp.id); if (e.key === 'Escape') cancelEditing(); }}
                              className="w-full bg-[#0c0f1a] border border-white/8 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white outline-none transition-all"
                              autoFocus
                            />
                            <div className="flex gap-1.5">
                              <button onClick={() => saveEditing(camp.id)} className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15 rounded-lg transition-all">
                                <Check className="w-3 h-3" />
                              </button>
                              <button onClick={cancelEditing} className="p-1.5 bg-white/5 border border-white/6 text-slate-500 hover:text-white rounded-lg transition-all">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="text-[8px] font-black text-purple-400 uppercase tracking-widest block mb-1">Campaign</span>
                            <p className="text-xs font-black text-white wrap-break-word pr-10">{camp.name}</p>
                            {isEditor && (
                              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <button onClick={() => startEditing(camp)} className="p-1 bg-white/5 border border-white/6 text-slate-500 hover:text-white rounded-lg transition-all">
                                  <Edit2 className="w-2.5 h-2.5" />
                                </button>
                                {isAdmin && (
                                  <button onClick={() => removeCampaign(camp.id)} className="p-1 bg-white/5 border border-white/6 text-slate-600 hover:text-red-400 rounded-lg transition-all">
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
              <div className="flex gap-2 pt-4 border-t border-white/5">
                <input
                  id="new-campaign-input"
                  type="text"
                  value={newCampaign}
                  onChange={(e) => setNewCampaign(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addCampaign(); }}
                  placeholder="New campaign name..."
                  className="flex-1 bg-[#0c0f1a] border border-white/8 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-white outline-none transition-all placeholder:text-slate-700"
                />
                <button onClick={addCampaign} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs transition-all flex items-center gap-1.5 shrink-0">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'compliance' && (
          <motion.div key="compliance" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
            <div className="bg-[#0b0e1a] border border-white/6 rounded-2xl p-6">
              <SectionHeader icon={MessageSquareQuote} iconColor="bg-emerald-500/10 border border-emerald-500/15 text-emerald-400" title="Global Disclaimers" desc="Compliance text templates attached to creatives automatically" />
              {loading ? (
                <div className="space-y-3 mb-4">
                  {[1,2,3].map((i) => <div key={i} className="h-16 bg-white/3 rounded-xl animate-pulse" />)}
                </div>
              ) : (
                <div className="space-y-3 mb-4">
                  <AnimatePresence>
                    {disclaimers.map((d) => (
                      <motion.div
                        key={d.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        className={`group relative p-4 border rounded-xl transition-all ${d.is_default ? 'bg-amber-500/5 border-amber-500/25' : 'bg-white/3 border-white/6 hover:border-white/10'}`}
                      >
                        <div className="flex items-start gap-3 pr-16">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${d.is_default ? 'bg-amber-500/15 border border-amber-500/30' : 'bg-emerald-500/10 border border-emerald-500/15'}`}>
                            <ShieldCheck className={`w-3 h-3 ${d.is_default ? 'text-amber-400' : 'text-emerald-400'}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[8px] font-black uppercase tracking-widest ${d.is_default ? 'text-amber-400' : 'text-emerald-500'}`}>{d.category || 'General'}</span>
                              {d.is_default && (
                                <span className="text-[8px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                  <Star className="w-2 h-2 fill-amber-400" /> Default
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 group-hover:text-slate-300 leading-relaxed italic transition-colors">
                              "{d.text}"
                            </p>
                          </div>
                        </div>
                        {isEditor && (
                          <div className="absolute top-3 right-3 flex items-center gap-1">
                            {!d.is_default && (
                              <button
                                onClick={() => setDefaultDisclaimer(d.id)}
                                title="Set as default"
                                className="p-1 text-slate-700 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Star className="w-3 h-3" />
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => removeDisclaimer(d.id)}
                                className="p-1 text-slate-700 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {disclaimers.length === 0 && !loading && (
                    <div className="py-8 text-center bg-white/2 border border-white/5 rounded-xl">
                      <p className="text-[11px] text-slate-700">No disclaimers added yet</p>
                    </div>
                  )}
                </div>
              )}
              {isEditor && <div className="flex gap-2 pt-4 border-t border-white/5">
                <input
                  id="new-disclaimer-input"
                  type="text"
                  value={newDisclaimer}
                  onChange={(e) => setNewDisclaimer(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addDisclaimer(); }}
                  placeholder="New disclaimer template..."
                  className="flex-1 bg-[#0c0f1a] border border-white/8 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-white outline-none transition-all placeholder:text-slate-700"
                />
                <button onClick={addDisclaimer} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs transition-all flex items-center gap-1.5 shrink-0">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function BrandKit() {
  const { isFreeTier } = useAuth();
  if (isFreeTier) return <LockedFeature feature="Brand Kit" />;
  return <BrandKitPage />;
}
