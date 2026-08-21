import { registerWebModule, NativeModule } from 'expo';

// PhotoEmbeddingModule is not available on the web platform.
class PhotoEmbeddingModule extends NativeModule<{}> {}

export default registerWebModule(PhotoEmbeddingModule, 'PhotoEmbeddingModule');
