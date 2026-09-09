import { useState, useEffect } from 'react';
import { fetchCreativeImageBlob } from './api';

// In-memory, ref-counted cache of object URLs for creative images. Several
// components can render the same creative id at once (a grid card + the
// lightbox, a gallery re-render, ...) — they share one fetch/blob here and
// the object URL is only revoked once nothing is still using it.
const cache = new Map(); // key -> { url, refCount, promise }

function keyFor(id, logo) {
  return logo ? `${id}::logo` : String(id);
}

function acquire(id, logo) {
  const key = keyFor(id, logo);
  let entry = cache.get(key);
  if (entry) {
    entry.refCount++;
    return entry.promise;
  }
  entry = { url: null, refCount: 1, promise: null };
  cache.set(key, entry);
  entry.promise = fetchCreativeImageBlob(id, { logo })
    .then((blob) => {
      entry.url = URL.createObjectURL(blob);
      return entry.url;
    })
    .catch((err) => {
      cache.delete(key);
      throw err;
    });
  return entry.promise;
}

function release(id, logo) {
  const key = keyFor(id, logo);
  const entry = cache.get(key);
  if (!entry) return;
  entry.refCount--;
  if (entry.refCount <= 0) {
    cache.delete(key);
    entry.promise.then((url) => { if (url) URL.revokeObjectURL(url); }).catch(() => {});
  }
}

/**
 * React hook: returns an authenticated `blob:` URL for a creative's image,
 * or null while it's loading / when `id` is falsy.
 *
 * Replaces the old `creativeProxyUrl()` string-builder, which put the raw
 * access token in the URL as `?token=...` — that leaked into nginx access
 * logs, browser history, and any Referer header. The token now only ever
 * travels as a normal `Authorization` header, exactly like every other API
 * call the app makes.
 */
export function useCreativeImage(id, { logo = false } = {}) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!id) { setUrl(null); return; }
    let cancelled = false;
    acquire(id, logo).then((u) => { if (!cancelled) setUrl(u); }).catch(() => {});
    return () => {
      cancelled = true;
      release(id, logo);
    };
  }, [id, logo]);

  return url;
}

/**
 * Imperative one-off fetch for non-<img> consumers that need a real object
 * URL string rather than a hook — Fabric.js canvas loads, "download" links.
 * Not cached: the caller owns the URL and should call
 * `URL.revokeObjectURL(url)` once done with it.
 */
export async function loadCreativeImageUrl(id, opts) {
  const blob = await fetchCreativeImageBlob(id, opts);
  return URL.createObjectURL(blob);
}

/**
 * Downloads a creative image as a file. A plain `<a href={proxyUrl} download>`
 * can't carry an Authorization header, so this fetches the blob first (with
 * the normal auth header) and clicks a throwaway <a> pointed at the
 * resulting object URL instead.
 */
export async function downloadCreativeImage(id, filename, opts) {
  const blob = await fetchCreativeImageBlob(id, opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
