import { PhotoModel } from '@/models/photo.model.js';
import { uploadPhotos } from '@/services/photo.upload.js';
import { TagService, normalizeTags } from '@/services/tag.service.js';
import { CaptionService, normalizeCaption } from '@/services/caption.service.js';
import { FastifyReply, FastifyRequest } from "fastify";
import { PhotoData, InsertedPhotoData } from '@/services/photo.upload.js';
import { PrismaClient } from '@/generated/prisma/client.js';
import { parseBigInt } from '@/plugins/bigint.handler.js';
import { debugPrint, debugPrintNested } from '@/utils/debug.print.js';
import { CacheService } from '@/services/cache.service.js';
import chalk from 'chalk';
import { buildCursor, Cursor } from '@/services/paginate.utils.js';
import { SearchService } from '@/services/search.service.js';

export class PhotoController {
    constructor(
        private prisma: PrismaClient,
        private photoModel: PhotoModel,
        private tagService: TagService,
        private captionService: CaptionService,
        private cache: CacheService,
        private searchService: SearchService
    ) {}

    // POST /photos
    async upload(request: FastifyRequest, reply: FastifyReply) {
        const user_id = request.user.id;

        try {
            // validate and write images to uploads directory
            const photoData: PhotoData[] = await uploadPhotos(request);
            if (photoData.length === 0) {
                throw new Error('No images uploaded');
            }

            const result = await this.prisma.$transaction(async (tx) => {
                // bulk insert into photos table
                const file_paths = photoData.map(photo => photo.file_path);
                const newPhotos = await this.photoModel.uploadMany(user_id, file_paths, tx);
                if (newPhotos.length !== photoData.length) {
                    throw new Error('Failed to upload all images');
                }

                const filePathToPhotoId = new Map(newPhotos.map(p => [p.file_path, p.id]));

                const insertedPhotoData = photoData.map(photo => {
                    const photo_id = filePathToPhotoId.get(photo.file_path);
                    if (!photo_id) {
                        throw new Error('Photo ID missing');
                    }
                    return { ...photo, photo_id };
                });
                // debugPrintNested(insertedPhotoData, 'Inserted Photo Data');

                // insert tags and photo_tags
                const insertedTags = await this.tagService.addPhotoTags(insertedPhotoData, user_id, tx);
                // if (insertedTags) debugPrintNested(insertedTags, 'Inserted Tags');
                
                // insert captions
                const insertedCaptions = await this.captionService.insertCaptions(insertedPhotoData, tx);
                // if (insertedCaptions) debugPrintNested(insertedCaptions, 'Inserted Captions');

                // return photo with structured metadata
                return await this.photoModel.findByIds(newPhotos.map(p => p.id), user_id, tx);
            });

            // store new photo data in cache
            await this.cache.cachePhotos(result);

            return reply.status(201).send({ photos: result });
        } catch (err) {
            console.error('Error in PhotoController.upload:', err);
            return reply.sendError(err);
        }
    }

    // GET /photos
    async findAllFromUser(request: FastifyRequest, reply: FastifyReply) {
        const user_id = request.user.id;
        const { tag, caption, match, limit, cursor_rank, cursor_id } = request.query as {
            tag?: string;
            caption?: string;
            match: 'any' | 'all';
            limit: number;
            cursor_rank?: number;
            cursor_id?: string;
        };
        // normalize tags and caption search
        const tags = normalizeTags(
            (tag ?? '').split(',').filter(Boolean)
        );
        const captions = normalizeCaption(caption ?? '');
        const cursor = buildCursor(cursor_id, cursor_rank);

        const searchQuery = this.searchService.buildSearchQuery(
            tags,
            captions,
            match,
            cursor,
            limit
        );
        
        debugPrint(searchQuery, 'PhotoController: SearchQuery');

        try {
            const { photos, nextCursor } = await this.searchService.searchPhotos(user_id, searchQuery);
            if (nextCursor) 
            {
                debugPrint(nextCursor, 'findAllFromUser: next cursor');
            } else {
                console.log('next cursor is null');
            }
            

            return reply.status(200).send({ photos, nextCursor });
        } catch (err) {
            console.error('Error in PhotoController.findAllFromUser:', err);
            return reply.sendError(err);
        }
    }

    // PATCH /photos/:id/tags
    /*
    1. normalize input
    -- BEGIN TRANSACTION
    2. tags:
        - ensure tags exist (insert if missing)
        - fetch tag_ids
    3. photo_tags:
        - delete photo_tags for removed tags
        - insert photo_tags for added tags (ignore duplicates)
    4. tags:
        - clean up tags that are no longer used in photo_tags
    -- COMMIT TRANSACTION */
    async updatePhotoTags(request: FastifyRequest<{ Params: { id: bigint } }>, reply: FastifyReply) {
        const user_id = request.user.id;
        const photo_id = request.params.id;
        const { tags_to_insert, tags_to_remove } = request.body as {
            tags_to_insert?: string[];
            tags_to_remove?: string[];
        };
        debugPrint({ tags_to_insert, tags_to_remove }, 'Update Photo Tags');

        try {
            const originalTags = await this.photoModel.getTagsOnPhoto(photo_id);
            console.log('ORIGINAL TAGS ON PHOTO:', originalTags.map(t => t.tags));

            const finalTags = await this.prisma.$transaction(async (tx) => {
                await this.tagService.updatePhotoTags(
                    tags_to_insert ?? [],
                    tags_to_remove ?? [],
                    photo_id,
                    user_id,
                    tx
                );

                // fetch final state
                return tx.photo_tags.findMany({
                    where: {
                        photo_id
                    },
                    select: {
                        tags: {
                            select: {
                                id: true,
                                tag_name: true
                            }
                        }
                    }
                });
            });

            return reply.status(200).send({ tags: finalTags.map(t => t.tags) })
        } catch (err) {
            console.error('Error in PhotoController.updatePhotoTags:', err);
            return reply.sendError(err);
        }
    }

    // PATCH /photos/:id/caption
    async updateCaption(request: FastifyRequest<{ Params: { id: bigint } }>, reply: FastifyReply) {
        const user_id = request.user.id;
        const photo_id = request.params.id;
        const { caption } = request.body as { caption: string };

        try {
            const newCaption = await this.captionService.updateCaption(photo_id, caption);
            return reply.status(200).send({ caption: newCaption });
        } catch (err) {
            console.error('Error in PhotoController.updateCaption:', err);
            return reply.sendError(err);
        }
    }

    // DELETE /photos/:id
    async delete(request: FastifyRequest<{ Params: { id: bigint } }>, reply: FastifyReply) {
        const user_id = request.user.id;
        const photo_id = request.params.id;
        if (!photo_id) {
            return reply.sendError('Photo details not found in request');
        }

        try {
            const response = await this.photoModel.delete(photo_id, user_id);
            console.log('deleted photo:', response);

            return reply.status(200).send({ success: true });
        } catch (err) {
            console.error('Error in PhotoController.delete:', err);
            return reply.sendError(err);
        }
    }

    // PATCH /photos/:id/restore - recover deleted photo
    async restore(request: FastifyRequest<{ Params: { id: bigint } }>, reply: FastifyReply) {
        const user_id = request.user.id;
        const photo_id = request.params.id;
        if (!photo_id) {
            return reply.sendError('Photo details not found in request');
        }

        try {
            const photo = await this.photoModel.restore(photo_id, user_id);
            console.log('restored photo:', photo);

            return reply.status(200).send({ photo });
        } catch (err) {
            console.error('Error in PhotoController.restore:', err);
            return reply.sendError(err);
        }
    }
}