import { useEffect, useRef, useState } from 'react';
import { useCreativeImage } from '../../lib/creativeUrl';

/**
 * Drop-in <img> replacement for creative/logo images served by the
 * workspace-scoped proxy. Fetches with a normal Authorization header
 * (via useCreativeImage) instead of putting the access token in the URL —
 * needed because .map() callbacks can't call hooks directly, so any
 * <img src={creativeProxyUrl(id)}> inside a list has to go through a real
 * component like this one instead.
 *
 * Lazy by default: the actual authenticated fetch doesn't start until this
 * element scrolls near the viewport (IntersectionObserver, 200px lookahead),
 * not the moment it mounts. A gallery/grid page can mount dozens of these at
 * once — without this, every single one fired its blob fetch immediately on
 * mount regardless of visibility (a plain `loading="lazy"` on the <img> did
 * nothing here, since that only defers the browser's own network load for a
 * real `src` URL, and this component never has one until its own JS fetch
 * resolves — the fetch itself needed to be deferred, not the img element).
 * Pass `eager` for the one or two images per page that actually are the
 * primary, always-visible content (a hero/canvas background, an opened
 * item's preview) rather than an off-screen grid thumbnail — those should
 * still start loading the instant they mount.
 *
 * While waiting on either the visibility gate or the fetch itself, the
 * element shows the same shimmering gradient as CreativeGridSkeleton instead
 * of sitting there as a flat, static black box — the upstream fetch this
 * proxies (fal.media, Google Drive, ...) routinely takes a couple of
 * seconds, and a shimmer at least reads as "loading" instead of "broken".
 *
 * Props: `creativeId` (required), `logo` (optional, for the logo-applied
 * variant), `eager` (optional, skip the visibility gate), plus anything else
 * forwarded straight to the underlying <img> (className, alt, onLoad, ...).
 */
export function CreativeImg({ creativeId, logo, eager = false, className = '', style, ...imgProps }) {
  const imgRef = useRef(null);
  const [inView, setInView] = useState(eager);

  useEffect(() => {
    if (eager || inView) return;
    const el = imgRef.current;
    // No IntersectionObserver (very old browser, or a non-DOM test env) —
    // fail open to the previous eager behavior rather than never loading.
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return; }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [eager, inView]);

  const url = useCreativeImage(inView ? creativeId : null, { logo });
  const loading = !url;

  // Always render an <img>, never swap to a <div> placeholder while loading —
  // passing `undefined` (not '') for a missing url omits the src attribute
  // entirely, so there's no broken-image icon while it loads; the shimmer is
  // just the <img>'s own CSS background showing through until it does.
  return (
    <img
      ref={imgRef}
      src={url || undefined}
      className={`${className} ${loading ? 'animate-shimmer' : ''}`}
      style={{
        ...(loading ? {
          background: 'linear-gradient(90deg, var(--bg-hover) 25%, var(--border-default) 50%, var(--bg-hover) 75%)',
          backgroundSize: '200% 100%',
        } : null),
        ...style,
      }}
      {...imgProps}
    />
  );
}
