import * as MediaLibrary from 'expo-media-library/legacy';
import { File } from 'expo-file-system';

// resolves a local device asset_id to its file size in bytes, for sending as
// size_bytes at import time. Returns undefined (rather than 0) if the asset
// no longer exists in the device library or its size can't be read.
export async function getPhotoFileSize(assetId: string): Promise<number | undefined> {
  try {
    const info = await MediaLibrary.getAssetInfoAsync(assetId);
    const uri = info.localUri ?? info.uri;
    if (!uri) return undefined;

    const size = new File(uri).size;
    return size > 0 ? size : undefined;
  } catch {
    return undefined;
  }
}
