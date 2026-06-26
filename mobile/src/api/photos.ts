import { apiRequest } from './client';
import type {
  GetPhotosParams,
  PhotoListResponse,
  RegisterPhotoItem,
  RegisterPhotosResponse,
  UpdateCaptionResponse,
  UpdateTagsRequest,
  UpdateTagsResponse,
} from './types';

export function getPhotos(params: GetPhotosParams = {}): Promise<PhotoListResponse> {
  return apiRequest<PhotoListResponse>('/photos', {
    query: {
      tag: params.tag,
      caption: params.caption,
      match: params.match,
      limit: params.limit,
      cursor_id: params.cursor_id,
      cursor_rank: params.cursor_rank,
    },
  });
}

export function registerPhotos(items: RegisterPhotoItem[]): Promise<RegisterPhotosResponse> {
  return apiRequest<RegisterPhotosResponse>('/photos', {
    method: 'POST',
    body: { items },
  });
}

export function updateCaption(photoId: string, caption: string): Promise<UpdateCaptionResponse> {
  return apiRequest<UpdateCaptionResponse>(`/photos/${photoId}/caption`, {
    method: 'PATCH',
    body: { caption },
  });
}

export function updateTags(photoId: string, body: UpdateTagsRequest): Promise<UpdateTagsResponse> {
  return apiRequest<UpdateTagsResponse>(`/photos/${photoId}/tags`, {
    method: 'PATCH',
    body,
  });
}
