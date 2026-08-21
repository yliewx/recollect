import PhotoEmbeddingModule from '../../modules/photo-embedding/src/PhotoEmbeddingModule';

// Extracts an on-device visual feature print for a photo, for similarity search.
// Runs at import/registration time (write-time cost), never on browse.
// Returns undefined on failure (asset deleted, permissions revoked, Vision
// couldn't produce a feature print) -- callers should register the photo
// without an embedding rather than block the import.
export async function extractPhotoEmbedding(assetId: string): Promise<number[] | undefined> {
  try {
    return await PhotoEmbeddingModule.extractEmbedding(assetId);
  } catch (err) {
    console.warn('extractPhotoEmbedding failed for asset', assetId, err);
    return undefined;
  }
}
