import { useCallback, useEffect, useState } from 'react';
import * as MediaLibrary from 'expo-media-library/legacy';

const PAGE_SIZE = 60;

export type PhotoLibraryPermission = 'undetermined' | 'granted' | 'limited' | 'denied';

export type PhotosLoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded' }
  | { status: 'error'; message: string };

function toPermission(response: MediaLibrary.PermissionResponse): PhotoLibraryPermission {
  if (response.status === 'granted') {
    return response.accessPrivileges === 'limited' ? 'limited' : 'granted';
  }
  if (response.status === 'denied') {
    return 'denied';
  }
  return 'undetermined';
}

export function usePhotoLibrary() {
  const [permission, setPermission] = useState<PhotoLibraryPermission>('undetermined');
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [loadState, setLoadState] = useState<PhotosLoadState>({ status: 'idle' });
  const [endCursor, setEndCursor] = useState<string | undefined>(undefined);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const loadFirstPage = useCallback(async () => {
    setLoadState({ status: 'loading' });
    try {
      const page = await MediaLibrary.getAssetsAsync({
        first: PAGE_SIZE,
        mediaType: MediaLibrary.MediaType.photo,
        sortBy: MediaLibrary.SortBy.creationTime,
      });
      setAssets(page.assets);
      setEndCursor(page.endCursor);
      setHasNextPage(page.hasNextPage);
      setLoadState({ status: 'loaded' });
    } catch (err) {
      setLoadState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Failed to load photos.',
      });
    }
  }, []);

  const fetchNextPage = useCallback(async () => {
    if (!hasNextPage || isFetchingMore) return;
    setIsFetchingMore(true);
    try {
      const page = await MediaLibrary.getAssetsAsync({
        first: PAGE_SIZE,
        after: endCursor,
        mediaType: MediaLibrary.MediaType.photo,
        sortBy: MediaLibrary.SortBy.creationTime,
      });
      setAssets((prev) => {
        const seen = new Set(prev.map((asset) => asset.id));
        const next = page.assets.filter((asset) => !seen.has(asset.id));
        return [...prev, ...next];
      });
      setEndCursor(page.endCursor);
      setHasNextPage(page.hasNextPage);
    } finally {
      setIsFetchingMore(false);
    }
  }, [endCursor, hasNextPage, isFetchingMore]);

  useEffect(() => {
    (async () => {
      const response = await MediaLibrary.getPermissionsAsync();
      setCanAskAgain(response.canAskAgain);
      const next = toPermission(response);
      setPermission(next);
      if (next === 'granted' || next === 'limited') {
        await loadFirstPage();
      }
    })();
  }, [loadFirstPage]);

  const requestPermission = useCallback(async () => {
    const response = await MediaLibrary.requestPermissionsAsync();
    setCanAskAgain(response.canAskAgain);
    const next = toPermission(response);
    setPermission(next);
    if (next === 'granted' || next === 'limited') {
      await loadFirstPage();
    }
    return next;
  }, [loadFirstPage]);

  const presentLimitedLibraryPicker = useCallback(async () => {
    await MediaLibrary.presentPermissionsPickerAsync();
    await loadFirstPage();
  }, [loadFirstPage]);

  return {
    permission,
    canAskAgain,
    assets,
    loadState,
    hasNextPage,
    isFetchingMore,
    requestPermission,
    fetchNextPage,
    refresh: loadFirstPage,
    presentLimitedLibraryPicker,
  };
}
