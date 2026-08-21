// mirrors backend PhotoPayload (backend/src/models/photo.model.ts)
export type Photo = {
  id: string;
  user_id: string;
  asset_id: string;
  uploaded_at: string;
  deleted_at: string | null;
  caption: string | null;
  tags: string[];
  width: number | null;
  height: number | null;
  size_bytes: number | null;
};

export type Cursor = {
  id: string;
  rank?: number;
};

// mirrors backend PhotoSortBy/SortOrder (backend/src/types/search.d.ts).
// 'dimensions' sorts by width then height (see PhotoModel.buildOrderBy).
export type PhotoSortBy = 'uploaded_at' | 'dimensions' | 'size_bytes';
export type SortOrder = 'asc' | 'desc';

export type GetPhotosParams = {
  tag?: string;
  caption?: string;
  match?: 'any' | 'all';
  limit?: number;
  cursor_id?: string;
  cursor_rank?: number;
  sort_by?: PhotoSortBy;
  order?: SortOrder;
};

export type PhotoListResponse = {
  photos: Photo[];
  nextCursor: Cursor | null;
};

export type RegisterPhotoItem = {
  asset_id: string;
  caption?: string;
  tags?: string[];
  // capture/file metadata; omitted when the client couldn't determine it.
  width?: number;
  height?: number;
  size_bytes?: number;
  // on-device visual feature print (see src/native/photoEmbedding.ts).
  // length varies by iOS version/device.
  embedding?: number[];
};

export type RegisterPhotosResponse = {
  photos: Photo[];
  count: number;
};

export type SimilarPhotosResponse = {
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

export type User = {
  id: string;
  username: string;
  email: string;
  created_at: string;
};

export type CreateUserResponse = {
  user: User;
};
