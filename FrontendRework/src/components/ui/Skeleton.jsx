import { GLASS_STYLE } from './GlassCard';

// Shimmer fill shared by Skeleton and CreativeImg's loading state — colors
// ride the theme's CSS vars so it adapts across dark/light/custom color modes.
export const SHIMMER_STYLE = {
  backgroundImage: 'linear-gradient(90deg, var(--bg-hover) 25%, var(--border-default) 50%, var(--bg-hover) 75%)',
  backgroundSize: '200% 100%',
};

// Shimmering placeholder block.
export function Skeleton({ className = '', style }) {
  return <div className={`animate-shimmer ${className}`} style={{ ...SHIMMER_STYLE, ...style }} />;
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

// One placeholder shaped like a gallery Photo/VideoCreativeCard (grid or
// list view). Rendered as bare grid/list items so a page can drop them
// straight after its real cards while the next page loads.
export function CreativeCardSkeleton({ view = 'grid', simple = false }) {
  if (view === 'list') {
    return (
      <div style={GLASS_STYLE} className="rounded-4xl flex flex-row items-center gap-6 p-4 w-full">
        <Skeleton className="w-28 aspect-4/5 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2.5">
          <Skeleton className="h-3.5 w-2/5 rounded-md" />
          <Skeleton className="h-2.5 w-1/4 rounded-md" />
          <Skeleton className="h-2.5 w-1/3 rounded-md" />
        </div>
      </div>
    );
  }
  return (
    <div style={GLASS_STYLE} className="rounded-4xl overflow-hidden flex flex-col">
      <Skeleton className="aspect-4/5 w-full" />
      <div className={simple ? 'p-4 space-y-2' : 'p-5 space-y-3'}>
        <Skeleton className="h-3.5 w-3/4 rounded-md" />
        <Skeleton className="h-2.5 w-1/2 rounded-md" />
        {/* `simple` mirrors the lean Edit/References card: no rating row */}
        {!simple && (
          <div className="flex items-center gap-1.5 pt-1">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="w-3.5 h-3.5 rounded" />)}
          </div>
        )}
      </div>
    </div>
  );
}
