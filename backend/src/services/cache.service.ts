import { FastifyRedis } from '@fastify/redis';
import crypto from 'crypto';
import { normalizeTags } from './tag.service.js';
import { normalizeCaption } from './caption.service.js';
import { PhotoPayload } from '@/models/photo.model.js';
import chalk from 'chalk';
import { Cursor } from './paginate.utils.js';

export interface CachedPhoto {
    user_id: string;
    filename: string;
    caption: string | null;
    tags: string | null;
    uploaded_at: string;
}

export class CacheService {
    constructor(
        private redis: FastifyRedis,
        private defaultSearchTTL: number = 300, // 5min
        private defaultPhotoTTL: number = 43200 // 12h
    ) {}

    /**============================================
     *              CACHE KEY UTILS
     *=============================================**/
    private generateHashKey(query: string) {
        return crypto.createHash('sha256')
            .update(JSON.stringify(query))
            .digest('hex');
    }

    /**============================================
     *              CACHE KEY BUILDERS
     *=============================================**/
    // key for photos
    buildPhotoKey(photo_id: bigint): string {
        return `photo:${photo_id}`;
    }

    // meta key for checking search cache completeness
    buildSearchCompleteKey(searchKey: string): string {
        return `${searchKey}:complete`;
    }

    // cache key for captions/tags/combined captions+tags
    buildSearchKey(
        user_id: bigint,
        tags: string[],
        caption: string,
        match: 'any' | 'all'
    ): string {
        const hasTagFilter = tags.length > 0;
        const hasCaptionSearch = caption.length > 0;
        if (!hasTagFilter && !hasCaptionSearch) return '';

        const query: string[] = [];
        if (hasCaptionSearch) {
            query.push(`caption:${normalizeCaption(caption)}`);
        }
        if (hasTagFilter) {
            query.push(`tags:${normalizeTags(tags).sort().join(',')}`);
        }
        const query_hash = this.generateHashKey(query.join('|'));

        const category = (hasTagFilter && hasCaptionSearch)
            ? 'combined'
            : (hasTagFilter)
                ? 'tags'
                : 'caption';

        return `user:${user_id}:search:${category}:${query_hash}:${match}`;
    }

    /**========================================================================
     *                      PHOTO METADATA CACHE (HASH)
     *========================================================================**/
    // photos:{photo_id}
    async cachePhotos(photos: PhotoPayload[]) {
        if (photos.length === 0) return;

        // cache multiple photos in one pipeline
        const pipeline = this.redis.pipeline();
        const photoData = photos.map(p => ({ photo_id: p.id, data: p }))

        for (const { photo_id, data } of photoData) {
            const photoKey = this.buildPhotoKey(photo_id);
            
            // convert each field value to string
            pipeline.hset(photoKey, {
                user_id: data.user_id.toString(),
                filename: data.filename,
                caption: data.caption ?? '',
                tags: data.tags?.join(',') ?? '',
                uploaded_at: data.uploaded_at.toISOString(),
            });
            
            pipeline.expire(photoKey, this.defaultPhotoTTL);
        }

        // execute all commands in a single request
        const results = await pipeline.exec();
    }

    /**============================================
     *        RETRIEVE PHOTOS FROM CACHE
     *=============================================**/
    // resolve photo ids -> cached metadata
    async getCachedPhotos(photo_ids: bigint[]): Promise<Map<bigint, PhotoPayload | null>> {
        if (photo_ids.length === 0) return new Map();

        // fetch all hashes in one pipeline
        const pipeline = this.redis.pipeline();
        for (const id of photo_ids) {
            pipeline.hgetall(this.buildPhotoKey(id));
        }

        const results = await pipeline.exec();
        const photoMap = new Map<bigint, PhotoPayload | null>();

        // map photo_id -> metadata object
        results?.forEach((result, i) => {
            const [error, data] = result as [Error | null, Record<string, string> | null];

            if (!error && data && Object.keys(data).length > 0) {
                // convert field values back to bigint/date where applicable
                photoMap.set(photo_ids[i], {
                    id: photo_ids[i],
                    user_id: BigInt(data.user_id),
                    filename: data.filename,
                    caption: data.caption || null,
                    tags: data.tags ? data.tags.split(',').filter(Boolean) : [],
                    uploaded_at: new Date(data.uploaded_at),
                    deleted_at: null,
                });
            } else {
                photoMap.set(photo_ids[i], null);
            }
        });

        return photoMap;
    }

