// mirrors backend PhotoPayload (backend/src/models/photo.model.ts)
export type Photo = {
  id: string;
  user_id: string;
  asset_id: string;
  uploaded_at: string;
  deleted_at: string | null;
  caption: string | null;
  tags: string[];
};

export type Cursor = {
  id: string;
  rank?: number;
};

export type GetPhotosParams = {
  tag?: string;
  caption?: string;
  match?: 'any' | 'all';
  limit?: number;
  cursor_id?: string;
  cursor_rank?: number;
};

export type PhotoListResponse = {
  photos: Photo[];
  nextCursor: Cursor | null;
};

export type RegisterPhotoItem = {
  asset_id: string;
  caption?: string;
  tags?: string[];
};

export type RegisterPhotosResponse = {
  photos: Photo[];
  count: number;
};

export type ApiError = {
  status?: number;
  message: string;
  details?: unknown;
};

export type UpdateCaptionResponse = {
  photo_id: string;
  caption: string;
};

export type UpdateTagsRequest = {
  tags_to_insert?: string[];
  tags_to_remove?: string[];
};

export type UpdateTagsResponse = {
  photo_id: string;
  tags: string[];
};
