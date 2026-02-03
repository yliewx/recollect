import { InsertedPhotoData } from './photo.upload.js'
import { Prisma, PrismaClient } from '@/generated/prisma/client.js';
import { PhotoTag } from '@/types/models.js';

export class TagService {
    constructor(private prisma: PrismaClient) {}

    /**========================================================================
     **                TRANSACTION START: PhotoController.upload()
     *========================================================================**/
    async addPhotoTags(
        photoData: InsertedPhotoData[],
        user_id: bigint,
        tx?: Prisma.TransactionClient
    ) {
        const prisma = tx ?? this.prisma;
    
        try {
            // extract all unique tag names to insert into tags table (if it doesn't exist)
            photoData = this.normalizePhotoDataTags(photoData);
            const uniqueTags = this.extractUniqueTags(photoData);
            if (uniqueTags.length === 0) return; // no tags to insert

            // filter out existing tags
            const existingTags = await this.getExistingTags(uniqueTags, user_id, prisma);
            const tagsToInsert = uniqueTags.filter(tag => !existingTags.has(tag));
            
            // batch insert new tags
            const insertedTags = await this.insertTags(tagsToInsert, user_id, prisma);

            // create map of all tags in photoData (including newly inserted)
            const allTags = new Map<string, bigint>([
                ... existingTags.entries(),
                ... insertedTags.map(t => [t.tag_name, t.id] as [string, bigint]),
            ]);

            // insert every (photo_id, tag_id) into photo_tags table
            const photoTags = this.pairPhotoTags(photoData, allTags);
            if (photoTags.length > 0) {
                const insertedPhotoTags = await this.insertPhotoTags(photoTags, prisma);
            }

            return insertedTags;
        } catch (err) {
            console.error('Error in TagService.addPhotoTags:', err);
            throw new Error('Failed to insert photo tags');
        }
    }

    /**========================================================================
     **            TRANSACTION START: PhotoController.updatePhotoTags()
     *========================================================================**/
    async updatePhotoTags(
        tags_to_insert: string[],
        tags_to_remove: string[],
        photo_id: bigint,
        user_id: bigint,
        tx?: Prisma.TransactionClient
    ) {
        const prisma = tx ?? this.prisma;

        try {
            const insertTags = this.normalizeTags(tags_to_insert);
            const removeTags = this.normalizeTags(tags_to_remove);
            // filter out tags that appear in both insert+remove sets to avoid redundancy
            const removeSet = new Set(removeTags);
            const finalInsertTags = insertTags.filter(tag => !removeSet.has(tag));

            // insert missing tags
            if (finalInsertTags.length > 0) {
                const res = await this.insertTags(finalInsertTags, user_id, prisma);
                console.log('inserted missing tags:', res);
            }

            // fetch tag_ids
            const { insertTagIds, removeTagIds } = await this.getTagIdsFromNames(
                finalInsertTags,
                removeTags,
                user_id,
                prisma
            );
            
            // delete photo_tags for removed tags
            if (removeTagIds.length > 0) {
                const res = await this.deletePhotoTags(removeTagIds, photo_id, prisma);
                console.log('deleted photo_tags:', res);
            }

            // insert photo_tags for added tags (ignore duplicates)
            if (insertTagIds.length > 0) {
                const photoTagsToInsert = insertTagIds.map(tag_id => ({
                    tag_id,
                    photo_id
                }));
                const res = await this.insertPhotoTags(photoTagsToInsert, prisma);
                console.log('inserted photo_tags:', res);
            }

            // clean up tags that are no longer used in photo_tags
            if (removeTagIds.length > 0) {
                const res = await this.deleteUnusedTags(removeTagIds, user_id, prisma);
                console.log('removed unused tags:', res);
            }
        } catch (err) {
            console.error('Error in TagService.updatePhotoTags:', err);
            throw new Error('Failed to update photo tags');
        }
    }

