import { Album } from "@/types/models.js";
import { PrismaClient } from '@/generated/prisma/client.js';

export class AlbumModel {
    constructor(private prisma: PrismaClient) {}

    async create(user_id: bigint, title: string): Promise<Album> {
        return await this.prisma.albums.create({
            data: { user_id, title }
        });
    }

    // insert photos into album (album_photos relationship)
    async addPhotos(album_id: bigint, photo_ids: bigint[]) {
        if (photo_ids.length === 0) return { count: 0 };
        
        return await this.prisma.album_photos.createMany({
            data: photo_ids.map(photo_id => ({
                album_id,
                photo_id
            })),
            skipDuplicates: true,
        })
    }

    // find album by album id and user id
    async findById(album_id: bigint, user_id: bigint): Promise<Album | null> {
        const album = await this.prisma.albums.findUnique({
            where: { id: album_id }
        });

        if (!album || album.user_id !== user_id || album.deleted_at !== null) {
            return null;
        }

        return album;
    }
    
    // get all active albums from specific user
    // include photo count per album
    async findAllFromUser(user_id: bigint) {
        const albums = await this.prisma.albums.findMany({
            where: {
                user_id,
                deleted_at: null
            },
            orderBy: { updated_at: 'desc' },
            include: {
                _count: {
                    select: {
                        album_photos: {
                            where: { photos: { deleted_at: null }},
                        },
                    },
                },
            },
        });

        return albums.map(({ _count, ...album }) => ({
            ...album,
            photo_count: _count.album_photos,
        }));
    }

    // get user's deleted albums
    async findDeleted(user_id: bigint) {
        const albums = await this.prisma.albums.findMany({
            where: {
                user_id,
                NOT: { deleted_at: null }
            },
            orderBy: { deleted_at: 'desc' },
            include: {
                _count: {
                    select: {
                        album_photos: {
                            where: { photos: { deleted_at: null }},
                        },
                    },
                },
            },
        });

        return albums.map(({ _count, ...album }) => ({
            ...album,
            photo_count: _count.album_photos,
        }));
    }

    // soft delete: find existing album and set deleted_at timestamp
    async delete(album_id: bigint, user_id: bigint): Promise<Album> {
        return await this.prisma.$transaction(async (tx) => {
            const album = await tx.albums.findUnique({
                where: { id: album_id },
            });

            if (!album || album.user_id !== user_id || album.deleted_at !== null) {
                throw new Error('Album not found or access denied');
            }

            return await tx.albums.update({
                where: { id: album_id },
                data: { deleted_at: new Date() },
            });
        });
    }

    // restore deleted album: set deleted_at to null
    async restore(album_id: bigint, user_id: bigint): Promise<Album> {
        return await this.prisma.$transaction(async (tx) => {
            const album = await tx.albums.findUnique({
                where: { id: album_id },
            });

            if (!album || album.user_id !== user_id || album.deleted_at === null) {
                throw new Error('Album not found or access denied');
            }

            return await tx.albums.update({
                where: { id: album_id },
                data: { deleted_at: null },
            });
        });
    }

    // remove photos from album: delete album_photo relationship
    async deleteAlbumPhotos(
        album_id: bigint,
        photo_ids: bigint[],
        user_id: bigint
    ) {
        if (photo_ids.length === 0) return { count: 0 };

        return await this.prisma.album_photos.deleteMany({
            where: {
                album_id,
                photo_id: { in: photo_ids },
                albums: {
                    user_id,
                    deleted_at: null,
                },
            },
        });
    }

    // find existing album and update title
    async renameAlbum(newTitle: string, album_id: bigint, user_id: bigint) {
        return await this.prisma.$transaction(async (tx) => {
            const album = await tx.albums.findUnique({
                where: { id: album_id },
            });

            if (!album || album.user_id !== user_id || album.deleted_at !== null) {
                throw new Error('Album not found or access denied');
            }

            return await tx.albums.update({
                where: { id: album_id },
                data: { title: newTitle },
            });
        });
    }
}
