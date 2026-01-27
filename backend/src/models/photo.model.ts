import { Photo } from "@/types/models.js";
import { PrismaClient } from '@/generated/prisma/client.js';

export class PhotoModel {
    constructor(private prisma: PrismaClient) {}

    // single insert
    async upload(user_id: bigint, file_path: string): Promise<Photo> {
        return await this.prisma.photos.create({
            data: { user_id, file_path }
        });
    }

    // bulk inserts
    async uploadMany(user_id: bigint, file_paths: string[]): Promise<Photo[]> {
        await this.prisma.photos.createMany({
            data: file_paths.map(file_path => ({
                user_id,
                file_path,
            })),
        });

        return await this.prisma.photos.findMany({
            where: {
                user_id,
                file_path: { in: file_paths },
                deleted_at: null
            },
            orderBy: { uploaded_at: 'desc' },
        });
    }

    // get all active photos from specific user
    async findAllFromUser(user_id: bigint): Promise<Photo[]> {
        return await this.prisma.photos.findMany({
            where: {
                user_id,
                deleted_at: null
            },
            orderBy: { uploaded_at: 'desc' },
        });
    }

    // return photos with matching photo_ids that are owned by the user
    async findOwnedByIds(photo_ids: bigint[], user_id: bigint): Promise<Photo[]> {
        return await this.prisma.photos.findMany({
            where: {
                user_id,
                id: { in: photo_ids },
                deleted_at: null
            },
        });
    }

    // get user's photos by tag id
    async taggedWith(tag_id: bigint, user_id: bigint): Promise<Photo[]> {
        return await this.prisma.photos.findMany({
            where: {
                user_id,
                deleted_at: null,
                photo_tags: {
                    some: {
                        tags: { id: tag_id }
                    }
                },
            },
            orderBy: { uploaded_at: 'desc' },
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
        return this.prisma.photos.update({
            where: {
                id: photo_id,
                user_id
            },
            data: { deleted_at: new Date() },
        });
    }

    // restore deleted photo
    async restore(photo_id: bigint, user_id: bigint): Promise<Photo> {
        return this.prisma.photos.update({
            where: {
                id: photo_id,
                user_id,
                NOT: { deleted_at: null }
            },
            data: { deleted_at: null },
        });
    }
}

/*
    const query = `

    `;
    const values = [];
    const result = await this.db.query(query, values);

    if (!result.rows || result.rows.length === 0) {
        throw new Error();
    }

    return result.rows[0];
*/
