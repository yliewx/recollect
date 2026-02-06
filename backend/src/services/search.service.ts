import chalk from 'chalk';
import { Cursor, buildCursor, nextCursorFromIds } from './paginate.utils.js';
import { CaptionService } from './caption.service.js';
import { CacheService } from './cache.service.js';
import { PhotoModel, PhotoPayload } from '@/models/photo.model.js';
import { SearchQuery, SearchResult } from '@/types/search.js';

export class SearchService {
    constructor(
        private readonly photoModel: PhotoModel,
        private readonly captionService: CaptionService,
        private readonly cache: CacheService
    ) {}

    /**
     * Parse + normalize query params into a stable SearchQuery object.
     * This is reusable across controllers.
     */
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

    // -------------------------
    // Internal implementations
    // -------------------------

    // get cached metadata from ids, fetch missing metadata + hydrate cache
    private async resolveIdsToPhotos(user_id: bigint, photoIds: bigint[]): Promise<PhotoPayload[]> {
        const photoMap = await this.cache.getCachedPhotos(photoIds);
        const result = await this.cache.fetchAndMergePhotos(
            photoMap,
            user_id,
            this.photoModel.findByIds.bind(this.photoModel)
        );
        return result;
    }

    // SEARCH PHOTOS: NO FILTER
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

    // SEARCH BY TAGS ONLY: NO CAPTIONS
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
        await this.cache.cacheTagSearch(user_id, tags, match, photos.map(p => p.id), nextCursor === null);
        await this.cache.cachePhotos(photos);

        return { photos, nextCursor };
    }

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

        const ids = rows.map((r) => r.photo_id);
        const photoPayload = await this.resolveIdsToPhotos(user_id, ids);

        await this.cache.cachePhotos(photoPayload);
        await this.cache.cacheCaptionSearch(user_id, tags, caption, match, rows, nextCursor === null);

        return { photos: photoPayload, nextCursor };
    }
}

// async findAllFromUser(request: FastifyRequest, reply: FastifyReply) {
//         const user_id = request.user.id;
//         const { tag, caption, match, limit, cursor_rank, cursor_id } = request.query as {
//             tag?: string;
//             caption?: string;
//             match: 'any' | 'all';
//             limit: number;
//             cursor_rank?: number;
//             cursor_id?: string;
//         };
//         // normalize tags and caption search
//         const tags = normalizeTags(
//             (tag ?? '').split(',').filter(Boolean)
//         );
//         if (tags.length > 0 && tags.length > 10) {
//             return reply.sendError('Exceeded max number of tag filters (10)');
//         }
//         const captions = normalizeCaption(caption ?? '');

//         // store whether tags and captions were present in query
//         const hasTagFilter = tags.length > 0;
//         const hasCaptionSearch = captions.length > 0;

//         const cursor = buildCursor(cursor_id, cursor_rank);
        
//         debugPrint({
//             tags,
//             captions,
//             match,
//             limit,
//             cursor
//         }, 'PhotoController.findAllFromUser');

//         try {
//             // 1. no filters: get all photos from user
//             if (!hasTagFilter && !hasCaptionSearch) {
//                 // get ids
//                 const { photoIds, nextCursor } = await this.photoModel.findAllFromUser(
//                     user_id,
//                     cursor,
//                     limit
//                 );
//                 if (photoIds.length === 0) {
//                     return reply.status(200).send({ photoIds, nextCursor, count: 0 });
//                 }

//                 // resolve ids -> cached metadata
//                 const photoMap = await this.cache.getCachedPhotos(photoIds);
//                 debugPrint(photoMap, '[PHOTO] got photoMap');

//                 // get final photos array (fetch any missing metadata + update cache as needed)
//                 const photos = await this.cache.fetchAndMergePhotos(photoMap, user_id, this.photoModel.findByIds.bind(this.photoModel));
                
//                 // return photos + next cursor to client
//                 return reply.status(200).send({ photos, nextCursor });
//             }
//             // 2. tags only
//             if (hasTagFilter && !hasCaptionSearch) {
//                 // check if search query exists in cache
//                 const photoIds = await this.cache.getCachedTagSearch(user_id, tags, cursor, limit);
//                 // cache hit: resolve ids -> cached metadata
//                 if (photoIds !== null) {
//                     console.log(chalk.green.bold('CACHE HIT - TAG SEARCH'), photoIds);

//                     const photoMap = await this.cache.getCachedPhotos(photoIds);
//                     const photos = await this.cache.fetchAndMergePhotos(photoMap, user_id, this.photoModel.findByIds.bind(this.photoModel));

