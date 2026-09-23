import { useState, useEffect, useRef, useCallback } from 'react';
import { creativesApi } from './api';
import { buildGalleryParams } from './creativeFilters';

// Shared server-paginated fetching for the creatives gallery — used by every
// page that lists/pickers creatives (gallery, edit, make-video) so infinite
// scroll, filtering, and sorting all hit the backend instead of loading
// everything up front and slicing client-side.
// How long to leave the gallery alone after a refresh before another
// window-focus is allowed to trigger one.
const REFRESH_THROTTLE_MS = 10_000;

export function useCreativeGallery(filters, allTags, { pageSize = 12 } = {}) {
  const [creatives, setCreatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const pageRef = useRef(1);
  const fetchIdRef = useRef(0);

  // Expose a stable refresh function — callers can trigger a full page-1 refetch
  // (e.g. when a pending generation job finishes and real creatives are ready).
  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const normalize = (list) => list.map(c => ({ ...c, thumbnail: c.thumbnail || c.image_url }));
  const unpack = (res) => Array.isArray(res) ? { list: res, hasMore: false } : { list: res?.results || [], hasMore: !!res?.has_more };

  useEffect(() => {
    const fetchId = ++fetchIdRef.current;
    pageRef.current = 1;
    setLoading(true);
    creativesApi.gallery({ ...buildGalleryParams(filters, allTags), page: 1, page_size: pageSize })
      .then((res) => {
        if (fetchId !== fetchIdRef.current) return;
        const { list, hasMore: more } = unpack(res);
        setCreatives(normalize(list));
        setHasMore(more);
      })
      .catch(() => { if (fetchId === fetchIdRef.current) { setCreatives([]); setHasMore(false); } })
      .finally(() => { if (fetchId === fetchIdRef.current) setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, allTags, pageSize, refreshKey]);

  // Someone else's rating, rename or tag change never reached a screen that
  // already had the gallery open: it is fetched on mount and then only again
  // when the filters change. Coming back to the tab re-reads the pages already
  // loaded and swaps in what the server now says — which is the moment anyone
  // would notice a colleague's rating. Throttled, because switching windows is
  // something people do constantly.
  const syncLoaded = useCallback(() => {
    const pages = pageRef.current;
    const fetchId = fetchIdRef.current;
    Promise.all(
      Array.from({ length: pages }, (_, i) => creativesApi.gallery({
        ...buildGalleryParams(filters, allTags), page: i + 1, page_size: pageSize,
      }))
    ).then((results) => {
      if (fetchId !== fetchIdRef.current) return;   // filters moved on; that fetch wins
      const merged = results.flatMap(r => unpack(r).list);
      setCreatives(normalize(merged));
      setHasMore(unpack(results[results.length - 1]).hasMore);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, allTags, pageSize]);

  const syncRef = useRef(syncLoaded);
  useEffect(() => { syncRef.current = syncLoaded; }, [syncLoaded]);

  useEffect(() => {
    let last = Date.now();
    const onWake = () => {
      if (document.visibilityState === 'hidden') return;
      if (Date.now() - last < REFRESH_THROTTLE_MS) return;
      last = Date.now();
      syncRef.current();
    };
    window.addEventListener('focus', onWake);
    document.addEventListener('visibilitychange', onWake);
    return () => {
      window.removeEventListener('focus', onWake);
      document.removeEventListener('visibilitychange', onWake);
    };
  }, []);

  const loadMore = useCallback(() => {
    if (loadingMore || loading || !hasMore) return;
    const fetchId = fetchIdRef.current;
    const nextPage = pageRef.current + 1;
    setLoadingMore(true);
    creativesApi.gallery({ ...buildGalleryParams(filters, allTags), page: nextPage, page_size: pageSize })
      .then((res) => {
        if (fetchId !== fetchIdRef.current) return;
        const { list, hasMore: more } = unpack(res);
        pageRef.current = nextPage;
        setCreatives(prev => [...prev, ...normalize(list)]);
        setHasMore(more);
      })
      .catch(() => {})
      .finally(() => { if (fetchId === fetchIdRef.current) setLoadingMore(false); });
  }, [filters, allTags, pageSize, hasMore, loading, loadingMore]);

  // The IntersectionObserver is created once (on mount of the sentinel node);
  // this ref keeps its callback pointed at the latest `loadMore` closure.
  const loadMoreRef = useRef(loadMore);
  useEffect(() => { loadMoreRef.current = loadMore; }, [loadMore]);

  const observerRef = useRef(null);
  const sentinelRef = useCallback((node) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (node) {
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) loadMoreRef.current();
      }, { rootMargin: '600px' });
      observerRef.current.observe(node);
    }
  }, []);

  return { creatives, setCreatives, loading, loadingMore, hasMore, sentinelRef, refresh };
}