    // fetch any missing metadata and merge into complete array
    async fetchAndMergePhotos(
        photoMap: Map<bigint, PhotoPayload | null>,
        user_id: bigint,
        fetchDb: (ids: bigint[], user_id: bigint) => Promise<PhotoPayload[]>
    ): Promise<PhotoPayload[]> {
        // extract ids with null values
        const photosToFetch = Array.from(photoMap.entries())
            .filter(([_, value]) => value === null)
            .map(([key]) => key);
        
        // fetch missing metadata from db and update the map
        if (photosToFetch.length > 0) {
            console.log('fetching metadata for IDs:', photosToFetch);

            const fetchedPhotos = await fetchDb(photosToFetch, user_id);
            for (const photo of fetchedPhotos) {
                photoMap.set(photo.id, photo);
            }
            // update cache
            await this.cachePhotos(fetchedPhotos);
        }

        // get final array of photo metadata objects
        return Array.from(photoMap.values())
            .filter((v): v is PhotoPayload => v !== null);
    }

    /**============================================
     *         INVALIDATE PHOTO CACHE
     *=============================================**/
    // remove photos from cache on delete or tag/caption update
    async invalidatePhotos(photo_ids: bigint[]) {
        if (photo_ids.length === 0) return;

        const pipeline = this.redis.pipeline();

        for (const id of photo_ids) {
            pipeline.del(this.buildPhotoKey(id));
        }

        await pipeline.exec();

        console.log(chalk.red('invalidated cache for photos:', photo_ids));
    }

    /**========================================================================
     *                    SEARCH RESULTS CACHE (SORTED SETS)
     *========================================================================**/

    /**============================================
     *           TAG-ONLY SEARCH CACHE
     *=============================================**/
    // user:{user_id}:search:tags:{query_hash}
    // caches only photo ids for the query (no metadata)
    async cacheTagSearch(
        user_id: bigint,
        tags: string[],
        match: 'any' | 'all',
        photo_ids: bigint[],
        isComplete: boolean = false
    ) {
        const key = this.buildSearchKey(user_id, tags, '', match);
        if (!key) return;

        console.log('[ADD] tag search key:', key);

        const pipeline = this.redis.pipeline();

        // use array index to append ids in original order
        if (photo_ids.length > 0) {
            const offset = await this.redis.zcard(key);
            photo_ids.forEach((photo_id, index) => {
                pipeline.zadd(key, index + offset, photo_id.toString());
            });
            pipeline.expire(key, this.defaultSearchTTL);
        }

        // set cache completeness flag
        if (isComplete) {
            const completeKey = this.buildSearchCompleteKey(key);
            pipeline.set(completeKey, '1', 'EX',this.defaultSearchTTL);
            console.log(chalk.green.bold(`set ${key} as complete`));
        }
        
        await pipeline.exec();
    }

    /**============================================
     *         RETRIEVE TAG SEARCH RESULTS
     *=============================================**/
    async getCachedTagSearch(
        user_id: bigint,
        tags: string[],
        match: 'any' | 'all',
        cursor?: Cursor,
        limit = 20
    ): Promise<bigint[] | null> {
        const key = this.buildSearchKey(user_id, tags, '', match);
        if (!key) return null;

        const exists = await this.redis.exists(key);
        if (!exists) return null;

        const isComplete = await this.redis.exists(this.buildSearchCompleteKey(key));

        console.log('[GET] tag search key:', key);

        if (cursor !== undefined) {
            // find cursor position
            const cursorScore = await this.redis.zscore(key, cursor.id.toString());
            
            // cursor not found: fallback to db
            if (cursorScore === null) return null;
            const score = Number(cursorScore);
            
            // get next <limit> items after cursor
            const results = await this.redis.zrangebyscore(
                key,
                score + 1, // minimum index
                '+inf', // max index
                'LIMIT', 0, limit // pagination limit
            );

            // if cache is incomplete: fallback to db
            if (results.length < limit && !isComplete) {
                console.log(chalk.red.bold('tag cache incomplete. fallback to db'));
                return null;
            }

            return results.map(id => BigInt(id));
        }

        // first page: get <limit> items starting from 0
        const results = await this.redis.zrange(key, 0, limit - 1);
        return results.map(id => BigInt(id));
    }

