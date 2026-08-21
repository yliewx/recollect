export interface PhotoData {
    asset_id: string;
    caption?: string;
    tags?: string[];
    // capture/file metadata; omitted when the client couldn't determine it.
    width?: number;
    height?: number;
    size_bytes?: number;
    // on-device Vision feature print (fixed length, see EMBEDDING_DIMENSION).
    // omitted when extraction failed or the client couldn't produce one --
    // such photos are simply excluded from similarity results.
    embedding?: number[];
}

export type InsertedPhotoData = PhotoData & { photo_id: bigint };
