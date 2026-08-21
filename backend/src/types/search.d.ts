import { PhotoModel } from "@/models/photo.model.ts";
import { CacheService } from "@/services/cache.service.ts";
import { CaptionService } from "@/services/caption.service.ts";
import { Cursor } from "@/services/paginate.utils.ts";
import { SearchService } from "@/services/search.service.ts";
import { TagService } from "@/services/tag.service.ts";
import { EmbeddingService } from "@/services/embedding.service.ts";

export interface Services {
    tagService: TagService,
    captionService: CaptionService,
    cacheService: CacheService,
    searchService: SearchService,
    embeddingService: EmbeddingService
}

// whitelisted sort vocabulary -- these are the only values ever allowed to
// reach an ORDER BY clause. See PhotoModel.buildOrderBy.
export type PhotoSortBy = 'uploaded_at' | 'dimensions' | 'size_bytes';
export type SortOrder = 'asc' | 'desc';

export type SearchQuery = {
    tags: string[];
    caption: string;
    match: 'any' | 'all';
    cursor?: Cursor;
    limit: number;
    hasTagFilter: boolean;
    hasCaptionSearch: boolean;
    album_id?: bigint;
    // ignored once a caption search is active -- FTS relevance ranking wins there
    sortBy: PhotoSortBy;
    order: SortOrder;
};

export type SearchResult<T> = {
    photos: T[];
    nextCursor: Cursor | null;
};
