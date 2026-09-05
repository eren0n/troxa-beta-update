import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Image as ImageIcon, Video, Check, Sparkles, ArrowRight, AlertTriangle,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { creativesApi, brandKitApi } from '../../lib/api';
import { GLASS_STYLE } from '../../components/ui/GlassCard';
import { CreativeGridSkeleton } from '../../components/ui/Skeleton';
import { creativeProxyUrl } from '../../lib/creativeUrl';
import { useCreativeGallery } from '../../lib/useCreativeGallery';
import TagBadge from '../../components/dashboard/TagBadge';
import TagPicker from '../../components/dashboard/TagPicker';
import UploadCreativeButton from '../../components/dashboard/UploadCreativeButton';
import InlineRename from '../../components/dashboard/InlineRename';
import CreativeFilterBar, { EMPTY_CREATIVE_FILTERS } from '../../components/dashboard/CreativeFilterBar';

const DEFAULT_VIDEO_PROMPT = 'Smooth cinematic motion, slow zoom in, high quality, photorealistic';
const PRESET_PROMPTS = [
  'Smooth cinematic zoom in',
  'Slow dramatic pan',
  'Subtle parallax motion',
  'Epic wide angle sweep',
];

export default function MakeVideo() {
  const navigate = useNavigate();
  const location = useLocation();
  const [campaignsList, setCampaignsList] = useState([]);
  const [filters, setFilters] = useState({ ...EMPTY_CREATIVE_FILTERS, mediaType: 'Photo' });
  const [allTags, setAllTags] = useState([]);
  const [contributorsList, setContributorsList] = useState([]);
  const { creatives, setCreatives, loading, hasMore, sentinelRef } = useCreativeGallery(filters, allTags, { pageSize: 12 });

  // Currently selected source image: { creative, sourceImageUrl, previewUrl, name, campaignName }
  const [selected, setSelected] = useState(null);

  const [videoPrompt, setVideoPrompt] = useState(DEFAULT_VIDEO_PROMPT);
  const [videoDuration, setVideoDuration] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [lastSubmitted, setLastSubmitted] = useState(null); // { name }

  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    Promise.all([
      brandKitApi.campaigns(),
      creativesApi.tags(),
      creativesApi.contributors(),
    ]).then(([camps, tags, contributors]) => {
      setCampaignsList(camps?.results || camps || []);
      setAllTags(tags?.results || tags || []);
      setContributorsList(contributors?.results || contributors || []);
    }).catch(() => {});
  }, []);

  const handleCreativeUploaded = (created) => {
    setCreatives(prev => [{ ...created, thumbnail: created.thumbnail || created.image_url }, ...prev]);
  };

  const handleRenameCreative = async (creativeId, name) => {
    setCreatives(prev => prev.map(c => c.id === creativeId ? { ...c, name } : c));
    setSelected(prev => prev?.creative?.id === creativeId ? { ...prev, name, creative: { ...prev.creative, name } } : prev);
    try { await creativesApi.updateCreative(creativeId, { name }); } catch (_) {}
  };

  const handleTagsChange = (creativeId, updatedTags) => {
    setCreatives(prev => prev.map(c => c.id === creativeId ? { ...c, tags: updatedTags } : c));
    setSelected(prev => prev?.creative?.id === creativeId ? { ...prev, creative: { ...prev.creative, tags: updatedTags } } : prev);
  };

  // A card's "Make Video" button hands us the full creative object directly
  // (via navigation state) rather than an id — the gallery here is paginated
  // most-recent-first, so an older creative might not be on the loaded page
  // yet, and we don't want to make the user hunt for it.
  useEffect(() => {
    if (location.state?.presetCreative) selectPhoto(location.state.presetCreative);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const selectPhoto = (creative) => {
    setLastSubmitted(null);
    setSubmitError(null);
    setSelected({
      creative,
      sourceImageUrl: null,
      previewUrl: creativeProxyUrl(creative.id),
      name: creative.name,
      campaignName: creative.campaign_name,
    });
  };

  const handleMakeVideo = async () => {
    if (!selected) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const vjob = await creativesApi.makeVideo(selected.creative.id, videoPrompt, selected.sourceImageUrl, videoDuration);
      setCreatives(prev => prev.map(c =>
        c.id === selected.creative.id ? { ...c, vjob_id: vjob.id, vjob_status: 'pending' } : c
      ));
      setSelected(prev => prev ? { ...prev, creative: { ...prev.creative, vjob_status: 'pending' } } : prev);
      setLastSubmitted({ name: selected.name });
    } catch {
      setSubmitError('Video render failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isRendering = selected?.creative?.vjob_status === 'pending' || selected?.creative?.vjob_status === 'processing';

  return (
    <div className="pb-10">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="w-9 h-9 bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--accent)_20%,transparent)] rounded-xl flex items-center justify-center">
              <Video className="w-4 h-4 text-(--accent)" />
            </div>
            Make Video
          </h1>
          <p className="text-slate-500 text-sm mt-1 ml-12">Turn a generated photo into a cinematic AI-rendered video</p>
        </div>
        <div className="ml-12 md:ml-0 flex items-center gap-2 w-fit">
          <UploadCreativeButton onUploaded={handleCreativeUploaded} />
          <button
            onClick={() => navigate('/dashboard/gallery', { state: { mediaType: 'Video' } })}
            className="px-4 py-2 bg-white/4 border border-white/8 hover:border-white/20 text-slate-400 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"
          >
            See Generated Videos <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left – Source Image Picker */}
        <div style={GLASS_STYLE} className="flex-1 rounded-2xl overflow-hidden flex flex-col min-h-96 w-full">
          <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
            <ImageIcon className="w-4 h-4 text-slate-500" />
            <h2 className="font-black text-white text-sm">Source Image</h2>
          </div>

          <div className="px-6 py-4 border-b border-white/5">
            <CreativeFilterBar
              filters={filters}
              onChange={setFilters}
              campaignsList={campaignsList}
              allTags={allTags}
              contributorsList={contributorsList}
              showMediaType={false}
              searchPlaceholder="Search by name or campaign..."
            />
          </div>

          <div className="flex-1 p-5">
            {loading ? (
              <CreativeGridSkeleton count={8} columns="grid-cols-2 md:grid-cols-3 xl:grid-cols-4" gap="gap-3" cardRounded="rounded-xl" showMeta={false} glass={false} />
            ) : creatives.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <ImageIcon className="w-10 h-10 text-slate-700 mx-auto" />
                <p className="text-sm font-bold text-slate-400">No photos found</p>
                <p className="text-xs text-slate-600">Generate some photo creatives first, then come back to animate them.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {creatives.map((creative) => {
                  const isSel = selected?.creative?.id === creative.id && !selected?.sourceImageUrl;
                  const rendering = creative.vjob_status === 'pending' || creative.vjob_status === 'processing';
                  return (
                    <motion.div
                      key={creative.id}
                      onClick={() => selectPhoto(creative)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`group relative bg-black rounded-xl overflow-hidden aspect-4/5 cursor-pointer border-2 transition-all ${
                        isSel ? 'border-(--accent) ring-2 ring-[color-mix(in_srgb,var(--accent)_20%,transparent)]' : 'border-transparent hover:border-white/15'
                      }`}
                    >
                      <img src={creativeProxyUrl(creative.id)}
                        className={`w-full h-full object-cover transition-all duration-300 ${isSel ? 'opacity-100' : 'opacity-60 group-hover:opacity-90'}`}
                        alt={creative.name} loading="lazy" decoding="async" />
                      <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent" />
                      <div className="absolute bottom-0 inset-x-0 p-2 space-y-1">
                        <p className="text-[10px] font-bold text-white truncate">{creative.name}</p>
                        {creative.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {creative.tags.slice(0, 2).map(tag => <TagBadge key={tag.id} tag={tag} size="xs" />)}
                          </div>
                        )}
                      </div>
                      <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                        {rendering && (
                          <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-[color-mix(in_srgb,var(--accent)_80%,transparent)] text-white backdrop-blur-sm">
                            Rendering
                          </span>
                        )}
                        {creative.source === 'uploaded' && (
                          <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-amber-500/80 text-white backdrop-blur-sm">
                            Uploaded
                          </span>
                        )}
                      </div>
                      <AnimatePresence>
                        {isSel && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            className="absolute top-2 right-2 w-5 h-5 bg-(--accent) rounded-md flex items-center justify-center shadow-accent-glow border border-[color-mix(in_srgb,var(--accent)_40%,transparent)]"
                          >
                            <Check className="w-3 h-3 text-white stroke-3" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {hasMore && (
              <div ref={sentinelRef} className="flex items-center justify-center py-6">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Right – Video Settings Panel */}
        <div className="w-full lg:w-96 space-y-4">
          {/* Preview */}
          <div style={GLASS_STYLE} className="rounded-2xl overflow-hidden">
            {selected ? (
              <div className="relative h-44 bg-black">
                <img src={selected.previewUrl} className="w-full h-full object-cover opacity-70" alt={selected.name} />
                <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-transparent" />
                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                  <TagPicker
                    creativeId={selected.creative.id}
                    currentTags={selected.creative.tags || []}
                    allTags={allTags}
                    onChange={(tags) => handleTagsChange(selected.creative.id, tags)}
                    onTagCreated={(tag) => setAllTags(prev => [...prev, tag])}
                    triggerClassName="w-7 h-7 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors border border-white/10"
                  />
                  <button onClick={() => setSelected(null)}
                    className="w-7 h-7 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors border border-white/10">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="absolute bottom-3 left-4 right-4">
                  <InlineRename
                    value={selected.name}
                    onSave={(name) => handleRenameCreative(selected.creative.id, name)}
                    textClassName="text-white font-black text-sm truncate"
                  />
                  {selected.campaignName && <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">{selected.campaignName}</p>}
                  {selected.creative.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {selected.creative.tags.map(tag => <TagBadge key={tag.id} tag={tag} size="xs" />)}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center gap-2 text-center px-6">
                <ImageIcon className="w-8 h-8 text-slate-700" />
                <p className="text-xs text-slate-600 font-bold">Select an image on the left to get started</p>
              </div>
            )}
          </div>

          {/* Prompt + Duration */}
          <div style={GLASS_STYLE} className="rounded-2xl p-5 space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-(--accent)" /> Video Prompt
              </label>
              <textarea
                value={videoPrompt}
                onChange={e => setVideoPrompt(e.target.value)}
                rows={3}
                placeholder="Describe the motion and style of the video..."
                className="w-full bg-[#0b0e1a] border border-white/8 hover:border-white/12 focus:border-[color-mix(in_srgb,var(--accent)_50%,transparent)] rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-700 outline-none transition-all resize-none font-medium leading-relaxed"
              />
              <p className="text-[10px] text-slate-700">Describe camera movement, mood, speed. The more specific, the better the result.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {PRESET_PROMPTS.map(preset => (
                <button key={preset} onClick={() => setVideoPrompt(preset + ', high quality, photorealistic')}
                  className="px-3 py-1.5 bg-white/4 hover:bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] border border-white/6 hover:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] rounded-lg text-[10px] text-slate-500 hover:text-(--accent-hover) transition-all font-bold">
                  {preset}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Duration</label>
                <span className="text-sm font-black text-white">{videoDuration}s</span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min={5} max={15} step={1}
                  value={videoDuration}
                  onChange={e => setVideoDuration(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/10 accent-(--accent)"
                  style={{ background: `linear-gradient(to right, var(--accent) ${(videoDuration - 5) / 10 * 100}%, rgba(255,255,255,0.1) ${(videoDuration - 5) / 10 * 100}%)` }}
                />
                <div className="flex justify-between mt-1.5">
                  {[5,6,7,8,9,10,11,12,13,14,15].map(v => (
                    <span key={v} className={`text-[9px] font-bold transition-colors ${videoDuration === v ? 'text-(--accent)' : 'text-slate-700'}`}>
                      {v % 5 === 0 ? `${v}s` : '·'}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div style={GLASS_STYLE} className="rounded-2xl p-5 space-y-3">
            <AnimatePresence>
              {lastSubmitted && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden">
                  <div className="p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl flex items-start gap-2.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-emerald-300">Render started for "{lastSubmitted.name}"</p>
                      <button onClick={() => navigate('/dashboard/gallery', { state: { mediaType: 'Video' } })}
                        className="text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest mt-1 transition-colors">
                        Track in My Videos →
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {submitError && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden">
                  <div className="p-3 bg-red-500/8 border border-red-500/20 rounded-xl flex items-center gap-2.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <p className="text-xs font-bold text-red-300">{submitError}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {isRendering && !lastSubmitted && (
              <div className="p-3 bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] border border-[color-mix(in_srgb,var(--accent)_20%,transparent)] rounded-xl flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 border-2 border-(--accent) border-t-transparent rounded-full animate-spin shrink-0" />
                <p className="text-xs font-bold text-(--accent-hover)">This image already has a video rendering.</p>
              </div>
            )}

            <motion.button
              onClick={handleMakeVideo}
              disabled={!selected || submitting || isRendering || !videoPrompt.trim()}
              whileHover={selected && !submitting && !isRendering ? { scale: 1.01 } : {}}
              whileTap={selected && !submitting && !isRendering ? { scale: 0.99 } : {}}
              className="w-full py-4 bg-(--accent) hover:bg-(--accent-hover) disabled:bg-[color-mix(in_srgb,var(--accent)_40%,transparent)] disabled:text-[color-mix(in_srgb,var(--accent)_60%,transparent)] disabled:cursor-not-allowed text-white rounded-xl font-black text-sm transition-all shadow-accent-glow flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Starting…</>
              ) : (
                <><Video className="w-4 h-4" /> Start Render</>
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
