import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, ImageIcon, Maximize2, X } from 'lucide-react';
import { GLASS_STYLE } from '../ui/GlassCard';
import { creativesApi } from '../../lib/api';
import { CreativeImg } from '../ui/CreativeImg';
import { getPortalRoot } from '../../lib/portalRoot';
import UploadCreativeButton from './UploadCreativeButton';

const PAGE_SIZE = 24;

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[10px] text-slate-600 shrink-0">{label}</span>
      <span className="text-[11px] text-slate-300 text-right break-words">{value}</span>
    </div>
  );
}

/**
 * Brand Kit → References.
 *
 * The material generations are built from: images uploaded here, plus any
 * generated creative someone promoted from the gallery. This is the same set
 * the Generate tab's reference grid offers, so what a person curates here is
 * exactly what they get to pick from later — previously that grid showed the
 * entire gallery and there was nowhere to curate at all.
 */
export default function ReferencesPanel({ isEditor }) {
  const [refs, setRefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await creativesApi.gallery({
        is_reference: 'true', media_type: 'Photo', page: 1, page_size: PAGE_SIZE,
      });
      setRefs(res?.results || res || []);
      setHasMore(!!res?.has_more);
      setPage(1);
    } catch (_) {
      setRefs([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // A page at a time rather than everything at once: each tile is its own
  // authenticated image fetch, and a workspace with a hundred references would
  // otherwise fire a hundred of them on open.
  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await creativesApi.gallery({
        is_reference: 'true', media_type: 'Photo', page: next, page_size: PAGE_SIZE,
      });
      setRefs(prev => [...prev, ...(res?.results || res || [])]);
      setHasMore(!!res?.has_more);
      setPage(next);
    } catch (_) {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => { load(); }, [load]);

  // Full screen, the way the gallery does it: Esc closes, arrows step through.
  useEffect(() => {
    if (lightboxIndex === null) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') setLightboxIndex(i => (i === null ? i : Math.min(i + 1, refs.length - 1)));
      if (e.key === 'ArrowLeft') setLightboxIndex(i => (i === null ? i : Math.max(i - 1, 0)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, refs.length]);

  const removeReference = async (id) => {
    setBusyId(id);
    try {
      await creativesApi.updateFeedback(id, { is_reference: false });
      setRefs(prev => prev.filter(r => r.id !== id));
      setLightboxIndex(null);
    } catch (_) {
      // leave the card in place; the list reloads on the next visit
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={GLASS_STYLE} className="rounded-2xl p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-black text-white">Reference Images</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            What generations are built from — uploads, plus creatives promoted from the gallery.
            These are the images the Generate tab offers as references.
          </p>
        </div>
        {isEditor && <UploadCreativeButton onUploaded={load} />}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-4/5 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : refs.length === 0 ? (
        <div className="py-14 text-center space-y-2">
          <ImageIcon className="w-7 h-7 text-slate-700 mx-auto" />
          <p className="text-xs text-slate-500">No reference images yet.</p>
          <p className="text-[11px] text-slate-600">
            Upload one here, or open the gallery and use “Make reference” on a creative.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <AnimatePresence>
            {refs.map((c) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                // the ratio belongs to the tile; the image fills it, so the
                // caption strip sits on the bottom edge rather than floating
                // over a taller box
                className="group relative aspect-4/5 rounded-xl overflow-hidden border border-white/6 bg-black"
              >
                <button onClick={() => setLightboxIndex(refs.indexOf(c))}
                  className="absolute inset-0 w-full h-full cursor-zoom-in" title="View fullscreen">
                  <CreativeImg creativeId={c.id} alt={c.name} loading="lazy" decoding="async"
                    className="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity" />
                  <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-xl border border-white/20 text-white text-[10px] font-bold flex items-center gap-1.5">
                      <Maximize2 className="w-3 h-3" /> Fullscreen
                    </span>
                  </span>
                </button>
                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-[10px] font-bold text-white truncate">{c.name}</p>
                  <span className="text-[9px] text-slate-400 uppercase tracking-widest">
                    {c.source === 'uploaded' ? 'Uploaded' : 'From gallery'}
                  </span>
                </div>
                {isEditor && (
                  <button
                    onClick={() => removeReference(c.id)}
                    disabled={busyId === c.id}
                    title="Remove from references"
                    className="absolute top-2 right-2 p-1 rounded-lg bg-black/60 border border-white/10 text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-40"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {hasMore && !loading && (
        <div className="pt-1 text-center">
          <button onClick={loadMore} disabled={loadingMore}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-slate-300 hover:text-white transition-all disabled:opacity-50">
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}

      {createPortal(
        <AnimatePresence>
          {lightboxIndex !== null && refs[lightboxIndex] && (() => {
            const current = refs[lightboxIndex];
            return (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setLightboxIndex(null)}
              className="fixed inset-0 z-[100] bg-black/92 backdrop-blur-sm flex"
            >
              <button onClick={() => setLightboxIndex(null)} title="Close"
                className="absolute top-5 right-[22rem] z-10 p-2 rounded-xl bg-white/10 border border-white/15 text-white hover:bg-white/20 transition-colors">
                <X className="w-4 h-4" />
              </button>

              {lightboxIndex > 0 && (
                <button onClick={(e) => { e.stopPropagation(); setLightboxIndex(i => i - 1); }} title="Previous"
                  className="absolute left-5 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-white/10 border border-white/15 text-white hover:bg-white/20 transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              {lightboxIndex < refs.length - 1 && (
                <button onClick={(e) => { e.stopPropagation(); setLightboxIndex(i => i + 1); }} title="Next"
                  className="absolute left-auto right-[22rem] top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-white/10 border border-white/15 text-white hover:bg-white/20 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}

              {/* Left — the image. The column itself stays click-through so the
                  space around the image closes the viewer, the way the gallery
                  behaves; only the image swallows the click. */}
              <div className="flex-1 flex items-center justify-center min-w-0 h-full relative">
                <CreativeImg creativeId={current.id} alt={current.name}
                  onClick={(e) => e.stopPropagation()}
                  className="max-h-[86vh] max-w-full object-contain rounded-xl" />
              </div>

              {/* Right — info bar, same shape as the gallery's */}
              <div onClick={(e) => e.stopPropagation()}
                className="w-80 shrink-0 h-full overflow-y-auto border-l border-white/10 bg-[#0b0e17]/95 p-5 space-y-5">
                <div>
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Reference</p>
                  <h3 className="text-sm font-black text-white break-words">{current.name}</h3>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {lightboxIndex + 1} of {refs.length}
                  </p>
                </div>

                <div className="space-y-2.5">
                  <Row label="Source" value={current.source === 'uploaded' ? 'Uploaded' : 'From gallery'} />
                  {current.campaign_name && <Row label="Campaign" value={current.campaign_name} />}
                  {current.aspect_ratio && <Row label="Format" value={current.aspect_ratio} />}
                  {current.media_type && <Row label="Type" value={current.media_type} />}
                  {(current.uploaded_by_name || current.created_by_name) && (
                    <Row label="Added by" value={current.uploaded_by_name || current.created_by_name} />
                  )}
                  {current.created_at && (
                    <Row label="Added" value={new Date(current.created_at).toLocaleDateString()} />
                  )}
                </div>

                {current.tags?.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {current.tags.map(t => (
                        <span key={t.id ?? t.name} className="text-[9px] px-1.5 py-0.5 rounded border"
                          style={{ color: t.color, borderColor: `${t.color}40`, background: `${t.color}15` }}>
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* What the model was told this image shows — the reason a
                    reference is useful, and otherwise invisible anywhere. */}
                {current.caption && (
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Caption</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{current.caption}</p>
                  </div>
                )}

                {isEditor && (
                  <button onClick={() => removeReference(current.id)} disabled={busyId === current.id}
                    className="w-full py-2 rounded-xl bg-white/5 hover:bg-red-500/15 border border-white/10 hover:border-red-500/30 text-[11px] font-bold text-slate-400 hover:text-red-400 transition-all disabled:opacity-50">
                    Remove from references
                  </button>
                )}
              </div>
            </motion.div>
            );
          })()}
        </AnimatePresence>,
        getPortalRoot()
      )}
    </div>
  );
}
