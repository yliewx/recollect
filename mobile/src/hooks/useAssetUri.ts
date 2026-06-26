import { useEffect, useState } from 'react';
import * as MediaLibrary from 'expo-media-library/legacy';

// resolves a local device asset_id back to a displayable uri on this device.
// single-device prototype scope: if the asset no longer exists in the device
// library, this resolves to undefined (callers should render a placeholder).
export function useAssetUri(assetId: string): string | undefined {
  const [uri, setUri] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setUri(undefined);

    MediaLibrary.getAssetInfoAsync(assetId)
      .then((info) => {
        if (!cancelled) setUri(info.localUri ?? info.uri);
      })
      .catch(() => {
        if (!cancelled) setUri(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [assetId]);

  return uri;
}
