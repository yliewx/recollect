import { Photo, Tag, PhotoTag, Caption } from "@/types/models.js";
import { Prisma, PrismaClient } from '@/generated/prisma/client.js';
import { paginateFindMany, buildCursorOptions, Cursor } from "@/services/paginate.utils.js";
import { PhotoData } from "@/types/photo.js";
import { PhotoSortBy, SortOrder } from "@/types/search.js";

// raw result from prisma includes
export type PhotoWithMetadata = Photo & {
    captions: Caption | null;
    photo_tags: (PhotoTag & { tags: Tag })[];
    tags?: Tag[];
};

// flattened tags + captions for response payload
export type PhotoPayload = Photo & {
    caption: string | null;
    tags: string[];
};

export class PhotoModel {
    constructor(private prisma: PrismaClient) {}

    // 'dimensions' sorts by width then height since they're stored separately
    // id is always the final tiebreaker so cursor pagination stays stable across rows with equal sort values.
    private buildOrderBy(
        sortBy: PhotoSortBy,
        order: SortOrder
    ): Prisma.photosOrderByWithRelationInput[] {
        switch (sortBy) {
            case 'dimensions':
                return [{ width: order }, { height: order }, { id: order }];
            case 'size_bytes':
                return [{ size_bytes: order }, { id: order }];
            case 'uploaded_at':
            default:
                return [{ uploaded_at: order }, { id: order }];
        }
    }

    // bulk inserts
    async uploadMany(
        user_id: bigint,
        items: PhotoData[],
        tx?: Prisma.TransactionClient
    ): Promise<Photo[]> {
        const prisma = tx ?? this.prisma;
        const assetIds = items.map(item => item.asset_id);

        await prisma.photos.createMany({
            data: items.map(({ asset_id, width, height, size_bytes }) => ({
                user_id,
                asset_id,
                width,
                height,
                size_bytes,
            })),
            skipDuplicates: true,
        });

        return await prisma.photos.findMany({
            where: {
                user_id,
                asset_id: { in: assetIds },
                deleted_at: null
            },
            orderBy: { uploaded_at: 'desc' },
        });
    }

    // get all active photos from specific user
    // optional: filter by album_id only if specified
    // only return photo ids, no metadata (avoid extra joins)
    async findAllFromUser(
        user_id: bigint,
        cursor?: Cursor,
        take = 20,
        album_id?: bigint,
        sortBy: PhotoSortBy = 'uploaded_at',
        order: SortOrder = 'desc'
    ): Promise<{ photoIds: bigint[], nextCursor: Cursor | null }> {
        const result = await paginateFindMany<{ id: bigint }>(this.prisma.photos, {
            ...buildCursorOptions(cursor),
            take,
            where: {
                user_id,
                deleted_at: null,
                ...(album_id !== undefined ? this.filterByAlbum(album_id, user_id) : {})
            },
            select: { id: true },
            orderBy: this.buildOrderBy(sortBy, order),
        });

        const photoIds = result.map(p => p.id);

        // get next cursor: bookmark the last id in the result set
        const nextCursor = (photoIds.length > 0)
            ? { id: photoIds[photoIds.length - 1] }
            : null;
        
        return { photoIds, nextCursor };
    }
    
    // helper function for finding photos in album
    private filterByAlbum(album_id: bigint, user_id: bigint) {
        return {
            album_photos: {
                some: {
                    album_id,
                    albums: {
                        user_id,
                        deleted_at: null,
                    },
                },
            },
        };
    }

    // get every existing photo from the user that matches the tags, based on match type
    // optional: filter by album_id
    async findByTags(
        tags: string[],
        match: 'any' | 'all' = 'any',
        user_id: bigint,
        cursor?: Cursor,
        take = 20,
        album_id?: bigint,
        sortBy: PhotoSortBy = 'uploaded_at',
        order: SortOrder = 'desc'
    ): Promise<{ photos: PhotoPayload[], nextCursor: Cursor | null }> {
        if (tags.length === 0) {
            return {
                photos: [],
                nextCursor: cursor ?? null
            };
        }

        const result = await paginateFindMany<PhotoWithMetadata>(this.prisma.photos, {
            ...buildCursorOptions(cursor),
            take,
            where: {
                user_id,
                deleted_at: null,
                ...this.filterByMatchType(tags, match),
                ...(album_id !== undefined ? this.filterByAlbum(album_id, user_id) : {})
            },
            include: {
                captions: { select: { caption: true } }, // only caption text
                photo_tags: {
                    include: { tags: { select: { tag_name: true } } }, // only tag names
                },
            },
            orderBy: this.buildOrderBy(sortBy, order),
        });

        const photos: PhotoPayload[] = result.map(p => ({
            id: p.id,
            user_id: p.user_id,
            asset_id: p.asset_id,
            uploaded_at: p.uploaded_at,
            deleted_at: p.deleted_at,
            width: p.width,
            height: p.height,
            size_bytes: p.size_bytes,
            caption: p.captions?.caption ?? null,
            tags: p.photo_tags?.map(pt => pt.tags.tag_name) ?? [],
        }));

        // get next cursor: bookmark the last id in the result set
        const nextCursor = (photos.length > 0)
            ? { id: photos[photos.length - 1].id }
            : null;
        
        return { photos, nextCursor };
    }

