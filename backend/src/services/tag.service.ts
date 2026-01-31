import { InsertedPhotoData } from './photo.upload.js'
import { PrismaClient } from '@/generated/prisma/client.js';
import { PhotoTag } from '@/types/models.js';

export class TagService {
    constructor(private prisma: PrismaClient) {}

    async addPhotoTags(photoData: InsertedPhotoData[], user_id: bigint) {
        try {
            // extract all unique tag names to insert into tags table (if it doesn't exist)
            const uniqueTags = this.extractUniqueTags(photoData);
            if (uniqueTags.length === 0) return; // no tags to insert

            // filter out existing tags
            const existingTags = await this.getExistingTags(uniqueTags, user_id);
            const tagsToInsert = uniqueTags.filter(tag => !existingTags.has(tag));
            
            // batch insert new tags
            const insertedTags = await this.insertTags(tagsToInsert, user_id);
            // console.log('inserted tags:', insertedTags);

            // create map of all tags in photoData (including newly inserted)
            const allTags = new Map<string, bigint>([
                ... existingTags.entries(),
                ... insertedTags.map(t => [t.tag_name, t.id] as [string, bigint]),
            ]);

            // insert every (photo_id, tag_id) into photo_tags table
            const photoTags = await this.pairPhotoTags(photoData, allTags);
            if (photoTags.length > 0) {
                const insertedPhotoTags = await this.insertPhotoTags(photoTags);
                //  console.log('inserted photo_tags:', insertedPhotoTags);
            }

            return insertedTags;
        } catch (err) {
            console.error('Error in TagService.handleTagInsertion:', err);
            throw new Error('Failed to insert photo tags');
        }
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

    private async getExistingTags(uniqueTags: string[], user_id: bigint) {
        const existingTags = await this.prisma.tags.findMany({
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

    private async insertTags(tag_names: string[], user_id: bigint) {
        return await this.prisma.tags.createManyAndReturn({
            data: tag_names.map(tag_name => ({
                user_id,
                tag_name,
            })),
            skipDuplicates: true,
        });
    }

    private async pairPhotoTags(photoData: InsertedPhotoData[], allTags: Map<string, bigint>) {
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

    private async insertPhotoTags(photoTags: PhotoTag[]) {
        return await this.prisma.photo_tags.createManyAndReturn({
            data: photoTags,
            skipDuplicates: true,
        });
    }
}