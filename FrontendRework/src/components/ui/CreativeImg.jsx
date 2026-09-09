import { useCreativeImage } from '../../lib/creativeUrl';

/**
 * Drop-in <img> replacement for creative/logo images served by the
 * workspace-scoped proxy. Fetches with a normal Authorization header
 * (via useCreativeImage) instead of putting the access token in the URL —
 * needed because .map() callbacks can't call hooks directly, so any
 * <img src={creativeProxyUrl(id)}> inside a list has to go through a real
 * component like this one instead.
 *
 * Props: `creativeId` (required), `logo` (optional, for the logo-applied
 * variant), plus anything else forwarded straight to the underlying <img>
 * (className, alt, loading, onLoad, ...).
 */
export function CreativeImg({ creativeId, logo, ...imgProps }) {
  const url = useCreativeImage(creativeId, { logo });
  if (!url) return <div className={imgProps.className} style={imgProps.style} />;
  return <img src={url} {...imgProps} />;
}
