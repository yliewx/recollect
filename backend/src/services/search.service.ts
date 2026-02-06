import chalk from 'chalk';
import { Cursor, buildCursor, nextCursorFromIds } from './paginate.utils.js';
import { CaptionService } from './caption.service.js';
import { CacheService } from './cache.service.js';
import { PhotoModel, PhotoPayload } from '@/models/photo.model.js';
import { SearchQuery, SearchResult } from '@/types/search.js';
import { debugPrintNested } from '@/utils/debug.print.js';

export class SearchService {
    constructor(
        private readonly photoModel: PhotoModel,
        private readonly captionService: CaptionService,
        private readonly cache: CacheService
    ) {}

    /**============================================
     *           NORMALIZE QUERY PARAMS
     *=============================================**/
    buildSearchQuery(
        tags: string[],
        caption: string,
        match: 'any' | 'all',
        cursor?: Cursor,
        limit = 20,
        album_id?: bigint,
    ): SearchQuery {
        const hasTagFilter = tags.length > 0;
        const hasCaptionSearch = caption.length > 0;

        return {
            tags,
            caption,
            match,
            cursor,
            limit,
            hasTagFilter,
            hasCaptionSearch,
            album_id: album_id ?? undefined
        };
    }

    // check number of tags
    validateQuery(q: SearchQuery): void {
        if (q.tags.length > 10) {
            throw new Error('Exceeded max number of tag filters (10)');
        }
    }

    /**========================================================================
     *                           SEARCH FUNCTIONS
     *========================================================================**/

    // called from photo controller
    async searchPhotos(user_id: bigint, q: SearchQuery): Promise<SearchResult<any>> {
        this.validateQuery(q);

        // 1. no filters: get all photos from user
        if (!q.hasTagFilter && !q.hasCaptionSearch) {
            return this.searchAllPhotos(user_id, q.limit, q.cursor);
        }

        // 2. tags only
        if (q.hasTagFilter && !q.hasCaptionSearch) {
            return this.searchByTags(user_id, q.tags, q.match, q.limit, q.cursor, q.album_id);
        }

        // 3. captions only or captions + tags
        return this.searchByCaptionAndTags(user_id, q.caption, q.tags, q.match, q.limit, q.cursor);
    }

    // get cached metadata from ids, fetch missing metadata + hydrate cache
    async resolveIdsToPhotos(user_id: bigint, photoIds: bigint[]): Promise<PhotoPayload[]> {
        const photoMap = await this.cache.getCachedPhotos(photoIds);
        const result = await this.cache.fetchAndMergePhotos(
            photoMap,
            user_id,
            this.photoModel.findByIds.bind(this.photoModel)
        );
        return result;
    }

    /**============================================
     *          SEARCH PHOTOS: NO FILTER
     *=============================================**/
    private async searchAllPhotos(
        user_id: bigint,
        limit: number,
        cursor?: Cursor,
        album_id?: bigint
    ): Promise<SearchResult<any>> {
        // get ids
        const { photoIds, nextCursor } = await this.photoModel.findAllFromUser(
            user_id,
            cursor,
            limit,
            album_id
        );
        if (photoIds.length === 0) return { photos: [], nextCursor: null };
        // resolve ids -> cached metadata
        const photos = await this.resolveIdsToPhotos(user_id, photoIds);
        await this.cache.cachePhotos(photos);

        return { photos, nextCursor };
    }

    /**============================================
     *       SEARCH BY TAGS ONLY: NO CAPTIONS
     *=============================================**/
    private async searchByTags(
        user_id: bigint,
        tags: string[],
        match: 'any' | 'all',
        limit: number,
        cursor?: Cursor,
        album_id?: bigint
    ): Promise<SearchResult<any>> {
        // check if search query exists in cache
        const cachedIds = await this.cache.getCachedTagSearch(
            user_id,
            tags,
            match,
            cursor,
            limit
        );

        if (cachedIds !== null) {
            console.log(chalk.green.bold('CACHE HIT - TAG SEARCH'), cachedIds);
            const photos = await this.resolveIdsToPhotos(user_id, cachedIds);
            const nextCursor = nextCursorFromIds(cachedIds);
            return { photos, nextCursor };
        }

        console.log(chalk.red.bold('CACHE MISS - TAG SEARCH'));

        const { photos, nextCursor } = await this.photoModel.findByTags(
            tags,
            match,
            user_id,
            cursor,
            limit,
            album_id
        );
    
        if (photos.length > 0) {
            await this.cache.cacheTagSearch(user_id, tags, match, photos.map(p => p.id), nextCursor === null);
            await this.cache.cachePhotos(photos);
        }

        return { photos, nextCursor };
    }

    /**============================================
     *         SEARCH BY CAPTIONS (+TAGS)
     *=============================================**/
    private async searchByCaptionAndTags(
        user_id: bigint,
        caption: string,
        tags: string[],
        match: 'any' | 'all',
        limit: number,
        cursor?: Cursor
    ): Promise<SearchResult<any>> {
        const cachedIds = await this.cache.getCachedCaptionSearch(user_id, tags, caption, match, cursor, limit);

        if (cachedIds !== null) {
            console.log(chalk.green.bold('CACHE HIT - CAPTION+TAG SEARCH'), cachedIds);
            const photos = await this.resolveIdsToPhotos(user_id, cachedIds);
            return { photos, nextCursor: nextCursorFromIds(cachedIds) };
        }

        console.log(chalk.red.bold('CACHE MISS - CAPTION+TAG SEARCH'));

        const { photos: rows, nextCursor } =
            (tags.length > 0)
            ? await this.captionService.searchCaptionsAndTags(caption, tags, match, user_id, cursor, limit)
            : await this.captionService.searchCaptions(caption, match, user_id, cursor, limit);

        console.log('rows:', rows);
        console.log('nextCursor:', nextCursor);
        const ids = rows.map((r) => r.photo_id);
        const photoPayload = await this.resolveIdsToPhotos(user_id, ids);

        debugPrintNested(photoPayload, 'caption');
        if (photoPayload.length > 0) {
            await this.cache.cachePhotos(photoPayload);
            await this.cache.cacheCaptionSearch(user_id, tags, caption, match, rows, nextCursor === null);
        }

        return { photos: photoPayload, nextCursor };
    }
}
