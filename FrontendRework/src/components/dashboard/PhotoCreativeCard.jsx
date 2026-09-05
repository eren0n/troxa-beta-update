import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Download, Pencil, Maximize2, Star, StarHalf, Video, MessageSquare, X } from 'lucide-react';
import { GLASS_STYLE } from '../ui/GlassCard';
import { creativeProxyUrl } from '../../lib/creativeUrl';
import TagBadge from './TagBadge';
import TagPicker from './TagPicker';
import InlineRename from './InlineRename';

export default function PhotoCreativeCard({
  creative, view, index, onOpenLightbox,
  hoverStar, setHoverStar, onRate,
  onRename, allTags, onTagsChange, onTagCreated,
  onComment, onDelete,
}) {
  const navigate = useNavigate();
  const isHoveringRating = hoverStar[creative.id] !== undefined;
  const activeRating = hoverStar[creative.id] ?? creative.rating ?? 0;
  const ratingLabel = isHoveringRating ? `${hoverStar[creative.id]}/10` : creative.rating > 0 ? `${creative.rating}/10` : '-/10';

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
      // GLASS_STYLE.border is an inline style, which always beats the
      // `hover:border-*` Tailwind class below regardless of specificity —
      // drop it here so the border color is fully class-driven instead.
      style={{ ...GLASS_STYLE, border: undefined }}
      className={`group rounded-4xl overflow-hidden flex transition-all border border-(--glass-border) ${
        view === 'grid' ? 'flex-col hover:border-blue-500/20' : 'flex-row items-center gap-6 p-4 hover:border-blue-500/20 w-full'
      }`}>
      <div
        className={`relative bg-black overflow-hidden shrink-0 ${view === 'grid' ? 'aspect-4/5 w-full' : 'w-28 aspect-4/5 rounded-xl'}`}
        onClick={onOpenLightbox}
      >
        <img src={creativeProxyUrl(creative.id)}
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all duration-300"
          alt={creative.name} loading="lazy" decoding="async" />

        {/* Fullscreen hint — the only thing that appears on hover. The
            opacity transition has to live on the same element as the
            backdrop-blur, not a plain ancestor — browsers composite
            backdrop-filter as its own layer, so fading it in indirectly
            through a parent's opacity makes it snap in instead of
            fading smoothly. */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl border border-white/20 text-white text-xs font-bold flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Maximize2 className="w-3.5 h-3.5" /> View Fullscreen
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
      </div>

      {/* min-w-0 lets this column actually shrink below its content's
          natural width in list view (a flex row) — without it, a long
          unbroken name/campaign string forces the whole card, and the
          page, wider instead of truncating. */}
      <div className={`flex-1 min-w-0 p-5 space-y-3 ${view === 'list' ? 'py-0' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <InlineRename
              value={creative.name}
              onSave={(name) => onRename(creative.id, name)}
              textClassName="text-sm font-bold text-white truncate"
            />
            <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-widest italic truncate">{creative.campaign_name}</p>
            {creative.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {creative.tags.map(tag => <TagBadge key={tag.id ?? tag.name} tag={tag} size="xs" />)}
              </div>
            )}
            {creative.aspect_ratio && (
              <span className="inline-block mt-1 px-1.5 py-0.5 bg-white/5 border border-white/8 rounded text-[9px] font-black text-slate-400 uppercase tracking-wider">
                {creative.aspect_ratio}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <TagPicker
              creativeId={creative.id}
              currentTags={creative.tags || []}
              allTags={allTags}
              onChange={(tags) => onTagsChange(creative.id, tags)}
              onTagCreated={onTagCreated}
            />
            <button onClick={(e) => { e.stopPropagation(); onComment(creative); }}
              className="relative p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
              title="Comment">
              <MessageSquare className="w-3.5 h-3.5" />
              {creative.feedback_text && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-blue-500 rounded-full" />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(creative.id); }}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/15 text-slate-500 hover:text-red-400 transition-colors"
              title="Delete">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Rating — always visible, click to set */}
        <div
          className="flex items-center gap-1.5"
          onMouseLeave={() => setHoverStar(prev => { const n = {...prev}; delete n[creative.id]; return n; })}
        >
          <div className="flex items-center gap-0.5">
            {[1,2,3,4,5].map(s => {
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
                    onRate(creative.id, s * 2 - (isLeft ? 1 : 0));
                  }}
                  className="transition-transform hover:scale-125"
                >
                  {full
                    ? <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    : half
                    ? <StarHalf className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    : <Star className="w-3.5 h-3.5 text-slate-700" />}
                </button>
              );
            })}
          </div>
          <span className={`text-[10px] font-bold font-mono ${isHoveringRating ? 'text-amber-400' : 'text-slate-500'}`}>{ratingLabel}</span>
        </div>

        {/* Actions — always visible */}
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/dashboard/editor/${creative.id}`)}
            className="flex-1 py-1.5 bg-white/5 hover:bg-(--accent-hover) border border-white/10 hover:border-(--accent) rounded-lg text-[9px] font-bold uppercase tracking-widest text-gray-300 hover:text-white transition-all flex items-center justify-center gap-1.5">
            <Pencil className="w-3 h-3" /> Edit
          </button>
          <button onClick={() => navigate('/dashboard/make-video', { state: { presetCreative: creative } })}
            className="flex-1 py-1.5 bg-white/5 hover:bg-violet-600 border border-white/10 hover:border-violet-500 rounded-lg text-[9px] font-bold uppercase tracking-widest text-gray-300 hover:text-white transition-all flex items-center justify-center gap-1.5">
            <Video className="w-3 h-3" /> Make Video
          </button>
          <a href={creativeProxyUrl(creative.id)} download={`${creative.name || creative.id}.jpg`}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-all" title="Download">
            <Download className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </motion.div>
  );
}
