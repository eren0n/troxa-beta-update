import { motion } from 'motion/react';
import { Maximize2, ImageMinus, Check } from 'lucide-react';
import { GLASS_STYLE } from '../ui/GlassCard';
import { CreativeImg } from '../ui/CreativeImg';
import TagBadge from './TagBadge';
import TagPicker from './TagPicker';
import InlineRename from './InlineRename';

// Brand Kit → References tile. Deliberately the Edit tab's lean card rather
// than the gallery's: a reference is something to build from, so rating,
// comments, Make Video and download are noise here. Image, what it is, name
// and tags; the full-screen viewer has everything else.
export default function ReferenceCard({
  creative, index, onOpen, onRename, allTags, onTagsChange, onTagCreated, onRemove,
  // Bulk-select mode: a click on the image toggles the card instead of
  // opening it, and the per-card actions step aside for the checkbox.
  selectMode = false, selected = false, onToggleSelect,
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.035 }}
      style={GLASS_STYLE}
      className={`group rounded-4xl overflow-hidden flex flex-col transition-all ${
        selected ? 'ring-2 ring-(--accent) border-(--accent)!' : 'hover:border-[color-mix(in_srgb,var(--accent)_20%,transparent)]'
      }`}>
      <div className="relative bg-black overflow-hidden aspect-4/5 w-full"
        onClick={selectMode ? () => onToggleSelect?.(creative) : onOpen}>
        <CreativeImg creativeId={creative.id}
          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all duration-300"
          alt={creative.name} loading="lazy" decoding="async" />

        {!selectMode && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="media-chip px-4! py-2! text-[11px]! tracking-wide! normal-case! rounded-xl! gap-2! opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Maximize2 className="w-3.5 h-3.5" /> View Fullscreen
          </div>
        </div>
        )}

        <div className="absolute top-3 left-3">
          <span className="media-chip" style={{ '--chip-tint': creative.source === 'uploaded' ? '#fbbf24' : '#60a5fa' }}>
            <span className="media-chip-dot" /> {creative.source === 'uploaded' ? 'Uploaded' : 'From gallery'}
          </span>
        </div>

        {selectMode ? (
          <div className={`absolute top-3 right-3 w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
            selected ? 'bg-(--accent) border-(--accent) shadow-lg' : 'bg-black/50 border-white/40 backdrop-blur-sm'
          }`}>
            {selected && <Check className="w-3.5 h-3.5 text-white stroke-3" />}
          </div>
        ) : (
        <div className="absolute top-3 right-3 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          <TagPicker
            creativeId={creative.id}
            currentTags={creative.tags || []}
            allTags={allTags}
            onChange={(tags) => onTagsChange(creative.id, tags)}
            onTagCreated={onTagCreated}
            triggerClassName="media-btn p-1.5 rounded-lg transition-colors"
          />
          {onRemove && (
            <button onClick={() => onRemove(creative)} title="Remove from references"
              className="media-btn p-1.5 rounded-lg transition-colors hover:text-red-300!">
              <ImageMinus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        )}
      </div>

      <div className="p-4 space-y-1">
        <InlineRename
          value={creative.name}
          onSave={(name) => onRename(creative.id, name)}
          textClassName="text-sm font-bold text-white truncate"
        />
        {creative.campaign_name && (
          <p className="text-[10px] text-gray-500 uppercase tracking-widest italic truncate">{creative.campaign_name}</p>
        )}
        {creative.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {creative.tags.map(tag => <TagBadge key={tag.id ?? tag.name} tag={tag} size="xs" />)}
          </div>
        )}
      </div>
    </motion.div>
  );
}
