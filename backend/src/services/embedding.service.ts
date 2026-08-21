import { Prisma, PrismaClient } from '@/generated/prisma/client.js';
import { InsertedPhotoData } from '@/types/photo.js';

// pgvector text literal, e.g. "[0.1,-0.2,0.3]"
function toVectorLiteral(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
}

export class EmbeddingService {
    constructor(private prisma: PrismaClient) {}

    private hasEmbedding(photo: InsertedPhotoData): boolean {
        return Array.isArray(photo.embedding) && photo.embedding.length > 0;
    }

    /**============================================
     *              WRITE EMBEDDINGS
     *=============================================**/
    // called from PhotoController.register, inside the same transaction as
    // tag/caption inserts. Photos registered without an embedding are simply
    // left out of similarity results (no server-side extraction fallback --
    // that would require image bytes server-side, which is disallowed).
    async setEmbeddings(
        photoData: InsertedPhotoData[],
        tx?: Prisma.TransactionClient
    ): Promise<void> {
        const prisma = tx ?? this.prisma;

        const withEmbeddings = photoData.filter(photo => this.hasEmbedding(photo));
        if (withEmbeddings.length === 0) return;

        for (const { photo_id, embedding } of withEmbeddings) {
            if (!embedding!.every(n => Number.isFinite(n))) {
                throw new Error(`Invalid embedding for photo ${photo_id}: all elements must be finite numbers`);
            }

            await prisma.$executeRaw(Prisma.sql`
                UPDATE photos
                SET embedding = ${toVectorLiteral(embedding!)}::vector
                WHERE id = ${photo_id}
            `);
        }
    }

    /**============================================
     *          NEAREST-NEIGHBOR SEARCH
     *=============================================**/
    // photo ids for the same user, ordered nearest-first by L2 distance.
    // scoped to the requesting user's own photos; excludes the anchor photo,
    // soft-deleted photos, and photos with no embedding on either side.
    // the embedding column has no fixed dimension (VNFeaturePrintObservation's
    // elementCount isn't a stable constant across iOS versions/devices), so
    // candidates are also required to match the anchor's vector_dims() --
    // the <-> operator errors on mismatched dimensions otherwise.
    async findSimilarPhotoIds(
        user_id: bigint,
        photo_id: bigint,
        limit = 20
    ): Promise<bigint[]> {
        const rows = await this.prisma.$queryRaw<{ id: bigint }[]>(Prisma.sql`
            SELECT p.id
            FROM photos p, (
                SELECT embedding
                FROM photos
                WHERE id = ${photo_id} AND user_id = ${user_id} AND deleted_at IS NULL
            ) anchor
            WHERE
                p.user_id = ${user_id}
                AND p.id != ${photo_id}
                AND p.deleted_at IS NULL
                AND p.embedding IS NOT NULL
                AND anchor.embedding IS NOT NULL
                AND vector_dims(p.embedding) = vector_dims(anchor.embedding)
            ORDER BY p.embedding <-> anchor.embedding
            LIMIT ${limit};
        `);

        return rows.map(r => r.id);
    }
}
