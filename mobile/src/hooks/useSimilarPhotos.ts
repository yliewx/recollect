import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/client';
import { getSimilarPhotos } from '../api/photos';
import type { Photo } from '../api/types';

export type SimilarPhotosLoadState =
  | { status: 'loading' }
  | { status: 'loaded' }
  | { status: 'error'; message: string };

// visually similar photos for a given photo (GET /photos/:id/similar).
// no pagination: the backend already caps this to a small ranked list.
export function useSimilarPhotos(photoId: string) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadState, setLoadState] = useState<SimilarPhotosLoadState>({ status: 'loading' });

  const refresh = useCallback(async () => {
    setLoadState({ status: 'loading' });
    try {
      const { photos: result } = await getSimilarPhotos(photoId);
      setPhotos(result);
      setLoadState({ status: 'loaded' });
    } catch (err) {
      setLoadState({ status: 'error', message: getErrorMessage(err, 'Failed to load similar photos.') });
    }
  }, [photoId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { photos, loadState, refresh };
}
