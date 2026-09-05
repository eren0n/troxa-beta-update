import { GLASS_STYLE } from './GlassCard';

// Shimmering placeholder block — colors ride the theme's CSS vars so it
// adapts across dark/light/custom color modes automatically.
export function Skeleton({ className = '', style }) {
  return (
    <div
      className={`animate-shimmer ${className}`}
      style={{
        background: 'linear-gradient(90deg, var(--bg-hover) 25%, var(--border-default) 50%, var(--bg-hover) 75%)',
        backgroundSize: '200% 100%',
        ...style,
      }}
    />
  );
}

// Grid of skeleton cards matching the shape of the creative/video pickers
// across the dashboard — shown instead of a blocking spinner while the
// first page of data loads.
export function CreativeGridSkeleton({
  count = 8,
  columns = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  gap = 'gap-6',
  cardRounded = 'rounded-4xl',
  aspect = 'aspect-4/5',
  showMeta = true,
  glass = true,
}) {
  return (
    <div className={`grid ${columns} ${gap}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={glass ? GLASS_STYLE : undefined}
          className={`${cardRounded} overflow-hidden flex flex-col ${glass ? '' : 'bg-white/4'}`}>
          <Skeleton className={`${aspect} w-full`} />
          {showMeta && (
            <div className="p-4 space-y-2">
              <Skeleton className="h-3.5 w-3/4 rounded-md" />
              <Skeleton className="h-2.5 w-1/2 rounded-md" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