    /**============================================
     *           CAPTION SEARCH CACHE
     *=============================================**/
    // user:{user_id}:search:caption:{query_hash} -> caption only
    // user:{user_id}:search:combined:{query_hash} -> tags+caption
    // caches only photo ids for the query (no metadata)
    async cacheCaptionSearch(
        user_id: bigint,
        tags: string[],
        caption: string,
        match: 'any' | 'all',
        results: Array<{ photo_id: bigint; rank: number }>,
        isComplete: boolean = false
    ) {
        const key = this.buildSearchKey(user_id, tags, caption, match);
        if (!key) return;

        console.log(chalk.cyan('[ADD] caption search key:', key));

        const pipeline = this.redis.pipeline();
        
        // set negative FTS rank as score -> keep results in descending order of score
        // sorted sets are in ascending order by default
        if (results.length > 0) {
            results.forEach(({ photo_id, rank }) => {
                const score = -rank + Number(photo_id) * 1e-12; // small tiebreaker
                pipeline.zadd(key, score, photo_id.toString());
            });
        }
        
        // set cache completeness flag
        if (isComplete) {
            const completeKey = this.buildSearchCompleteKey(key);
            pipeline.set(completeKey, '1', 'EX',this.defaultSearchTTL);
            console.log(chalk.green.bold(`set ${key} as complete`));
        }
        
        pipeline.expire(key, this.defaultSearchTTL);
        await pipeline.exec();
    }

    /**============================================
     *        RETRIEVE CAPTION SEARCH RESULTS
     *=============================================**/
    async getCachedCaptionSearch(
        user_id: bigint,
        tags: string[],
        caption: string,
        match: 'any' | 'all',
        cursor?: Cursor,
        limit = 20
    ): Promise<bigint[] | null> {
        const key = this.buildSearchKey(user_id, tags, caption, match);
        if (!key) return null;

        const exists = await this.redis.exists(key);
        if (!exists) return null;

        console.log(chalk.cyan('[GET] caption search key:', key));

        const isComplete = await this.redis.exists(this.buildSearchCompleteKey(key));
        
        const { id } = cursor ?? {};
        
        if (id !== undefined) {
            // find cursor position
            const cursorScore = await this.redis.zscore(key, id.toString());
            
            // cursor not found: fallback to db
            if (cursorScore === null) return null;
            const score = Number(cursorScore);

            // get next <limit> items after the cursor
            const results = await this.redis.zrangebyscore(
                key,
                score + 1e-12,
                // `(${cursorScore}`, // strictly greater than cursorScore
                '+inf',
                'LIMIT', 0, limit
            );

            // if cache is incomplete: fallback to db
            if (results.length < limit && !isComplete) {
                console.log(chalk.red.bold('caption cache incomplete. fallback to db'));
                return null;
            }

            return results.map(id => BigInt(id));
        }

        // first page: get <limit> items starting from 0
        const results = await this.redis.zrange(key, 0, limit - 1);
        return results.map(id => BigInt(id));
    }

    /**============================================
     *             PHOTO ID CACHE (SETS)
     *=============================================**/
    // get photo ids from cache
    async getCachedIds(key: string) {
        const cachedIds = await this.redis.smembers(key);
        if (!cachedIds || cachedIds.length === 0) {
            return [];
        }
        return cachedIds.map(id => BigInt(id));
    }

    // cache invalidation
    async del(key: string) {
        if (!key) return;
        await this.redis.del(key);
    }
}