    // helper function for setting tag filter strictness
    private filterByMatchType(tags: string[], match: 'any' | 'all') {
        if (tags.length === 0) return undefined;

        // return all photos that match ALL tags
        if (match === 'all') {
            return {
                AND: tags.map(tag => ({
                    photo_tags: {
                        some: {
                            tags: { tag_name: tag },
                        },
                    },
                })),
            };
        }
        // return all photos that match ANY of the tags
        return {
            photo_tags: {
                some: {
                    tags: { tag_name: { in: tags } },
                },
            },
        };
    }

    // get all tags on a photo
    async getTagsOnPhoto(photo_id: bigint) {
        return await this.prisma.photo_tags.findMany({
            where: {
                photo_id
            },
            select: {
                tags: {
                    select: {
                        id: true,
                        tag_name: true,
                    },
                },
            },
        });
    }

    // get photos + photo metadata with matching photo_ids
    async findByIds(
        photo_ids: bigint[],
        user_id: bigint,
        tx?: Prisma.TransactionClient
    ): Promise<PhotoPayload[]> {
        if (photo_ids.length === 0) return [];
        
        const prisma = tx ?? this.prisma;

        const result = await prisma.photos.findMany({
            where: {
                user_id,
                id: { in: photo_ids },
                deleted_at: null
            },
            orderBy: { uploaded_at: 'desc' },
            include: {
                captions: { select: { caption: true } },
                photo_tags: {
                    include: { tags: { select: { tag_name: true } } },
                },
            },
        });

        const photos: PhotoPayload[] = result.map(p => ({
            id: p.id,
            user_id: p.user_id,
            asset_id: p.asset_id,
            uploaded_at: p.uploaded_at,
            deleted_at: p.deleted_at,
            width: p.width,
            height: p.height,
            size_bytes: p.size_bytes,
            caption: p.captions?.caption ?? null,
            tags: p.photo_tags?.map(pt => pt.tags.tag_name) ?? [],
        }));

        return photos;
    }

    // helper: return photos with matching photo_ids that are owned by the user
    async findOwnedByIds(photo_ids: bigint[], user_id: bigint): Promise<Photo[]> {
        if (photo_ids.length === 0) return [];
        
        return await this.prisma.photos.findMany({
            where: {
                user_id,
                id: { in: photo_ids },
                deleted_at: null
            },
        });
    }
    
    // get user's deleted photos
    async findDeleted(user_id: bigint): Promise<Photo[]> {
        return await this.prisma.photos.findMany({
            where: {
                user_id,
                NOT: { deleted_at: null }
            },
            orderBy: { deleted_at: 'desc' },
        });
    }

    // soft delete: find existing photo and set deleted_at timestamp
    async delete(photo_id: bigint, user_id: bigint): Promise<Photo> {
        return await this.prisma.$transaction(async (tx) => {
            const photo = await tx.photos.findUnique({
                where: { id: photo_id },
            });

            if (!photo || photo.user_id !== user_id || photo.deleted_at !== null) {
                throw new Error('Photo not found or access denied');
            }

            return await tx.photos.update({
                where: { id: photo_id },
                data: { deleted_at: new Date() },
            });
        });
    }

    // restore deleted photo: set deleted_at to null
    async restore(photo_id: bigint, user_id: bigint): Promise<Photo> {
        return await this.prisma.$transaction(async (tx) => {
            const photo = await tx.photos.findUnique({
                where: { id: photo_id }
            });

            if (!photo || photo.user_id !== user_id || photo.deleted_at === null) {
                throw new Error('Photo not found or access denied');
            }

            return await tx.photos.update({
                where: { id: photo_id },
                data: { deleted_at: null },
            });
        });
    }
}