//                     const nextCursor = (photoIds.length > 0)
//                         ? photoIds[photoIds.length - 1]
//                         : null;
//                     return reply.status(200).send({ photos, nextCursor });
//                 }

//                 console.log(chalk.red.bold('CACHE MISS - TAG SEARCH'));

//                 const { photos, nextCursor } = await this.photoModel.findByTags(
//                     tags,
//                     match,
//                     user_id,
//                     cursor,
//                     limit
//                 );
//                 await this.cache.cacheTagSearch(user_id, tags, photos.map(p => p.id), nextCursor === null);
//                 await this.cache.cachePhotos(photos);
//                 return reply.status(200).send({ photos, nextCursor });
//             }
//             // 3. captions only
//             if (hasCaptionSearch && !hasTagFilter) {
//                 // check if search query exists in cache
//                 let photoIds = await this.cache.getCachedCaptionSearch(user_id, [], captions, cursor, limit);
//                 // cache hit: resolve ids -> cached metadata
//                 if (photoIds !== null) {
//                     console.log(chalk.green.bold('CACHE HIT - CAPTION SEARCH'), photoIds);

//                     const photoMap = await this.cache.getCachedPhotos(photoIds);
//                     const photos = await this.cache.fetchAndMergePhotos(photoMap, user_id, this.photoModel.findByIds.bind(this.photoModel));

//                     const nextCursor = (photoIds.length > 0)
//                         ? photoIds[photoIds.length - 1]
//                         : null;
//                     return reply.status(200).send({ photos, nextCursor });
//                 }

//                 console.log(chalk.red.bold('CACHE MISS - CAPTION SEARCH'));

//                 const { photos, nextCursor } = await this.captionService.searchCaptions(
//                     captions,
//                     match,
//                     user_id,
//                     cursor,
//                     limit
//                 );
//                 // const photoPayload = await this.photoModel.findByIds(photos.map(p => p.photo_id), user_id);
                
//                 await this.cache.cacheCaptionSearch(
//                     user_id,
//                     [],
//                     captions,
//                     photos,
//                     nextCursor === null
//                 );
//                 const photoMap = await this.cache.getCachedPhotos(photos.map(p => p.photo_id));
//                 const photoPayload = await this.cache.fetchAndMergePhotos(photoMap, user_id, this.photoModel.findByIds.bind(this.photoModel));
//                 await this.cache.cachePhotos(photoPayload);
//                 // console.log('CAPTION SEARCH RESULTS:', photos);
//                 return reply.status(200).send({ photos: photoPayload, nextCursor });
//             }
//             // 4. tags + captions
//             // check if search query exists in cache
//             let photoIds = await this.cache.getCachedCaptionSearch(user_id, tags, captions, cursor, limit);
//             // cache hit: resolve ids -> cached metadata
//             if (photoIds !== null) {
//                 console.log(chalk.green.bold('CACHE HIT - CAPTION SEARCH'), photoIds);

//                 const photoMap = await this.cache.getCachedPhotos(photoIds);
//                 const photos = await this.cache.fetchAndMergePhotos(photoMap, user_id, this.photoModel.findByIds.bind(this.photoModel));

//                 const nextCursor = (photoIds.length > 0)
//                     ? photoIds[photoIds.length - 1]
//                     : null;
//                 return reply.status(200).send({ photos, nextCursor });
//             }

//             const { photos, nextCursor } = await this.captionService.searchCaptionsAndTags(
//                 captions,
//                 tags,
//                 match,
//                 user_id,
//                 cursor,
//                 limit
//             );
//             // console.log('CAPTION + TAG SEARCH RESULTS:', photos);
//             const photoMap = await this.cache.getCachedPhotos(photos.map(p => p.photo_id));
//             const photoPayload = await this.cache.fetchAndMergePhotos(photoMap, user_id, this.photoModel.findByIds.bind(this.photoModel));
//             await this.cache.cachePhotos(photoPayload);
//             // console.log('CAPTION SEARCH RESULTS:', photos);
//             // const photoPayload = await this.photoModel.findByIds(photos.map(p => p.photo_id), user_id);
//             await this.cache.cacheCaptionSearch(
//                 user_id,
//                 tags,
//                 captions,
//                 photos,
//                 nextCursor === null
//             );
//             return reply.status(200).send({ photos: photoPayload, nextCursor });
//         } catch (err) {
//             console.error('Error in PhotoController.findAllFromUser:', err);
//             return reply.sendError(err);
//         }
//     }