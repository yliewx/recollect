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
        private defaultTTL: number = 300
    ) {}

    private generateHashKey(query: string) {
        return crypto.createHash('sha256')
            .update(JSON.stringify(query))
            .digest('hex');
    }

    /**============================================
     *              CACHE KEY BUILDERS
     *=============================================**/
    // key for photos
    private buildPhotoKey(photo_id: bigint): string {
        return `photo:${photo_id}`;
    }

    // key for user photos
    private buildUserPhotosKey(user_id: bigint): string {
        return `user:${user_id}:photos`;
    }

    // key for album photos
    private buildAlbumPhotosKey(user_id: bigint, album_id: bigint): string {
        return `user:${user_id}:album:${album_id}:photos`;
    }

    // cache key for captions/tags/combined captions+tags
    private buildSearchKey(user_id: bigint, tags: string[], caption: string): string {
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

    /**============================================
     *               CONVERSION
     *=============================================**/
    // private toCachedPhoto(photo: Photo): CachedPhoto {
    //     return {
    //         user_id: photo.user_id.toString(),
    //         file_path: photo.file_path,
    //         caption: photo.caption ?? null,
    //         uploaded_at: photo.uploaded_at.toISOString(),
    //     };
    // }

    /**============================================
     *                 PHOTO CACHE
     *=============================================**/
    // set photo hash
    async cachePhoto(photo_id: bigint, photo: PhotoPayload) {
        const key = this.buildPhotoKey(photo_id);

        await this.redis.hset(key, {
            user_id: photo.user_id.toString(),
            file_path: photo.file_path,
            caption: photo.caption ?? '',
            tags: photo.tags.join(','),
            uploaded_at: photo.uploaded_at,
        });

        // set expiry
        await this.redis.expire(key, this.defaultTTL);

        // add to user's photo set
        await this.redis.sadd(
            this.buildUserPhotosKey(photo.user_id),
            photo_id.toString()
        );
    }

    // cache multiple photos in one pipeline
    async cachePhotos(photos: PhotoPayload[]) {
        if (photos.length === 0) return;

        const pipeline = this.redis.pipeline();
        const photoData = photos.map(p => ({ photo_id: p.id, data: p }))

        for (const { photo_id, data } of photoData) {
            const photoKey = this.buildPhotoKey(photo_id);
            const userPhotoKey = this.buildUserPhotosKey(data.user_id);
            
            pipeline.hset(photoKey, {
                user_id: data.user_id.toString(),
                file_path: data.file_path,
                caption: data.caption ?? '',
                tags: data.tags.join(','),
                uploaded_at: data.uploaded_at,
            });
            
            pipeline.expire(photoKey, this.defaultTTL);
            
            // add to user's photo set
            pipeline.sadd(
                userPhotoKey,
                photo_id.toString()
            );

            // check that photo hash is created
            pipeline.hgetall(photoKey);
            pipeline.smembers(userPhotoKey);
        }

        // execute all commands in a single request
        const results = await pipeline.exec();
        if (results) {
            // each photo has 5 commands: hset, expire, sadd, hgetall, smembers
            const commandsPerPhoto = 5;
            
            for (let i = 0; i < photoData.length; i++) {
                const offset = i * commandsPerPhoto;
                const { photo_id } = photoData[i];
                
                console.log(`\n--- Photo ${photo_id} ---`);
                console.log('HSET result:', results[offset]?.[1]);
                console.log('EXPIRE result:', results[offset + 1]?.[1]);
                console.log('SADD result:', results[offset + 2]?.[1]);
                console.log('HGETALL result:', results[offset + 3]?.[1]);
                console.log('SMEMBERS result:', results[offset + 4]?.[1]);
            }
        }
    }

    // get photo hash
    // async getPhoto(photo_id: bigint): Promise<CachedPhoto | null> {
    //     const key = this.buildPhotoKey(photo_id);
    //     const data = await this.redis.hgetall(key);

    //     if (!data || Object.keys(data).length === 0) {
    //         return null;
    //     }

    //     return {
    //         user_id: data.user_id,
    //         file_path: data.file_path,
    //         caption: data.caption || null,
    //         uploaded_at: data.uploaded_at,
    //     };
    // }

    /*async deletePhoto(photo_id: bigint, user_id: bigint) {
    await this.redis.del(this.buildPhotoKey(photo_id));
    await this.redis.srem(
        this.buildUserPhotosKey(user_id),
        photo_id.toString()
    );
}
 */

    // get from cache
    async get<T>(key: string): Promise<T | null> {
        if (!key) return null;
        const cached = await this.redis.get(key);
    
        return cached
            ? (JSON.parse(cached) as T)
            : null;
    }

    // set cache with optional TTL
    async set<T>(key: string, value: T, ttlSeconds?: number) {
        if (!key) return;
        await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds ?? this.defaultTTL);
    }

    // cache invalidation
    async del(key: string) {
        if (!key) return;
        await this.redis.del(key);
    }
}
