import { FastifyRedis } from '@fastify/redis';
import crypto from 'crypto';
import { normalizeTags } from './tag.service.js';
import { normalizeCaption } from './caption.service.js';
import { Photo } from '@/types/models.js';
import { PhotoPayload } from '@/models/photo.model.js';

export interface CachedPhoto {
    user_id: string;
    file_path: string;
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

    // cache key for captions/tags/combined captions+tags
    buildSearchKey(user_id: bigint, tags: string[], caption: string): string {
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

        return `user:${user_id}:search:${category}:${query_hash}`;
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
                file_path: data.file_path,
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
                    file_path: data.file_path,
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
        } else {
            console.log('NOTHING TO FETCH');
        }

        // get final array of photo metadata objects
        return Array.from(photoMap.values())
            .filter((v): v is PhotoPayload => v !== null);
    }

    /*async deletePhoto(photo_id: bigint, user_id: bigint) {
        await this.redis.del(this.buildPhotoKey(photo_id));
        await this.redis.srem(
            this.buildUserPhotosKey(user_id),
            photo_id.toString()
        );
    }
    */

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
        photo_ids: bigint[]
    ) {
        const key = this.buildSearchKey(user_id, tags, '');
        if (!key || photo_ids.length === 0) return;

        console.log('[ADD] tag search key:', key);

        const pipeline = this.redis.pipeline();

        // use array index to set ids in original order
        photo_ids.forEach((photo_id, index) => {
            pipeline.zadd(key, index, photo_id.toString());
        });
        pipeline.expire(key, this.defaultSearchTTL);
        
        await pipeline.exec();
    }

    /**============================================
     *         RETRIEVE TAG SEARCH RESULTS
     *=============================================**/
    async getCachedTagSearch(
        user_id: bigint,
        tags: string[],
        cursor_id?: bigint,
        limit = 20
    ): Promise<bigint[] | null> {
        const key = this.buildSearchKey(user_id, tags, '');
        if (!key) return null;

        const exists = await this.redis.exists(key);
        if (!exists) return null;

        console.log('[GET] tag search key:', key);

        if (cursor_id !== undefined) {
            // find cursor position
            const cursorScore = await this.redis.zscore(key, cursor_id.toString());
            
            // cursor not found: fallback to db
            if (cursorScore === null) return null;
            
            // get next <limit> items after cursor
            const results = await this.redis.zrangebyscore(
                key,
                cursorScore + 1, // minimum index
                '+inf', // max index
                'LIMIT', 0, limit // pagination limit
            );
            
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
        results: Array<{ photo_id: bigint; rank: number }>
    ) {
        const key = this.buildSearchKey(user_id, tags, caption);
        if (!key || results.length === 0) return;

        console.log('caption search key:', key);

        const pipeline = this.redis.pipeline();
        
        // sorted set with negative FTS rank as score -> keep results in descending order of score
        // sorted sets are in ascending order by default
        results.forEach(({ photo_id, rank }) => {
            const score = -rank + Number(photo_id) * 1e-12;
            pipeline.zadd(key, score, photo_id.toString());
        });
        
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
        cursor_rank?: number,
        cursor_id?: bigint,
        limit = 20
    ): Promise<bigint[] | null> {
        const key = this.buildSearchKey(user_id, tags, caption);
        if (!key) return null;

        const exists = await this.redis.exists(key);
        if (!exists) return null;

        if (cursor_rank !== undefined && cursor_id !== undefined) {
            // find cursor position to get next <limit> items
            const cursorScore = -cursor_rank + Number(cursor_id) * 1e-12;

            // get next <limit> items after the cursor
            const results = await this.redis.zrangebyscore(
                key,
                cursorScore + 1e-15, // after cursor
                '+inf',
                'LIMIT', 0, limit
            );

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
