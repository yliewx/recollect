import { PhotoModel } from "@/models/photo.model.ts";
import { CacheService } from "@/services/cache.service.ts";
import { CaptionService } from "@/services/caption.service.ts";
import { Cursor } from "@/services/paginate.utils.ts";
import { SearchService } from "@/services/search.service.ts";
import { TagService } from "@/services/tag.service.ts";

export interface Services {
    tagService: TagService,
    captionService: CaptionService,
    cacheService: CacheService,
    searchService: SearchService
}

export type SearchQuery = {
    tags: string[];
    caption: string;
    match: 'any' | 'all';
    cursor?: Cursor;
    limit: number;
    hasTagFilter: boolean;
    hasCaptionSearch: boolean;
    album_id?: bigint;
};

export type SearchResult<T> = {
    photos: T[];
    nextCursor: Cursor | null;
};
