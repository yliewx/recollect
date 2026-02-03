import { Photo, Tag, PhotoTag, Caption } from "@/types/models.js";
import { Prisma, PrismaClient } from '@/generated/prisma/client.js';
import { paginateFindMany, buildCursorOptions } from "@/services/paginate.utils.js";

export type PhotoWithMetadata = Photo & {
    captions: Caption | null;
    photo_tags: (PhotoTag & { tags: Tag })[];
    tags?: Tag[];
};

export class PhotoModel {
    constructor(private prisma: PrismaClient) {}

    // single insert
    async upload(user_id: bigint, file_path: string): Promise<Photo> {
        return await this.prisma.photos.create({
            data: { user_id, file_path }
        });
    }

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
    async findAllFromUser(
        user_id: bigint,
        cursor?: bigint,
        take = 20
    ): Promise<{ photos: PhotoWithMetadata[], nextCursor: bigint | null }> {
        const photos = await paginateFindMany<PhotoWithMetadata>(this.prisma.photos, {
            ...buildCursorOptions(cursor),
            take,
            where: {
                user_id,
                deleted_at: null
            },
            include: {
                captions: true,
                photo_tags: {
                    include: {
                        tags: true,
                    },
                },
            },
            orderBy: [{ uploaded_at: 'desc' }, { id: 'desc' }],
        });

        // get next cursor: bookmark the last id in the result set
        const nextCursor = (photos.length > 0)
            ? photos[photos.length - 1].id
            : null;
        
        return { photos, nextCursor };
    }

    // get all active photos + photo metadata in an album
    async findAllFromAlbum(
        album_id: bigint,
        user_id: bigint,
        cursor?: bigint,
        take = 20
    ): Promise<{ photos: PhotoWithMetadata[], nextCursor: bigint | null }> {
        const photos = await paginateFindMany<PhotoWithMetadata>(this.prisma.photos, {
            ...buildCursorOptions(cursor),
            take,
            where: {
                user_id,
                deleted_at: null,
                album_photos: {
                    some: {
                        album_id,
                        albums: {
                            user_id,
                            deleted_at: null,
                        }
                    },
                },
            },
            include: {
                captions: true,
                photo_tags: {
                    include: {
                        tags: true,
                    },
                },
            },
            orderBy: [{ uploaded_at: 'desc' }, { id: 'desc' }],
        });

        // flatten nested tags
        const result = photos.map(p => ({
            ...p,
            tags: p.photo_tags.flatMap(pt => pt.tags),
        }));

        // get next cursor: bookmark the last id in the result set
        const nextCursor = (photos.length > 0)
            ? photos[photos.length - 1].id
            : null;
        
        return { photos: result, nextCursor };
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

        const photos = await paginateFindMany<PhotoWithMetadata>(this.prisma.photos, {
            ...buildCursorOptions(cursor),
            take,
            where: {
                user_id,
                deleted_at: null,
                ...this.filterByMatchType(tags, match),
                ...(album_id !== undefined ? { album_id } : {}),
            },
            include: {
                captions: true,
                photo_tags: {
                    include: {
                        tags: true,
                    },
                },
            },
            orderBy: [{ uploaded_at: 'desc' }, { id: 'desc' }],
        });

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
