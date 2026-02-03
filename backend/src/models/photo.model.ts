import { Photo, Tag, PhotoTag, Caption } from "@/types/models.js";
import { Prisma, PrismaClient } from '@/generated/prisma/client.js';
import { paginateFindMany, buildCursorOptions } from "@/services/paginate.utils.js";

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

    // bulk inserts
    async uploadMany(
        user_id: bigint,
        file_paths: string[],
        tx?: Prisma.TransactionClient
    ): Promise<Photo[]> {
        const prisma = tx ?? this.prisma;
    
        await prisma.photos.createMany({
            data: file_paths.map(file_path => ({
                user_id,
                file_path,
            })),
        });

        return await prisma.photos.findMany({
            where: {
                user_id,
                file_path: { in: file_paths },
                deleted_at: null
            },
            orderBy: { uploaded_at: 'desc' },
        });
    }
    
    // get all active photos from specific user
    // optional: filter by album_id
    async findAllFromUser(
        user_id: bigint,
        cursor?: bigint,
        take = 20,
        album_id?: bigint
    ): Promise<{ photos: PhotoPayload[], nextCursor: bigint | null }> {
        const result = await paginateFindMany<PhotoWithMetadata>(this.prisma.photos, {
            ...buildCursorOptions(cursor),
            take,
            where: {
                user_id,
                deleted_at: null,
                ...(album_id !== undefined ? this.filterByAlbum(album_id, user_id) : {})
            },
            include: {
                captions: { select: { caption: true } }, // only caption text
                photo_tags: {
                    include: { tags: { select: { tag_name: true } } }, // only tag names
                },
            },
            orderBy: [{ uploaded_at: 'desc' }, { id: 'desc' }],
        });

        const photos: PhotoPayload[] = result.map(p => ({
            id: p.id,
            user_id: p.user_id,
            file_path: p.file_path,
            uploaded_at: p.uploaded_at,
            deleted_at: p.deleted_at,
            caption: p.captions?.caption ?? null,
            tags: p.photo_tags?.map(pt => pt.tags.tag_name) ?? [],
        }));

        // get next cursor: bookmark the last id in the result set
        const nextCursor = (photos.length > 0)
            ? photos[photos.length - 1].id
            : null;
        
        return { photos, nextCursor };
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
        cursor?: bigint,
        take = 20,
        album_id?: bigint
    ) {
        if (tags.length === 0) return [];

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
            orderBy: [{ uploaded_at: 'desc' }, { id: 'desc' }],
        });

        const photos: PhotoPayload[] = result.map(p => ({
            id: p.id,
            user_id: p.user_id,
            file_path: p.file_path,
            uploaded_at: p.uploaded_at,
            deleted_at: p.deleted_at,
            caption: p.captions?.caption ?? null,
            tags: p.photo_tags?.map(pt => pt.tags.tag_name) ?? [],
        }));

        // get next cursor: bookmark the last id in the result set
        const nextCursor = (photos.length > 0)
            ? photos[photos.length - 1].id
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
            file_path: p.file_path,
            uploaded_at: p.uploaded_at,
            deleted_at: p.deleted_at,
            caption: p.captions?.caption ?? null,
            tags: p.photo_tags?.map(pt => pt.tags.tag_name) ?? [],
        }));

        return photos;
    }
    
    // helper: return photos with matching photo_ids that are owned by the user
    async findOwnedByIds(photo_ids: bigint[], user_id: bigint): Promise<Photo[]> {
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

    // soft delete
    async delete(photo_id: bigint, user_id: bigint): Promise<Photo> {
        return await this.prisma.photos.update({
            where: {
                id: photo_id,
                user_id,
                deleted_at: null
            },
            data: { deleted_at: new Date() },
        });
    }

    // restore deleted photo
    async restore(photo_id: bigint, user_id: bigint): Promise<Photo> {
        return await this.prisma.photos.update({
            where: {
                id: photo_id,
                user_id,
                NOT: { deleted_at: null }
            },
            data: { deleted_at: null },
        });
    }
}