    async getTagIdsFromNames(
        insertTags: string[],
        removeTags: string[],
        user_id: bigint,
        prisma: PrismaClient | Prisma.TransactionClient
    ) {
        if (insertTags.length === 0 && removeTags.length === 0) {
            return { insertTagIds: [], removeTagIds: [] };
        }
        const relevantTags = await prisma.tags.findMany({
            where: {
                user_id,
                tag_name: {
                    in: [... insertTags, ... removeTags]
                }
            },
            select: { id: true, tag_name: true }
        });

        const tagIdByName = new Map(
            relevantTags.map(tag => [tag.tag_name, tag.id])
        );

        const insertTagIds = insertTags
            .map(tag => tagIdByName.get(tag))
            .filter(Boolean) as bigint[];

        const removeTagIds = removeTags
            .map(tag => tagIdByName.get(tag))
            .filter(Boolean) as bigint[];
        
        return { insertTagIds, removeTagIds };
    }

    // helper for trimming whitespace/removing empty tags
    normalizeTags(tags: string[]) {
        const normalizedTags = new Set<string>(
            (tags ?? [])
                .map(tag => tag.trim().toLowerCase())
                .filter(Boolean)
        );

        return [... normalizedTags];
    }

    // normalize tags field for each photoData object
    private normalizePhotoDataTags(photoData: InsertedPhotoData[]) {
        return photoData.map(p => ({
            ...p,
            tags: p.tags ? this.normalizeTags(p.tags) : []
        }));
    }

    private extractUniqueTags(photoData: InsertedPhotoData[]) {
        const uniqueTags = new Set<string>();

        photoData.forEach(p => {
            if (p.tags && Array.isArray(p.tags)) {
                p.tags.forEach(tag => uniqueTags.add(tag));
            }
        });
        return [... uniqueTags];
    }

    private pairPhotoTags(photoData: InsertedPhotoData[], allTags: Map<string, bigint>) {
        const photoTags: PhotoTag[] = [];

        photoData.forEach(photo => {
            if (!photo.tags) return;

            photo.tags.forEach(tagName => {
                const tag_id = allTags.get(tagName);
                if (tag_id) {
                    photoTags.push({
                        photo_id: photo.photo_id,
                        tag_id,
                    });
                }
            });
        });

        return photoTags;
    }

    /**========================================================================
     **                           DATABASE OPERATIONS
     *========================================================================**/

    private async getExistingTags(
        uniqueTags: string[],
        user_id: bigint,
        prisma: PrismaClient | Prisma.TransactionClient
    ) {
        const existingTags = await prisma.tags.findMany({
            where: {
                user_id,
                tag_name: { in: uniqueTags }
            },
            select: {
                id: true,
                tag_name: true
            }
        });
        return new Map(
            existingTags.map(tag => [tag.tag_name, tag.id])
        );
    }

    private async insertPhotoTags(
        photoTags: PhotoTag[],
        prisma: PrismaClient | Prisma.TransactionClient
    ) {
        return await prisma.photo_tags.createManyAndReturn({
            data: photoTags,
            skipDuplicates: true,
        });
    }

    private async deletePhotoTags(
        tag_ids: bigint[],
        photo_id: bigint,
        prisma: PrismaClient | Prisma.TransactionClient
    ) {
        return await prisma.photo_tags.deleteMany({
            where: {
                photo_id,
                tag_id: { in: tag_ids }
            },
        });
    }

    private async insertTags(
        tag_names: string[],
        user_id: bigint,
        prisma: PrismaClient | Prisma.TransactionClient
    ) {
        return await prisma.tags.createManyAndReturn({
            data: tag_names.map(tag_name => ({
                user_id,
                tag_name,
            })),
            skipDuplicates: true,
        });
    }

    private async deleteUnusedTags(
        tag_ids: bigint[],
        user_id: bigint,
        prisma: PrismaClient | Prisma.TransactionClient
    ) {
        return await prisma.tags.deleteMany({
            where: {
                user_id,
                id: { in: tag_ids },
                photo_tags: {
                    none: {}
                }
            }
        });
    }
}