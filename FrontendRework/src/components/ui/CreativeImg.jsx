import { useEffect, useRef, useState } from 'react';
import { useCreativeImage } from '../../lib/creativeUrl';
import { SHIMMER_STYLE } from './Skeleton';

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
 * While waiting on the visibility gate, the fetch, AND the browser decoding
 * the blob, the element shows the same shimmering gradient as
 * CreativeGridSkeleton instead of a flat box — the upstream fetch this
 * proxies (fal.media, Google Drive, ...) routinely takes a couple of
 * seconds, and a shimmer at least reads as "loading" instead of "broken".
 * It stays up until the image has actually loaded, not just its blob URL.
 *
 * Props: `creativeId` (required), `logo` (optional, for the logo-applied
 * variant), `eager` (optional, skip the visibility gate), plus anything else
 * forwarded straight to the underlying <img> (className, alt, onLoad, ...).
 */
const BLANK_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export function CreativeImg({ creativeId, logo, eager = false, className = '', style, onLoad, onError, ...imgProps }) {
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
  // A blob URL arriving isn't the image being on screen — decoding a large
  // creative takes a visible moment, so hold the shimmer until onLoad.
  const [loadedUrl, setLoadedUrl] = useState(null);
  const loading = !url || loadedUrl !== url;

  // Always render an <img>, never swap to a <div> placeholder while loading.
  // A sized <img> with NO src still gets the browser's broken-image icon in
  // its corner (plus its alt text), so until the blob arrives it points at a
  // 1x1 transparent GIF instead — a valid, empty image the shimmer (the
  // <img>'s own CSS background) shows through.
  return (
    <img
      ref={imgRef}
      src={url || BLANK_GIF}
      className={`${className} ${loading ? 'animate-shimmer' : ''}`}
      style={{
        // Opaque base under the shimmer: cards sit the img on bg-black,
        // which would swallow the light themes' translucent shimmer.
        ...(loading ? { ...SHIMMER_STYLE, backgroundColor: 'var(--bg-card)' } : null),
        // An <img> with no src still paints its alt text over the shimmer.
        color: loading ? 'transparent' : undefined,
        ...style,
      }}
      // the placeholder GIF loads too — only the real image counts
      onLoad={(e) => { if (!url) return; setLoadedUrl(url); onLoad?.(e); }}
      onError={(e) => { if (!url) return; setLoadedUrl(url); onError?.(e); }}
      {...imgProps}
    />
  );
}
