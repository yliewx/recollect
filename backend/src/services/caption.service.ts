import { PrismaClient } from "@/generated/prisma/client.js";
import { InsertedPhotoData } from "./photo.upload.js";
import { Caption } from "@/types/models.js";
import { Prisma } from "@/generated/prisma/client.js";

// helper for removing excess whitespace from captions
export function normalizeCaption(caption: string): string {
    return caption
        .trim()
        .replace(/\s+/g, ' '); // replace multiple spaces
}

export class CaptionService {
    constructor(private prisma: PrismaClient) {}

    private hasCaption(photo: InsertedPhotoData): boolean {
        return typeof photo.caption === 'string' && photo.caption.trim() !== '';
    }

    async insertCaptions(
        photoData: InsertedPhotoData[],
        tx?: Prisma.TransactionClient
    ) {
        const prisma = tx ?? this.prisma;
        // filter out photos without captions & empty captions
        const captionData = photoData
            .filter(photo => this.hasCaption(photo))
            .map(({ photo_id, caption }) => ({
                photo_id,
                caption: normalizeCaption(caption!)
            }));
        
        if (captionData.length === 0) return;

        return await prisma.captions.createManyAndReturn({
            data: captionData,
            skipDuplicates: true,
        });
    }

    async updateCaption(photo_id: bigint, caption: string) {
        const finalCaption = normalizeCaption(caption);

        return this.prisma.captions.upsert({
            where: { photo_id },
            create: {
                photo_id,
                caption: finalCaption
            },
            update: { caption: finalCaption }
        });
    }

    async searchCaptions(
        query: string,
        match: 'any' | 'all',
        userId: bigint,
        cursor?: { rank: number, photo_id: bigint },
        limit = 20,
        album_id?: bigint
    ) {
        if (query.length === 0 ) {
            return { photos: [], nextCursor: null };
        }

        const queryString = (match === 'all')
            ? query // 'abc xyz' -> match abc AND xyz
            : query.split(/\s+/).join(' OR '); // -> match abc OR xyz

        const whereCursorCondition = cursor
            ? Prisma.sql`
                WHERE
                    (
                        rank < ${cursor.rank}
                        OR (rank = ${cursor.rank} AND photo_id < ${cursor.photo_id})
                    )
            `
            : Prisma.empty;

        const albumCondition = album_id !== undefined
            ? Prisma.sql`AND p.album_id = ${album_id}`
            : Prisma.empty;

        const photos = await this.prisma.$queryRaw<
            Array<{
                photo_id: bigint;
                caption: string;
                rank: number;
            }>
        >(Prisma.sql`
            WITH ranked AS (
                SELECT
                    c.photo_id,
                    c.caption,
                    p.user_id,
                    ts_rank(
                        c.caption_tsv,
                        websearch_to_tsquery('english', ${queryString})
                    ) AS rank
                FROM captions c
                JOIN photos p ON p.id = c.photo_id
                WHERE
                    p.user_id = ${userId}
                    AND p.deleted_at IS NULL
                    AND c.caption_tsv @@ websearch_to_tsquery('english', ${queryString})
                    ${albumCondition}
            )
            SELECT *
            FROM ranked
            ${whereCursorCondition}
            ORDER BY rank DESC, photo_id DESC
            LIMIT ${limit};
        `);

        const nextCursor = photos.length > 0
            ? {
                rank: photos[photos.length - 1].rank,
                photo_id: photos[photos.length - 1].photo_id,
            }
            : null;

        return { photos, nextCursor };
    }

    async searchCaptionsAndTags(
        query: string,
        tags: string[],
        match: 'any' | 'all',
        userId: bigint,
        cursor?: { rank: number; photo_id: bigint },
        limit = 20,
        album_id?: bigint
    ) {
        if (query.length === 0 && tags.length === 0) {
            return { photos: [], nextCursor: null };
        }

        const queryString = (match === 'all')
            ? query // 'abc xyz' -> match abc AND xyz
            : query.split(/\s+/).join(' OR '); // -> match abc OR xyz

        // -- match === 'all': caption_match AND tag_match
		// -- match === 'any': caption_match OR tag_match
        const tagCondition = match === 'all'
            ? Prisma.sql`c.caption_tsv @@ websearch_to_tsquery('english', ${queryString}) AND t.tag_name = ANY(${tags})`
            : Prisma.sql`c.caption_tsv @@ websearch_to_tsquery('english', ${queryString}) OR t.tag_name = ANY(${tags})`;

        // optional album filter
        const albumCondition = album_id !== undefined
            ? Prisma.sql`AND p.album_id = ${album_id}`
            : Prisma.empty;
        
        // optional cursor condition
        const whereCursorCondition = cursor
            ? Prisma.sql`
                WHERE
                    (
                        rank < ${cursor.rank}
                        OR (rank = ${cursor.rank} AND photo_id < ${cursor.photo_id})
                    )
            `
            : Prisma.empty;

        const photos = await this.prisma.$queryRaw<
            Array<{
                photo_id: bigint;
                caption: string;
                rank: number;
            }>
        >(Prisma.sql`
            WITH ranked AS (
                SELECT DISTINCT
                    c.photo_id,
                    c.caption,
                    ts_rank(
                        c.caption_tsv,
                        websearch_to_tsquery('english', ${queryString})
                    ) AS rank
                FROM photos p
                LEFT JOIN captions c ON p.id = c.photo_id
                LEFT JOIN photo_tags pt ON p.id = pt.photo_id
                LEFT JOIN tags t ON t.id = pt.tag_id
                WHERE
                    p.user_id = ${userId}
                    AND p.deleted_at IS NULL
                    AND (${tagCondition})
                    ${albumCondition}
            )
            SELECT *
            FROM ranked
            ${whereCursorCondition}
            ORDER BY rank DESC, photo_id DESC
            LIMIT ${limit};
        `);

        const nextCursor = photos.length > 0
            ? {
                rank: photos[photos.length - 1].rank,
                photo_id: photos[photos.length - 1].photo_id,
            }
            : null;

        return { photos, nextCursor };
    }
}
