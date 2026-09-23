import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Download, Grid, List, X, Image as ImageIcon, Sparkles, ChevronLeft, ChevronRight, Send, Loader2, ChevronDown, TrendingUp, MousePointerClick, DollarSign, Eye, Users, Hash, Trophy,
} from 'lucide-react';
import { useCreativeImage } from '../../lib/creativeUrl';
import { CreativeImg } from '../ui/CreativeImg';
import { getPortalRoot } from '../../lib/portalRoot';

/**
 * The full-screen creative viewer — image or clip on the left, everything the
 * creative knows about itself on the right.
 *
 * Lifted out of the gallery so Brand Kit's references open the same thing
 * rather than a lookalike. The gallery-only actions (Meta metrics, posting to
 * Slack, deleting, rating) arrive as props and each section is skipped when
 * its prop is absent, so a surface that has no business offering them simply
 * doesn't pass them.
 */
export default function CreativeLightbox({
  lightbox, setLightbox,
  mediaDims, setMediaDims,
  promptExpanded, setPromptExpanded,
  metaMetrics, openMetaModal, setSlackModal,
  handleDownload, downloadingUrl,
}) {
  const creative = lightbox?.items?.[lightbox.index]?.creative;
  // Authenticated blob fetch for the open item only, not for every item in
  // the set the moment the viewer opens.
  const imageUrl = useCreativeImage(creative?.id);

  useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowRight') {
        setLightbox(lb => (lb && lb.index < lb.items.length - 1 ? { ...lb, index: lb.index + 1 } : lb));
        setPromptExpanded?.(false); setMediaDims?.(null);
      }
      if (e.key === 'ArrowLeft') {
        setLightbox(lb => (lb && lb.index > 0 ? { ...lb, index: lb.index - 1 } : lb));
        setPromptExpanded?.(false); setMediaDims?.(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, setLightbox, setPromptExpanded, setMediaDims]);

  return (
    <>
      {createPortal(
        <AnimatePresence>
          {lightbox && (() => {
          const current = lightbox.items[lightbox.index];
          const c = current.creative;
          const isVideo = c?.media_type === 'Video';
          // The gallery proxy URL always resolves to the source photo — for
          // video creatives the actual rendered clip lives at c.video_url.
          const mediaUrl = isVideo ? c?.video_url : imageUrl;
          const hasPrev = lightbox.index > 0;
          const hasNext = lightbox.index < lightbox.items.length - 1;
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-9999 bg-black/95 flex"
              onClick={() => setLightbox(null)}
            >
              {/* Close */}
              <button onClick={() => setLightbox(null)}
                className="absolute top-4 right-4 p-2 rounded-full text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--bg-hover) transition-colors z-10">
                <X className="w-5 h-5" />
              </button>

              {/* Left — image + arrows */}
              <div className="flex-1 flex items-center justify-center relative min-w-0 px-16 pt-8 pb-24">
                <button
                  onClick={(e) => { e.stopPropagation(); setLightbox(lb => ({ ...lb, index: lb.index - 1 })); setPromptExpanded(false); setMediaDims(null); }}
                  className={`absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/8 hover:bg-white/16 text-white transition-all ${hasPrev ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <AnimatePresence mode="wait">
                  {isVideo ? (
                    mediaUrl ? (
                      <motion.video
                        key={mediaUrl}
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.14 }}
                        src={mediaUrl}
                        poster={imageUrl}
                        controls
                        autoPlay
                        onClick={(e) => e.stopPropagation()}
                        onLoadedMetadata={(e) => setMediaDims({ w: e.target.videoWidth, h: e.target.videoHeight })}
                        className="max-h-full max-w-full object-contain rounded-xl shadow-2xl"
                      />
                    ) : (
                      <motion.div
                        key="rendering"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center gap-3 text-white/60"
                      >
                        <div className="w-8 h-8 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-bold uppercase tracking-widest">
                          {c?.vjob_status === 'error' ? 'Render failed' : 'Rendering…'}
                        </span>
                      </motion.div>
                    )
                  ) : (
                    <motion.img
                      key={current.id}
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.14 }}
                      src={imageUrl}
                      alt={current.name}
                      onClick={(e) => e.stopPropagation()}
                      onLoad={(e) => setMediaDims({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
                      className="max-h-full max-w-full object-contain rounded-xl shadow-2xl"
                    />
                  )}
                </AnimatePresence>

                <button
                  onClick={(e) => { e.stopPropagation(); setLightbox(lb => ({ ...lb, index: lb.index + 1 })); setPromptExpanded(false); setMediaDims(null); }}
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
                className="w-72 shrink-0 backdrop-blur-xl border-l border-(--border-subtle) flex flex-col overflow-y-auto"
                style={{ background: 'var(--bg-panel)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-5 space-y-5 flex-1">
                  {/* Name */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[10px] font-black text-(--text-muted) uppercase tracking-widest">Creative</p>
                      {c?.tags?.some(t => t.name === 'Winner') && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          <Trophy className="w-2.5 h-2.5 fill-current" /> Winner
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-(--text-primary) leading-snug break-words">{current.name}</p>
                    {c?.campaign_name && <p className="text-[10px] text-(--text-secondary) mt-0.5 break-words">{c.campaign_name}</p>}
                  </div>

                  {/* Meta */}
                  {c && (
                    <div className="space-y-2.5">
                      {(c.generated_by_name || c.created_by_name) && (
                        <div>
                          <p className="text-[10px] font-black text-(--text-muted) uppercase tracking-widest mb-0.5">Generated by</p>
                          <p className="text-xs text-(--text-primary)">{c.generated_by_name || c.created_by_name}</p>
                        </div>
                      )}
                      {c.model_name && (
                        <div>
                          <p className="text-[10px] font-black text-(--text-muted) uppercase tracking-widest mb-0.5">Model</p>
                          <p className="text-xs text-(--text-primary)">{c.model_name}</p>
                        </div>
                      )}
                      {c.generation_mode && (
                        <div>
                          <p className="text-[10px] font-black text-(--text-muted) uppercase tracking-widest mb-0.5">Mode</p>
                          <p className={`text-xs font-bold ${
                            c.generation_mode === 'Auto' ? 'text-emerald-400' :
                            c.generation_mode === 'Prompt Studio' ? 'text-violet-400' :
                            'text-(--accent)'
                          }`}>
                            {c.generation_mode}
                          </p>
                        </div>
                      )}
                      {c.use_fingerprint && (
                        <div>
                          <p className="text-[10px] font-black text-(--text-muted) uppercase tracking-widest mb-0.5">Brand Fingerprint</p>
                          {c.blend_weight != null ? (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px]">
                                <span className="text-(--text-muted)">Refs</span>
                                <span className="text-violet-400 font-black">
                                  {c.blend_weight <= 20 ? 'Pure Refs' : c.blend_weight <= 45 ? 'Refs Dominant' : c.blend_weight <= 65 ? 'Balanced' : c.blend_weight <= 85 ? 'DNA Dominant' : 'Pure DNA'}
                                </span>
                                <span className="text-(--text-muted)">DNA</span>
                              </div>
                              <div className="w-full h-1 rounded-full bg-white/8 overflow-hidden">
                                <div className="h-full rounded-full bg-violet-500" style={{ width: `${c.blend_weight}%` }} />
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-violet-400 font-bold">Active</p>
                          )}
                        </div>
                      )}
                      {c.simplicity_weight != null && (
                        <div>
                          <p className="text-[10px] font-black text-(--text-muted) uppercase tracking-widest mb-0.5">Simplicity</p>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px]">
                              <span className="text-(--text-muted)">Rich</span>
                              <span className="text-sky-400 font-black">
                                {c.simplicity_weight <= 20 ? 'Rich & Detailed' : c.simplicity_weight <= 40 ? 'Simplified' : c.simplicity_weight <= 60 ? 'Balanced' : c.simplicity_weight <= 80 ? 'Minimal' : 'Ultra Minimal'}
                              </span>
                              <span className="text-(--text-muted)">Minimal</span>
                            </div>
                            <div className="w-full h-1 rounded-full bg-white/8 overflow-hidden">
                              <div className="h-full rounded-full bg-sky-500" style={{ width: `${c.simplicity_weight}%` }} />
                            </div>
                          </div>
                        </div>
                      )}
                      {c.aspect_ratio && (
                        <div>
                          <p className="text-[10px] font-black text-(--text-muted) uppercase tracking-widest mb-0.5">Format</p>
                          <p className="text-xs text-(--text-primary)">{c.aspect_ratio}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] font-black text-(--text-muted) uppercase tracking-widest mb-0.5">Resolution</p>
                        <p className="text-xs text-(--text-primary) font-mono">
                          {mediaDims ? `${mediaDims.w} × ${mediaDims.h} px` : '—'}
                        </p>
                      </div>
                      {c.style && (
                        <div>
                          <p className="text-[10px] font-black text-(--text-muted) uppercase tracking-widest mb-0.5">Style</p>
                          <p className="text-xs text-(--text-primary) capitalize">{c.style}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quality Score */}
                  {c.quality_score && (
                    <div>
                      <p className="text-[10px] font-black text-(--text-muted) uppercase tracking-widest mb-2">Quality Score</p>
                      {c.quality_score.status === 'pending' ? (
                        <div className="flex items-center gap-2 text-[11px] text-(--text-muted)">
                          <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin opacity-50" />
                          Evaluating…
                        </div>
                      ) : c.quality_score.status === 'error' ? (
                        <p className="text-[11px] text-red-400">Evaluation failed</p>
                      ) : (
                        <div className="space-y-3">
                          {/* Overall + verdict */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl font-black text-(--text-primary)">{c.quality_score.overall?.toFixed(1)}</span>
                              <span className="text-xs text-(--text-muted)">/5</span>
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                              c.quality_score.verdict === 'pass'   ? 'bg-emerald-500/15 text-emerald-400' :
                              c.quality_score.verdict === 'review' ? 'bg-amber-500/15 text-amber-400' :
                                                                      'bg-red-500/15 text-red-400'
                            }`}>
                              {c.quality_score.verdict === 'pass' ? '✓ Pass' : c.quality_score.verdict === 'review' ? '⚠ Review' : '✗ Fail'}
                            </span>
                          </div>
                          {/* Dimension bars */}
                          {[
                            { key: 'brand_alignment',    label: 'Brand Alignment' },
                            { key: 'ad_effectiveness',   label: 'Ad Effectiveness' },
                            { key: 'text_quality',       label: 'Text Quality' },
                            { key: 'production_quality', label: 'Production' },
                            { key: 'offer_accuracy',     label: 'Offer Accuracy' },
                          ].map(({ key, label }) => {
                            const val = c.quality_score[key];
                            if (val == null) return null;
                            const pct = (val / 5) * 100;
                            const color = val >= 4 ? 'bg-emerald-500' : val >= 3 ? 'bg-amber-500' : 'bg-red-500';
                            return (
                              <div key={key}>
                                <div className="flex justify-between text-[10px] mb-0.5">
                                  <span className="text-(--text-muted)">{label}</span>
                                  <span className="font-black text-(--text-secondary)">{val}/5</span>
                                </div>
                                <div className="w-full h-1 rounded-full bg-white/8 overflow-hidden">
                                  <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                          {/* Notes */}
                          {c.quality_score.notes && (
                            <p className="text-[10px] text-(--text-muted) leading-relaxed italic border-l-2 border-white/10 pl-2">
                              {c.quality_score.notes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Additional Prompt */}
                  {c?.extra_prompt && (
                    <div>
                      <p className="text-[10px] font-black text-(--text-muted) uppercase tracking-widest mb-1.5">Additional Prompt</p>
                      <p className={`text-[11px] text-(--text-secondary) leading-relaxed ${promptExpanded ? '' : 'line-clamp-3'}`}>
                        {c.extra_prompt}
                      </p>
                      {c.extra_prompt.length > 120 && (
                        <button
                          onClick={() => setPromptExpanded(v => !v)}
                          className="mt-1 text-[10px] font-black text-(--accent) hover:text-(--accent-hover) uppercase tracking-widest transition-colors"
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
                      <p className="text-[10px] font-black text-(--text-muted) uppercase tracking-widest mb-2">References</p>
                      <div className="flex flex-wrap gap-2">
                        {c.reference_thumbs.map((ref, ri) => (
                          <div key={ri} className="w-14 h-14 rounded-lg overflow-hidden bg-(--bg-hover) border border-(--border-subtle) shrink-0">
                            <CreativeImg creativeId={ref.id} alt={ref.name} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Date */}
                  {c?.created_at && (
                    <div>
                      <p className="text-[10px] font-black text-(--text-muted) uppercase tracking-widest mb-0.5">Created</p>
                      <p className="text-xs text-(--text-muted)">
                        {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )}

                </div>

                {/* Meta Metrics — gallery only; Brand Kit passes no metrics */}
                {metaMetrics && c?.meta_linked && (() => {
                  const m = metaMetrics[c.id];
                  return (
                    <div className="px-5 pb-4">
                      <div className="p-3 bg-[#1877F2]/8 border border-[#1877F2]/20 rounded-2xl space-y-3">
                        <p className="text-[10px] font-black text-[#1877F2]/80 uppercase tracking-widest">Meta Ads</p>
                        {m === 'loading' ? (
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Loader2 className="w-3 h-3 animate-spin" /> Fetching metrics…
                          </div>
                        ) : m?.metrics ? (
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { icon: Eye, label: 'Impressions', value: m.metrics.impressions?.toLocaleString() || '0' },
                              { icon: Users, label: 'Reach', value: m.metrics.reach?.toLocaleString() || '0' },
                              { icon: MousePointerClick, label: 'Clicks', value: m.metrics.clicks?.toLocaleString() || '0' },
                              { icon: TrendingUp, label: 'CTR', value: m.metrics.ctr ? `${parseFloat(m.metrics.ctr).toFixed(2)}%` : '0%' },
                              { icon: DollarSign, label: 'Spend', value: m.metrics.spend ? `$${parseFloat(m.metrics.spend).toFixed(2)}` : '$0' },
                              { icon: DollarSign, label: 'CPM', value: m.metrics.cpm ? `$${parseFloat(m.metrics.cpm).toFixed(2)}` : '$0' },
                            ].map(({ icon: Icon, label, value }) => (
                              <div key={label} className="bg-black/30 rounded-xl p-2.5">
                                <div className="flex items-center gap-1 mb-0.5">
                                  <Icon className="w-2.5 h-2.5 text-[#1877F2]/60" />
                                  <p className="text-[9px] text-gray-600 uppercase tracking-widest">{label}</p>
                                </div>
                                <p className="text-sm font-black text-white tabular-nums">{value}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-gray-600">No data yet — ad may be paused or new.</p>
                        )}
                        {m?.campaign && (
                          <p className="text-[10px] text-gray-600 truncate">
                            Campaign: <span className="text-gray-400">{m.campaign}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Download + Post to Meta */}
                <div className="p-4 border-t border-(--border-subtle) space-y-2">
                  {mediaUrl && (
                    <button
                      onClick={() => handleDownload(mediaUrl, `${current.name || 'creative'}${isVideo ? '.mp4' : '.jpg'}`)}
                      disabled={downloadingUrl === mediaUrl}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-(--bg-hover) hover:bg-(--bg-raised) border border-(--border-subtle) text-(--text-primary) text-xs font-bold rounded-xl transition-colors disabled:opacity-60"
                    >
                      {downloadingUrl === mediaUrl
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Download className="w-3.5 h-3.5" />}
                      {downloadingUrl === mediaUrl ? 'Downloading…' : 'Download'}
                    </button>
                  )}
                  {c && openMetaModal && (
                    <button
                      onClick={() => openMetaModal(c)}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl border transition-colors ${
                        c.meta_linked
                          ? 'bg-[#1877F2]/8 border-[#1877F2]/20 text-[#1877F2]/70'
                          : 'bg-[#1877F2]/10 hover:bg-[#1877F2]/20 border-[#1877F2]/20 text-[#1877F2]'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      {c.meta_linked ? 'Posted to Meta' : 'Post to Meta Ads'}
                    </button>
                  )}
                  {c && setSlackModal && (() => {
                    const slackPosted = (c.tags || []).some(t => t.name === 'Slack Posted');
                    return (
                      <button
                        onClick={() => !slackPosted && setSlackModal(c)}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl border transition-colors ${
                          slackPosted
                            ? 'bg-[#8B5CF6]/8 border-[#8B5CF6]/20 text-[#8B5CF6]/70 cursor-default'
                            : 'bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 border-[#8B5CF6]/20 text-[#8B5CF6]'
                        }`}
                      >
                        <Hash className="w-3.5 h-3.5" />
                        {slackPosted ? 'Posted to Slack' : 'Post to Slack'}
                      </button>
                    );
                  })()}
                </div>
              </div>
            </motion.div>
          );
        })()}
        </AnimatePresence>,
        getPortalRoot()
      )}
    </>
  );
}
