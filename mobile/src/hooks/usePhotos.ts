import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/client';
import { getPhotos } from '../api/photos';
import type { Cursor, Photo } from '../api/types';

// backend's querySchema caps limit at 50 (backend/src/routes/schemas/photo.schema.ts)
const PAGE_SIZE = 50;

export type PhotosLoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded' }
  | { status: 'error'; message: string };

export type PhotoFilters = {
  caption?: string;
  tag?: string;
  match?: 'any' | 'all';
};

// backend-synced photo list (GET /photos), mirrors usePhotoLibrary's pagination shape
export function usePhotos(filters: PhotoFilters = {}) {
  const { caption, tag, match } = filters;
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadState, setLoadState] = useState<PhotosLoadState>({ status: 'idle' });
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const refresh = useCallback(async () => {
    setLoadState({ status: 'loading' });
    try {
      const { photos: page, nextCursor } = await getPhotos({ caption, tag, match, limit: PAGE_SIZE });
      setPhotos(page);
      setCursor(nextCursor);
      setHasNextPage(nextCursor !== null);
      setLoadState({ status: 'loaded' });
    } catch (err) {
      setLoadState({ status: 'error', message: getErrorMessage(err, 'Failed to load photos.') });
    }
  }, [caption, tag, match]);

  const fetchNextPage = useCallback(async () => {
    if (!hasNextPage || isFetchingMore || !cursor) return;
    setIsFetchingMore(true);
    try {
      const { photos: page, nextCursor } = await getPhotos({
        caption,
        tag,
        match,
        limit: PAGE_SIZE,
        cursor_id: cursor.id,
        cursor_rank: cursor.rank,
      });
      setPhotos((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const next = page.filter((p) => !seen.has(p.id));
        return [...prev, ...next];
      });
      setCursor(nextCursor);
      setHasNextPage(nextCursor !== null);
    } finally {
      setIsFetchingMore(false);
    }
  }, [cursor, hasNextPage, isFetchingMore, caption, tag, match]);

  // re-fetch (resetting pagination, since refresh overwrites rather than appends)
  // whenever the filters change. the screen's separate useFocusEffect(refresh)
  // additionally covers refetching on focus-regain (e.g. returning from a nested screen).
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    photos,
    loadState,
    hasNextPage,
    isFetchingMore,
    fetchNextPage,
    refresh,
  };
}
