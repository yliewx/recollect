import { NativeModule, requireNativeModule } from 'expo';

declare class PhotoEmbeddingModule extends NativeModule<{}> {
  // Given a PHAsset local identifier, extracts an on-device visual feature
  // print. Length varies by iOS version/device -- callers must not assume a
  // fixed size. Rejects if the asset can't be resolved (deleted, permissions
  // revoked) or Vision can't produce a feature print for it.
  extractEmbedding(assetId: string): Promise<number[]>;
}

export default requireNativeModule<PhotoEmbeddingModule>('PhotoEmbedding');
