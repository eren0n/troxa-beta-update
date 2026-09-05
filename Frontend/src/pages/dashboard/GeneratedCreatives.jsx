import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Download, Filter, Search, Grid, List,
  ChevronDown, X, Image as ImageIcon, Video, Play, ExternalLink, Loader2, Sparkles, Maximize2,
  ChevronLeft, ChevronRight, Star, StarHalf, MessageSquare
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { creativesApi, brandKitApi } from '../../lib/api';

const DEFAULT_VIDEO_PROMPT = 'Smooth cinematic motion, slow zoom in, high quality, photorealistic';

export default function GeneratedCreatives() {
  const navigate = useNavigate();
  const [view, setView] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [creatives, setCreatives] = useState([]);
  const [videoJobs, setVideoJobs] = useState([]);
  const [logoResults, setLogoResults] = useState([]);
  const [campaignsList, setCampaignsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState('All');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);

  // Make Video modal
  const [videoModal, setVideoModal] = useState(null); // { creative }
  const [videoPrompt, setVideoPrompt] = useState(DEFAULT_VIDEO_PROMPT);
  const [videoDuration, setVideoDuration] = useState(5);
  const [videoSubmitting, setVideoSubmitting] = useState(false);

  // Lightbox
  const [lightbox, setLightbox] = useState(null); // { items:[{url,name}], index }
  const [promptExpanded, setPromptExpanded] = useState(false);

  // Feedback
  const [hoverStar, setHoverStar] = useState({});
  const [commentModal, setCommentModal] = useState(null); // { creativeId, name }
  const [commentText, setCommentText] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // creativeId

  const pollingIntervals = useRef({});

  const creativeProxyUrl = (id) => {
    const token = localStorage.getItem('access_token');
    const wsId = localStorage.getItem('active_workspace_id');
    return `/api/creatives/${id}/image/?token=${token}&workspace_id=${wsId}`;
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const openVideoModal = (creative, sourceImageUrl) => {
    setVideoPrompt(DEFAULT_VIDEO_PROMPT);
    setVideoDuration(5);
    setVideoModal({ creative, sourceImageUrl: sourceImageUrl || null });
  };

  const closeVideoModal = () => {
    if (videoSubmitting) return;
    setVideoModal(null);
  };

  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    Promise.all([
      creativesApi.gallery(),
      brandKitApi.campaigns(),
      creativesApi.videoJobs(),
      creativesApi.logoResults(),
    ]).then(([items, camps, vjobs, lresults]) => {
      const list = items?.results || items || [];
      setCreatives(list.map(c => ({ ...c, thumbnail: c.thumbnail || c.image_url })));
      setCampaignsList(camps?.results || camps || []);
      setVideoJobs(vjobs?.results || vjobs || []);
      setLogoResults(lresults?.results || lresults || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowRight') { setLightbox(lb => lb && lb.index < lb.items.length - 1 ? { ...lb, index: lb.index + 1 } : lb); setPromptExpanded(false); }
      if (e.key === 'ArrowLeft')  { setLightbox(lb => lb && lb.index > 0 ? { ...lb, index: lb.index - 1 } : lb); setPromptExpanded(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

  const handleDeleteCreative = async (id) => {
    try {
      await creativesApi.deleteCreative(id);
      setCreatives(prev => prev.filter(c => c.id !== id));
      setDeleteConfirm(null);
      if (lightbox) {
        const remaining = lightbox.items.filter(it => it.creative?.id !== id);
        if (remaining.length === 0) { setLightbox(null); }
        else { setLightbox({ ...lightbox, items: remaining, index: Math.min(lightbox.index, remaining.length - 1) }); }
      }
    } catch (_) {}
  };

  // Poll active video jobs
  useEffect(() => {
    videoJobs.forEach(vjob => {
      if (vjob.status !== 'pending' && vjob.status !== 'processing') return;
      if (pollingIntervals.current[vjob.id]) return;

      const interval = setInterval(async () => {
        try {
          const updated = await creativesApi.videoJobStatus(vjob.id);
          if (updated.status === 'done' || updated.status === 'error') {
            clearInterval(pollingIntervals.current[vjob.id]);
            delete pollingIntervals.current[vjob.id];
            setVideoJobs(prev => prev.map(j => j.id === vjob.id ? { ...j, ...updated } : j));
            if (updated.status === 'done') {
              setCreatives(prev => prev.map(c =>
                c.id === vjob.source_creative_id
                  ? { ...c, vjob_status: 'done', video_url: updated.video_url }
                  : c
              ));
              showToast(`Video ready: "${vjob.source_creative_name || 'Creative'}"!`);
            }
          }
        } catch {}
      }, 3000);

      pollingIntervals.current[vjob.id] = interval;
    });
  }, [videoJobs]);

  useEffect(() => {
    return () => { Object.values(pollingIntervals.current).forEach(clearInterval); };
  }, []);

  const handleMakeVideo = async () => {
    if (!videoModal) return;
    const creative = videoModal.creative;
    setVideoSubmitting(true);
    try {
      const vjob = await creativesApi.makeVideo(creative.id, videoPrompt, videoModal.sourceImageUrl, videoDuration);
      const newJob = {
        ...vjob,
        source_creative_id: creative.id,
        source_creative_name: creative.name,
      };
      setVideoJobs(prev => [newJob, ...prev]);
      setCreatives(prev => prev.map(c =>
        c.id === creative.id ? { ...c, vjob_id: vjob.id, vjob_status: 'pending' } : c
      ));
      showToast(`Video render started: "${creative.name}"!`);
      setVideoModal(null);
    } catch {
      showToast('Video render failed. Please try again.');
    } finally {
      setVideoSubmitting(false);
    }
  };

  const filteredCreatives = creatives.filter(c => {
    const matchesSearch = (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.campaign_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (activeTab === 'Photos' && c.media_type !== 'Photo') return false;
    if (selectedCampaignFilter !== 'All' && c.campaign_name !== selectedCampaignFilter) return false;
    if (selectedFilters.includes('logo') && c.logo_position === 'No Logo') return false;
    if (selectedFilters.includes('no logo') && c.logo_position !== 'No Logo') return false;
    return true;
  });

  const toggleFilter = (filter) => {
    setSelectedFilters(prev => prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]);
  };
  const clearAllFilters = () => {
    setSelectedFilters([]); setActiveTab('All'); setSearchTerm(''); setSelectedCampaignFilter('All');
  };

  const pendingVideos = videoJobs.filter(j => j.status === 'pending' || j.status === 'processing').length;
  const tabs = [
    { id: 'All', label: 'All', count: creatives.length },
    { id: 'Photos', label: 'Photos', count: creatives.filter(c => c.media_type === 'Photo').length },
    { id: 'Videos', label: 'Videos', count: videoJobs.length, badge: pendingVideos || null },
    { id: 'With Logo', label: 'With Logo', count: logoResults.length },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 text-left relative">
      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }}
            className="fixed top-24 right-4 sm:right-8 bg-blue-500 text-white font-bold p-4 rounded-xl shadow-2xl z-50 flex items-center gap-3 border border-blue-400">
            <span className="text-sm">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Make Video Modal */}
      <AnimatePresence>
        {videoModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
              onClick={closeVideoModal} />
            <motion.div initial={{ opacity: 0, scale: 0.93, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.93, y: 30 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg mx-4">
              <div className="bg-[#0c0f16] border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl">

                {/* Preview strip */}
                <div className="relative h-48 bg-black overflow-hidden">
                  <img src={videoModal.creative.thumbnail || videoModal.creative.image_url}
                    className="w-full h-full object-cover opacity-60"
                    alt={videoModal.creative.name} />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0c0f16]" />
                  <div className="absolute top-4 left-4">
                    <span className="px-3 py-1 bg-purple-600/80 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-widest rounded-full border border-purple-500/40">
                      Make Video
                    </span>
                  </div>
                  <button onClick={closeVideoModal}
                    className="absolute top-4 right-4 w-8 h-8 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors border border-white/10">
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-white font-bold text-sm truncate">{videoModal.creative.name}</p>
                  </div>
                </div>

                {/* Prompt editor */}
                <div className="p-6 space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-purple-400" /> Video Prompt
                    </label>
                    <textarea
                      value={videoPrompt}
                      onChange={e => setVideoPrompt(e.target.value)}
                      rows={3}
                      placeholder="Describe the motion and style of the video..."
                      className="w-full bg-black/60 border border-white/10 focus:border-purple-500/50 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none transition-all resize-none font-medium leading-relaxed"
                    />
                    <p className="text-[10px] text-gray-600">Describe camera movement, mood, speed. The more specific, the better the result.</p>
                  </div>

                  {/* Duration slider */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Duration</label>
                      <span className="text-sm font-black text-white">{videoDuration}s</span>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min={5} max={15} step={1}
                        value={videoDuration}
                        onChange={e => setVideoDuration(Number(e.target.value))}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/10 accent-purple-500"
                        style={{ background: `linear-gradient(to right, #9333ea ${(videoDuration - 5) / 10 * 100}%, rgba(255,255,255,0.1) ${(videoDuration - 5) / 10 * 100}%)` }}
                      />
                      <div className="flex justify-between mt-1.5">
                        {[5,6,7,8,9,10,11,12,13,14,15].map(v => (
                          <span key={v} className={`text-[9px] font-bold transition-colors ${videoDuration === v ? 'text-purple-400' : 'text-gray-700'}`}>
                            {v % 5 === 0 ? `${v}s` : '·'}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Preset prompts */}
                  <div className="space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Quick presets</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'Smooth cinematic zoom in',
                        'Slow dramatic pan',
                        'Subtle parallax motion',
                        'Epic wide angle sweep',
                      ].map(preset => (
                        <button key={preset} onClick={() => setVideoPrompt(preset + ', high quality, photorealistic')}
                          className="px-3 py-1.5 bg-white/5 hover:bg-purple-500/15 border border-white/5 hover:border-purple-500/30 rounded-lg text-[10px] text-gray-400 hover:text-purple-300 transition-all font-bold">
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-1">
                    <button onClick={closeVideoModal} disabled={videoSubmitting}
                      className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50">
                      Cancel
                    </button>
                    <button onClick={handleMakeVideo} disabled={videoSubmitting || !videoPrompt.trim()}
                      className="flex-[2] py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900/40 disabled:text-purple-400 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                      {videoSubmitting
                        ? <><div className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /> Starting…</>
                        : <><Video className="w-3.5 h-3.5" /> Start Render</>
                      }
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Comment Modal */}
      <AnimatePresence>
        {commentModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setCommentModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-[#10141d] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-black text-white">Comment</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[200px]">{commentModal.name}</p>
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
                  className="flex-[2] py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
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
            className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setDeleteConfirm(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-[#10141d] border border-red-500/20 rounded-3xl p-6 w-full max-w-xs shadow-2xl text-center"
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

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white uppercase font-sans">Generated Output Vault</h1>
          <p className="text-gray-500 mt-2 text-sm italic">AI-rendered creative drops awaiting final approval and publication</p>
        </div>
        <div className="flex items-center gap-3">
          {(activeTab === 'All' || activeTab === 'Photos') && (
            <div className="flex items-center gap-1.5 p-1 bg-[#10141d] border border-white/5 rounded-xl">
              <button onClick={() => setView('grid')} className={`p-2 rounded-lg transition-colors ${view === 'grid' ? 'bg-white text-black font-black' : 'text-gray-500 hover:text-white'}`}>
                <Grid className="w-4 h-4" />
              </button>
              <button onClick={() => setView('list')} className={`p-2 rounded-lg transition-colors ${view === 'list' ? 'bg-white text-black font-black' : 'text-gray-500 hover:text-white'}`}>
                <List className="w-4 h-4" />
              </button>
            </div>
          )}
          <button className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all">
            <Download className="w-4 h-4" /> Bulk Export
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 pb-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 font-bold text-xs tracking-widest uppercase transition-all relative flex items-center gap-2 ${activeTab === tab.id ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            {tab.label}
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${activeTab === tab.id ? 'bg-blue-500/20 text-blue-300' : 'bg-white/5 text-gray-600'}`}>
              {tab.count}
            </span>
            {tab.badge ? (
              <span className="w-4 h-4 bg-purple-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse">
                {tab.badge}
              </span>
            ) : null}
            {activeTab === tab.id && <motion.div layoutId="activeTabLine" className="absolute bottom-0 inset-x-0 h-0.5 bg-blue-500 rounded-full" />}
          </button>
        ))}
      </div>

      {/* Filter bar — only for All/Photos */}
      {(activeTab === 'All' || activeTab === 'Photos') && (
        <div className="space-y-4">
          <div className="relative flex flex-col md:flex-row items-stretch md:items-center gap-4 p-2 bg-[#10141d] border border-white/5 rounded-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by name or Campaign..."
                className="w-full bg-black border border-white/5 rounded-xl py-2.5 pl-12 pr-4 text-sm text-white placeholder:text-gray-700 outline-none focus:border-blue-500/30 transition-all font-medium" />
            </div>
            <div className="relative shrink-0">
              <select value={selectedCampaignFilter} onChange={e => setSelectedCampaignFilter(e.target.value)}
                className="w-full md:w-auto bg-black/40 border border-white/10 hover:border-white/20 text-gray-300 rounded-xl py-2.5 pl-4 pr-10 text-xs font-bold uppercase tracking-widest outline-none focus:border-blue-500 transition-all cursor-pointer appearance-none">
                <option value="All">All Campaigns</option>
                {campaignsList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            </div>
            <div className="relative shrink-0">
              <button onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all ${
                  isFilterDropdownOpen || selectedFilters.length > 0
                    ? 'bg-blue-600/10 border-blue-500 text-blue-400'
                    : 'bg-zinc-900 border-white/5 text-gray-400 hover:text-white hover:border-white/15'
                }`}>
                <Filter className="w-4 h-4" /> Filters
                {selectedFilters.length > 0 && <span className="bg-blue-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-black">{selectedFilters.length}</span>}
                <ChevronDown className={`w-3 h-3 transition-transform ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {isFilterDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setIsFilterDropdownOpen(false)} />
                    <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="absolute right-0 top-full mt-2 w-64 bg-[#0c0f16] border border-white/10 rounded-2xl shadow-2xl z-30 p-5 space-y-4 text-left">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Filters</span>
                        {selectedFilters.length > 0 && (
                          <button onClick={() => { setSelectedFilters([]); setIsFilterDropdownOpen(false); }}
                            className="text-[10px] font-bold text-red-400 hover:text-red-300 uppercase">Clear</button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-[#5d677a]">Logo</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[{ id: 'logo', label: 'With Logo' }, { id: 'no logo', label: 'No Logo' }].map(item => (
                            <button key={item.id} onClick={() => toggleFilter(item.id)}
                              className={`py-2 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider border text-center transition-all ${
                                selectedFilters.includes(item.id) ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-black border-white/5 text-gray-400 hover:text-white'
                              }`}>{item.label}</button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
          {(selectedFilters.length > 0 || selectedCampaignFilter !== 'All') && (
            <div className="flex flex-wrap items-center gap-2 justify-start">
              {selectedCampaignFilter !== 'All' && (
                <span onClick={() => setSelectedCampaignFilter('All')}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 rounded-full text-[10px] font-bold text-blue-400 cursor-pointer">
                  Campaign: {selectedCampaignFilter} <X className="w-3 h-3" />
                </span>
              )}
              {selectedFilters.map(f => (
                <span key={f} onClick={() => toggleFilter(f)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/5 border border-blue-500/10 rounded-full text-[10px] font-bold uppercase text-blue-400 cursor-pointer">
                  {f} <X className="w-3 h-3" />
                </span>
              ))}
              <button onClick={clearAllFilters} className="text-[10px] text-gray-500 hover:text-red-400 font-bold ml-1">Clear All</button>
            </div>
          )}
        </div>
      )}

      {/* ── All / Photos tab ── */}
      {(activeTab === 'All' || activeTab === 'Photos') && (
        filteredCreatives.length === 0 ? (
          <div className="p-16 text-center rounded-[2.5rem] bg-[#10141d] border border-white/5 space-y-4">
            <ImageIcon className="w-12 h-12 text-gray-600 mx-auto" />
            <p className="text-sm font-bold text-gray-300">No creatives found</p>
          </div>
        ) : (
          <div className={view === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-4"}>
            {filteredCreatives.map((creative, i) => {
              const isRendering = creative.vjob_status === 'pending' || creative.vjob_status === 'processing';
              return (
                <motion.div key={creative.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className={`group rounded-[2rem] bg-[#10141d] border border-white/5 overflow-hidden flex transition-all ${
                    view === 'grid' ? 'flex-col hover:border-blue-500/20' : 'flex-row items-center gap-6 p-4 hover:border-blue-500/20 w-full'
                  }`}>
                  <div
                    className={`relative bg-black overflow-hidden shrink-0 ${view === 'grid' ? 'aspect-[4/5] w-full' : 'w-28 aspect-[4/5] rounded-xl'}`}
                    onClick={() => setLightbox({ items: filteredCreatives.map(c => ({ url: creativeProxyUrl(c.id), name: c.name, creative: c })), index: filteredCreatives.indexOf(creative) })}
                  >
                    <img src={creativeProxyUrl(creative.id)}
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all duration-300"
                      alt={creative.name} />

                    {/* Star rating bar — top, on hover */}
                    {view === 'grid' && (
                      <div
                        className="absolute top-0 inset-x-0 z-10 flex items-center justify-center gap-1 py-2.5 bg-gradient-to-b from-black/75 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        onMouseLeave={() => setHoverStar(prev => { const n = {...prev}; delete n[creative.id]; return n; })}
                        onClick={e => e.stopPropagation()}
                      >
                        {[1,2,3,4,5].map(s => {
                          const activeRating = hoverStar[creative.id] ?? creative.rating ?? 0;
                          const full = activeRating >= s * 2;
                          const half = !full && activeRating >= s * 2 - 1;
                          return (
                            <button
                              key={s}
                              onMouseMove={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const isLeft = e.clientX - rect.left < rect.width / 2;
                                setHoverStar(prev => ({ ...prev, [creative.id]: s * 2 - (isLeft ? 1 : 0) }));
                              }}
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const isLeft = e.clientX - rect.left < rect.width / 2;
                                handleRateCreative(creative.id, s * 2 - (isLeft ? 1 : 0));
                              }}
                              className="transition-transform hover:scale-125"
                            >
                              {full
                                ? <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                                : half
                                ? <StarHalf className="w-5 h-5 text-amber-400 fill-amber-400" />
                                : <Star className="w-5 h-5 text-white/40" />}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                      <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl border border-white/20 text-white text-xs font-bold flex items-center gap-2">
                        <Maximize2 className="w-3.5 h-3.5" /> View Fullscreen
                      </div>
                    </div>

                    {creative.video_url && (
                      <a href={creative.video_url} target="_blank" rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-3 right-3 p-1.5 bg-green-600/80 hover:bg-green-500 backdrop-blur-sm rounded-lg transition-colors"
                        title="Watch Video">
                        <Play className="w-3 h-3 fill-white text-white" />
                      </a>
                    )}

                    <div className="absolute inset-x-0 bottom-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300 bg-gradient-to-t from-black via-black/80 to-transparent pt-10">
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <button onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/logo-editor/${creative.job_id}`); }}
                            className="flex-1 py-2 bg-white hover:bg-blue-600 text-black hover:text-white font-bold text-[10px] text-center uppercase tracking-widest rounded-lg transition-colors">
                            Edit Logo
                          </button>
                          <a href={creativeProxyUrl(creative.id)} download={`${creative.name || creative.id}.jpg`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors" title="Download">
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                        {creative.media_type === 'Photo' && (
                          <button onClick={(e) => { e.stopPropagation(); openVideoModal(creative); }} disabled={isRendering}
                            className={`w-full py-2 font-bold text-[10px] text-center uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                              isRendering
                                ? 'bg-purple-900/40 border border-purple-500/30 text-purple-300 cursor-not-allowed'
                                : 'bg-purple-600 hover:bg-purple-500 text-white'
                            }`}>
                            {isRendering
                              ? <><div className="w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin" /> Rendering…</>
                              : <><Video className="w-3.5 h-3.5" /> Make Video</>
                            }
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-md border ${
                        creative.logo_position !== 'No Logo' ? 'bg-blue-500/15 text-blue-400 border-blue-500/20' : 'bg-zinc-800/80 text-zinc-400 border-white/5'
                      }`}>{creative.logo_position !== 'No Logo' ? 'Logo' : 'No Logo'}</span>
                    </div>
                  </div>

                  <div className={`flex-1 p-5 space-y-3 ${view === 'list' ? 'py-0' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{creative.name}</h4>
                        <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-widest italic">{creative.campaign_name}</p>
                        {creative.rating > 0 && (
                          <div className="flex items-center gap-0.5 mt-1">
                            {[1,2,3,4,5].map(s => {
                              const full = creative.rating >= s * 2;
                              const half = !full && creative.rating >= s * 2 - 1;
                              return full
                                ? <Star key={s} className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                                : half
                                ? <StarHalf key={s} className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                                : <Star key={s} className="w-2.5 h-2.5 text-slate-700" />;
                            })}
                          </div>
                        )}
                        {creative.aspect_ratio && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 bg-white/5 border border-white/8 rounded text-[9px] font-black text-slate-400 uppercase tracking-wider">
                            {creative.aspect_ratio}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); openCommentModal(creative); }}
                          className="relative p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
                          title="Comment">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {creative.feedback_text && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-blue-500 rounded-full" />}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(creative.id); }}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/15 text-slate-500 hover:text-red-400 transition-colors"
                          title="Delete">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {view === 'list' && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => navigate(`/dashboard/logo-editor/${creative.job_id}`)}
                          className="px-3 py-1.5 bg-white/5 hover:bg-blue-600 border border-white/10 hover:border-blue-500 rounded-lg text-[9px] font-bold uppercase tracking-widest text-gray-300 hover:text-white transition-all">
                          Edit Logo
                        </button>
                        {creative.media_type === 'Photo' && (
                          <button onClick={() => openVideoModal(creative)} disabled={isRendering}
                            className={`px-3 py-1.5 border rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all flex items-center gap-1 ${
                              isRendering
                                ? 'bg-purple-900/40 border-purple-500/30 text-purple-300 cursor-not-allowed'
                                : 'bg-purple-600 hover:bg-purple-500 border-purple-500 text-white'
                            }`}>
                            {isRendering
                              ? <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Rendering</>
                              : <><Video className="w-3 h-3" /> Make Video</>
                            }
                          </button>
                        )}
                        {creative.video_url && (
                          <a href={creative.video_url} target="_blank" rel="noreferrer"
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-500 border border-green-500 rounded-lg text-[9px] font-bold uppercase tracking-widest text-white flex items-center gap-1 transition-all">
                            <Play className="w-2.5 h-2.5 fill-current" /> Watch
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )
      )}

      {/* ── Videos tab ── */}
      {activeTab === 'Videos' && (
        videoJobs.length === 0 ? (
          <div className="p-16 text-center rounded-[2.5rem] bg-[#10141d] border border-white/5 space-y-4">
            <Video className="w-12 h-12 text-gray-600 mx-auto" />
            <p className="text-sm font-bold text-gray-300">No videos yet</p>
            <p className="text-xs text-gray-500">Go to All or Photos tab and click "Make Video" on a creative.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {videoJobs.map((vjob, i) => (
              <motion.div key={vjob.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="group rounded-[2rem] bg-[#10141d] border border-white/5 overflow-hidden flex flex-col hover:border-blue-500/20 transition-all">
                <div className="relative bg-black overflow-hidden aspect-[4/5] w-full">
                  {vjob.status === 'done' && vjob.video_url ? (
                    <video
                      src={vjob.video_url}
                      poster={vjob.source_image_url}
                      autoPlay
                      muted
                      loop
                      playsInline
                      controls
                      className="w-full h-full object-contain bg-black"
                    />
                  ) : (
                    <div
                      className="w-full h-full cursor-pointer"
                      onClick={() => setLightbox({ items: videoJobs.filter(j => j.status !== 'done').map(j => ({ url: j.source_image_url, name: j.source_creative_name || 'Creative' })), index: videoJobs.filter(j => j.status !== 'done').indexOf(vjob) })}
                    >
                      <img src={vjob.source_image_url} className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-all duration-300"
                        alt={vjob.source_creative_name || 'Creative'} referrerPolicy="no-referrer" />
                      {(vjob.status === 'pending' || vjob.status === 'processing') ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-10 h-10 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs text-purple-300 font-bold uppercase tracking-wider">Rendering…</span>
                          </div>
                        </div>
                      ) : vjob.status === 'error' ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                          <span className="text-xs text-red-400 font-bold">Render failed</span>
                        </div>
                      ) : null}
                    </div>
                  )}

                  <div className="absolute top-3 left-3 pointer-events-none">
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-md border ${
                      vjob.status === 'done' ? 'bg-green-500/20 text-green-400 border-green-500/20' :
                      vjob.status === 'error' ? 'bg-red-500/20 text-red-400 border-red-500/20' :
                      'bg-purple-500/20 text-purple-400 border-purple-500/20'
                    }`}>{vjob.status === 'done' ? 'Ready' : vjob.status === 'error' ? 'Error' : 'Rendering'}</span>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-sm font-bold text-white truncate">{vjob.source_creative_name || 'Unnamed Creative'}</p>
                    {(() => { const ar = creatives.find(c => c.id === vjob.source_creative_id)?.aspect_ratio; return ar ? (
                      <span className="inline-block mt-1 px-1.5 py-0.5 bg-white/5 border border-white/8 rounded text-[9px] font-black text-slate-400 uppercase tracking-wider">{ar}</span>
                    ) : null; })()}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-600">
                      {new Date(vjob.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {vjob.status === 'done' && vjob.video_url && (
                      <a href={vjob.video_url} target="_blank" rel="noreferrer"
                        className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold rounded-lg flex items-center gap-1.5 transition-colors">
                        <ExternalLink className="w-3 h-3" /> Watch
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )
      )}

      {/* ── With Logo tab ── */}
      {activeTab === 'With Logo' && (
        logoResults.length === 0 ? (
          <div className="p-16 text-center rounded-[2.5rem] bg-[#10141d] border border-white/5 space-y-4">
            <ImageIcon className="w-12 h-12 text-gray-600 mx-auto" />
            <p className="text-sm font-bold text-gray-300">No logo composites yet</p>
            <p className="text-xs text-gray-500">Open the Logo Editor on a creative and save to generate composited images.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {logoResults.map((result, i) => (
              <motion.div key={result.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="group rounded-[2rem] bg-[#10141d] border border-white/5 overflow-hidden flex flex-col hover:border-blue-500/20 transition-all">
                <div
                  className="relative bg-black overflow-hidden aspect-[4/5] w-full cursor-zoom-in"
                  onClick={() => setLightbox({ items: logoResults.map(r => ({ url: r.url, name: r.source_creative_name || 'With Logo' })), index: i })}
                >
                  <img src={result.url} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all duration-300"
                    alt={result.source_creative_name || 'With Logo'} />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl border border-white/20 text-white text-xs font-bold flex items-center gap-2">
                      <Maximize2 className="w-3.5 h-3.5" /> View Fullscreen
                    </div>
                  </div>
                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-md bg-blue-500/20 text-blue-400 border border-blue-500/20">
                      Logo Applied
                    </span>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-sm font-bold text-white truncate">{result.source_creative_name || 'Unnamed Creative'}</p>
                    <p className="text-[10px] text-gray-600">
                      {new Date(result.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {(() => { const ar = creatives.find(c => c.id === result.source_creative_id)?.aspect_ratio; return ar ? (
                      <span className="inline-block mt-1 px-1.5 py-0.5 bg-white/5 border border-white/8 rounded text-[9px] font-black text-slate-400 uppercase tracking-wider">{ar}</span>
                    ) : null; })()}
                  </div>
                  {result.source_creative_id && (
                    <button
                      onClick={() => {
                        const src = creatives.find(c => c.id === result.source_creative_id);
                        if (src) openVideoModal(src, result.url);
                      }}
                      className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-1.5">
                      <Video className="w-3.5 h-3.5" /> Make Video
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )
      )}
      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (() => {
          const current = lightbox.items[lightbox.index];
          const c = current.creative;
          const hasPrev = lightbox.index > 0;
          const hasNext = lightbox.index < lightbox.items.length - 1;
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-black/95 flex"
              onClick={() => setLightbox(null)}
            >
              {/* Close */}
              <button onClick={() => setLightbox(null)}
                className="absolute top-4 right-4 p-2 text-white/40 hover:text-white transition-colors z-10">
                <X className="w-5 h-5" />
              </button>

              {/* Left — image + arrows */}
              <div className="flex-1 flex items-center justify-center relative min-w-0 px-16" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => { setLightbox(lb => ({ ...lb, index: lb.index - 1 })); setPromptExpanded(false); }}
                  className={`absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/8 hover:bg-white/16 text-white transition-all ${hasPrev ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <AnimatePresence mode="wait">
                  <motion.img
                    key={current.url}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.14 }}
                    src={current.url}
                    alt={current.name}
                    className="max-h-[92vh] max-w-full object-contain rounded-xl shadow-2xl"
                  />
                </AnimatePresence>

                <button
                  onClick={() => { setLightbox(lb => ({ ...lb, index: lb.index + 1 })); setPromptExpanded(false); }}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/8 hover:bg-white/16 text-white transition-all ${hasNext ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                {lightbox.items.length > 1 && (
                  <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-white/30 font-bold tracking-widest uppercase">
                    {lightbox.index + 1} / {lightbox.items.length}
                  </span>
                )}
              </div>

              {/* Right — info panel */}
              <div
                className="w-72 shrink-0 bg-[#0b0d14] border-l border-white/6 flex flex-col overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-5 space-y-5 flex-1">
                  {/* Name */}
                  <div>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Creative</p>
                    <p className="text-sm font-bold text-white leading-snug">{current.name}</p>
                    {c?.campaign_name && <p className="text-[10px] text-slate-500 mt-0.5">{c.campaign_name}</p>}
                  </div>

                  {/* Meta */}
                  {c && (
                    <div className="space-y-2.5">
                      {c.created_by_name && (
                        <div>
                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-0.5">Generated by</p>
                          <p className="text-xs text-white/80">{c.created_by_name}</p>
                        </div>
                      )}
                      {c.model_name && (
                        <div>
                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-0.5">Model</p>
                          <p className="text-xs text-white/80">{c.model_name}</p>
                        </div>
                      )}
                      {c.generation_mode && (
                        <div>
                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-0.5">Mode</p>
                          <p className={`text-xs font-bold ${c.generation_mode === 'Auto' ? 'text-emerald-400' : 'text-blue-400'}`}>
                            {c.generation_mode}
                          </p>
                        </div>
                      )}
                      {c.aspect_ratio && (
                        <div>
                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-0.5">Format</p>
                          <p className="text-xs text-white/80">{c.aspect_ratio}</p>
                        </div>
                      )}
                      {c.style && (
                        <div>
                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-0.5">Style</p>
                          <p className="text-xs text-white/80 capitalize">{c.style}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Additional Prompt */}
                  {c?.extra_prompt && (
                    <div>
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5">Additional Prompt</p>
                      <p className={`text-[11px] text-slate-400 leading-relaxed ${promptExpanded ? '' : 'line-clamp-3'}`}>
                        {c.extra_prompt}
                      </p>
                      {c.extra_prompt.length > 120 && (
                        <button
                          onClick={() => setPromptExpanded(v => !v)}
                          className="mt-1 text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest transition-colors"
                        >
                          {promptExpanded ? 'Show less ↑' : 'Read more ↓'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Negative Prompt */}
                  {c?.negative_prompt && (
                    <div>
                      <p className="text-[10px] font-black text-red-500/70 uppercase tracking-widest mb-1.5">Negative Prompt</p>
                      <p className="text-[11px] text-red-400/70 leading-relaxed italic">
                        {c.negative_prompt}
                      </p>
                    </div>
                  )}

                  {/* References */}
                  {c?.reference_thumbs?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">References</p>
                      <div className="flex flex-wrap gap-2">
                        {c.reference_thumbs.map((ref, ri) => (
                          <div key={ri} className="w-14 h-14 rounded-lg overflow-hidden bg-white/5 border border-white/8 shrink-0">
                            <img src={ref.url} alt={ref.name} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Date */}
                  {c?.created_at && (
                    <div>
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-0.5">Created</p>
                      <p className="text-xs text-white/50">
                        {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )}

                </div>

                {/* Download */}
                <div className="p-4 border-t border-white/6">
                  <a
                    href={current.url}
                    download={`${current.name || 'creative'}.jpg`}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 border border-white/8 text-white text-xs font-bold rounded-xl transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </a>
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
