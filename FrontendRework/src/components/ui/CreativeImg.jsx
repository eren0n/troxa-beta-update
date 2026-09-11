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
  // Always render an <img>, never swap to a <div> placeholder while loading.
  // That swap changes the element *type* at this JSX position, so React
  // unmounts/remounts a DOM node here on every load — harmless on its own,
  // but next to a Fabric.js canvas (CreativeEditorPane) it races Fabric's
  // own DOM surgery (wrapping the canvas in its own container as soon as
  // it initializes) and throws "insertBefore: node is not a child of this
  // node", which crashes the whole React tree with no error boundary to
  // catch it — the "opens then glitches to a black/white screen" the Edit
  // tab hit. Passing `undefined` (not '') for a missing url omits the src
  // attribute entirely, so there's no broken-image icon while it loads.
  return <img src={url || undefined} {...imgProps} />;
}
