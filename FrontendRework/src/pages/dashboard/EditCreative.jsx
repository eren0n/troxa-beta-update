import { useState, useEffect } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import { Image as ImageIcon, Pencil, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { creativesApi, brandKitApi } from '../../lib/api';
import { GLASS_STYLE } from '../../components/ui/GlassCard';
import { CreativeGridSkeleton } from '../../components/ui/Skeleton';
import CreativeEditorPane from '../../components/dashboard/CreativeEditorPane';
import { creativeProxyUrl } from '../../lib/creativeUrl';
import { useCreativeGallery } from '../../lib/useCreativeGallery';
import TagBadge from '../../components/dashboard/TagBadge';
import TagPicker from '../../components/dashboard/TagPicker';
import UploadCreativeButton from '../../components/dashboard/UploadCreativeButton';
import InlineRename from '../../components/dashboard/InlineRename';
import CreativeFilterBar, { EMPTY_CREATIVE_FILTERS } from '../../components/dashboard/CreativeFilterBar';

// Spring used for the card growing from a grid thumbnail into the editor —
// shared so the grow and the shrink-back-on-close feel identical.
const GROW_SPRING = { type: 'spring', stiffness: 260, damping: 32, mass: 0.9 };

export default function EditCreative() {
  const navigate = useNavigate();
  const [campaignsList, setCampaignsList] = useState([]);
  const [filters, setFilters] = useState({ ...EMPTY_CREATIVE_FILTERS, mediaType: 'Photo' });
  const [allTags, setAllTags] = useState([]);
  const [contributorsList, setContributorsList] = useState([]);
  const [openId, setOpenId] = useState(null);
  const { creatives, setCreatives, loading, hasMore, sentinelRef } = useCreativeGallery(filters, allTags, { pageSize: 12 });

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

  const handleCreativeSaved = (saved) => {
    if (!saved?.id) return;
    setCreatives(prev => [{ ...saved, thumbnail: saved.thumbnail || saved.image_url }, ...prev.filter(c => c.id !== saved.id)]);
  };

  const handleRenameCreative = async (creativeId, name) => {
    setCreatives(prev => prev.map(c => c.id === creativeId ? { ...c, name } : c));
    try { await creativesApi.updateCreative(creativeId, { name }); } catch (_) {}
  };

  const handleTagsChange = (creativeId, updatedTags) => {
    setCreatives(prev => prev.map(c => c.id === creativeId ? { ...c, tags: updatedTags } : c));
  };

  const hasMoreToLoad = !openId && hasMore;

  // While editing, only the selected card renders (it grows in place);
  // every other thumbnail unmounts and plays its exit animation.
  const visibleCards = openId
    ? creatives.filter(c => c.id === openId)
    : creatives;

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-8 pb-20 text-left">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white uppercase font-sans flex items-center gap-3">
              <div className="w-9 h-9 bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--accent)_20%,transparent)] rounded-xl flex items-center justify-center shrink-0">
                <Pencil className="w-4 h-4 text-(--accent)" />
              </div>
              Edit Creative
            </h1>
            <p className="text-gray-500 mt-2 text-sm italic">
              {openId ? 'Editing in place — your other creatives are still right here.' : 'Pick a photo to add logos, images, text, crop, or resize'}
            </p>
          </div>
          <AnimatePresence mode="wait">
            {openId ? (
              <motion.button
                key="back"
                initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                onClick={() => setOpenId(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest text-gray-300 hover:text-white transition-all">
                ← Back to gallery
              </motion.button>
            ) : (
              <motion.div key="upload" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                className="flex items-center gap-2">
                <UploadCreativeButton onUploaded={handleCreativeUploaded} />
                <button
                  onClick={() => navigate('/dashboard/gallery', { state: { isEdited: 'true' } })}
                  className="px-4 py-2 bg-white/4 border border-white/8 hover:border-white/20 text-slate-400 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"
                >
                  See Edited Creatives <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Filter bar — hidden while editing, nothing to filter mid-edit */}
        <AnimatePresence>
          {!openId && (
            <motion.div
              initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
              animate={{ opacity: 1, height: 'auto', transitionEnd: { overflow: 'visible' } }}
              exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
              transition={{ duration: 0.2 }}>
              <CreativeFilterBar
                filters={filters}
                onChange={setFilters}
                campaignsList={campaignsList}
                allTags={allTags}
                contributorsList={contributorsList}
                showMediaType={false}
                searchPlaceholder="Search by name or Campaign..."
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grid — collapses to the single growing card while editing */}
        {loading ? (
          <CreativeGridSkeleton count={8} />
        ) : creatives.length === 0 ? (
          <div style={GLASS_STYLE} className="p-16 text-center rounded-[2.5rem] space-y-4">
            <ImageIcon className="w-12 h-12 text-gray-600 mx-auto" />
            <p className="text-sm font-bold text-gray-300">No creatives found</p>
            <p className="text-xs text-gray-500">Generate or upload some creatives first, then come back to edit them.</p>
          </div>
        ) : (
          <div className={openId ? '' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'}>
            <AnimatePresence mode="popLayout">
              {visibleCards.map((creative, i) => {
                const isOpen = creative.id === openId;
                return (
                  <motion.div
                    key={creative.id}
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: isOpen ? 0 : i * 0.035 } }}
                    exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.16, delay: i * 0.02 } }}
                    transition={{ layout: GROW_SPRING }}
                    style={GLASS_STYLE}
                    onClick={() => { if (!isOpen) setOpenId(creative.id); }}
                    className={isOpen
                      ? 'rounded-3xl overflow-hidden'
                      : 'group rounded-4xl overflow-hidden flex flex-col hover:border-[color-mix(in_srgb,var(--accent)_20%,transparent)] transition-all cursor-pointer'}
                  >
                    {isOpen ? (
                      <div style={{ height: 'min(78vh, 760px)' }}>
                        <CreativeEditorPane creativeId={creative.id} onClose={() => setOpenId(null)} onSaved={handleCreativeSaved} />
                      </div>
                    ) : (
                      <>
                        <div className="relative bg-black overflow-hidden aspect-4/5 w-full">
                          <img src={creativeProxyUrl(creative.id)}
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all duration-300"
                            alt={creative.name} loading="lazy" decoding="async" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <div className="px-4 py-2 bg-[color-mix(in_srgb,var(--accent)_90%,transparent)] backdrop-blur-sm rounded-xl border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] text-white text-xs font-bold flex items-center gap-2">
                              <Pencil className="w-3.5 h-3.5" /> Open Editor
                            </div>
                          </div>
                          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-md border ${
                              creative.logo_position !== 'No Logo' ? 'bg-blue-500/15 text-blue-400 border-blue-500/20' : 'bg-zinc-800/80 text-zinc-400 border-white/5'
                            }`}>{creative.logo_position !== 'No Logo' ? 'Logo' : 'No Logo'}</span>
                            {creative.source === 'uploaded' && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-md border bg-amber-500/15 text-amber-400 border-amber-500/20">
                                Uploaded
                              </span>
                            )}
                          </div>
                          <div className="absolute top-3 right-3">
                            <TagPicker
                              creativeId={creative.id}
                              currentTags={creative.tags || []}
                              allTags={allTags}
                              onChange={(tags) => handleTagsChange(creative.id, tags)}
                              onTagCreated={(tag) => setAllTags(prev => [...prev, tag])}
                              triggerClassName="p-1.5 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 text-slate-300 hover:text-white transition-colors"
                            />
                          </div>
                        </div>
                        <div className="p-4 space-y-1">
                          <InlineRename
                            value={creative.name}
                            onSave={(name) => handleRenameCreative(creative.id, name)}
                            textClassName="text-sm font-bold text-white truncate"
                          />
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest italic truncate">{creative.campaign_name}</p>
                          {creative.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {creative.tags.map(tag => <TagBadge key={tag.id ?? tag.name} tag={tag} size="xs" />)}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {hasMoreToLoad && (
          <div ref={sentinelRef} className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
