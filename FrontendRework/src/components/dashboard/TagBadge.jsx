import { X } from 'lucide-react';

function hexToRgba(hex, alpha) {
  const clean = (hex || '#6366f1').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return `rgba(99,102,241,${alpha})`;
  const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function TagBadge({ tag, onRemove, size = 'sm' }) {
  const color = tag?.color || '#6366f1';
  const px = size === 'xs' ? 'px-1.5 py-0.5 text-[8px]' : 'px-2 py-0.5 text-[9px]';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-black uppercase tracking-wider border ${px}`}
      // The raw tag color is chosen once for every mode — amber or lime text
      // on a pale surface is ~2:1. Mixing toward the mode's --tag-ink keeps
      // the hue but brings it to readable contrast in each.
      style={{
        background: hexToRgba(color, 0.14),
        borderColor: hexToRgba(color, 0.4),
        color: `color-mix(in oklab, ${color} var(--tag-ink-mix, 100%), var(--tag-ink, ${color}))`,
      }}
    >
      {tag?.name}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(tag); }}
          className="hover:opacity-70 transition-opacity"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  );
}

export { hexToRgba };
