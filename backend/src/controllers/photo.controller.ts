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

export class PhotoController {
    constructor(
        private prisma: PrismaClient,
        private photoModel: PhotoModel,
        private tagService: TagService,
        private captionService: CaptionService,
        private cache: CacheService
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
                debugPrintNested(insertedPhotoData, 'Inserted Photo Data');

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
        const { tag, caption, match, limit, cursor_rank, cursor_photo_id } = request.query as {
            tag?: string;
            caption?: string;
            match: 'any' | 'all';
            limit: number;
            cursor_rank?: number;
            cursor_photo_id?: string;
        };
        // normalize tags and caption search
        const tags = normalizeTags(
            (tag ?? '').split(',').filter(Boolean)
        );
        if (tags.length > 0 && tags.length > 10) {
            return reply.sendError('Exceeded max number of tag filters (10)');
        }
        const captions = normalizeCaption(caption ?? '');

        // store whether tags and captions were present in query
        const hasTagFilter = tags.length > 0;
        const hasCaptionSearch = captions.length > 0;

        const cursor_id = cursor_photo_id !== undefined
            ? parseBigInt(cursor_photo_id, 'cursor_photo_id')
            : undefined;

        // only applicable for caption FTS
        const cursor_fts = cursor_id && cursor_rank !== undefined
            ? { rank: cursor_rank, photo_id: cursor_id }
            : undefined;

        debugPrint({
            tags,
            captions,
            match,
            limit,
            cursor_id,
            cursor_fts
        }, 'PhotoController.findAllFromUser');

        try {
            // 1. no filters: get all photos from user
            if (!hasTagFilter && !hasCaptionSearch) {
                // get ids
                const { photoIds, nextCursor } = await this.photoModel.findAllFromUser(
                    user_id,
                    cursor_id,
                    limit
                );
                if (photoIds.length === 0) {
                    return reply.status(200).send({ photoIds, nextCursor, count: 0 });
                }

                // resolve ids -> cached metadata
                const photoMap = await this.cache.getCachedPhotos(photoIds);
                debugPrint(photoMap, '[PHOTO] got photoMap');

                // get final photos array (fetch any missing metadata + update cache as needed)
                const photos = await this.cache.fetchAndMergePhotos(photoMap, user_id, this.photoModel.findByIds.bind(this.photoModel));
                
                // return photos + next cursor to client
                return reply.status(200).send({ photos, nextCursor });
            }
            // 2. tags only
            if (hasTagFilter && !hasCaptionSearch) {
                // // check if search query exists in cache
                // const photoIds = await this.cache.getCachedTagSearch(user_id, tags, cursor_id, limit);
                // // cache hit: resolve ids -> cached metadata
                // if (photoIds !== null) {

                // }

                const result = await this.photoModel.findByTags(
                    tags,
                    match,
                    user_id,
                    cursor_id,
                    limit
                );
                return reply.status(200).send(result);
            }
            // 3. captions only
            if (hasCaptionSearch && !hasTagFilter) {
                const result = await this.captionService.searchCaptions(
                    captions,
                    match,
                    user_id,
                    cursor_fts,
                    limit
                );
                // console.log('CAPTION SEARCH RESULTS:', photos);
                return reply.status(200).send(result);
            }
            // 4. tags + captions
            const result = await this.captionService.searchCaptionsAndTags(
                captions,
                tags,
                match,
                user_id,
                cursor_fts,
                limit
            );
            // console.log('CAPTION + TAG SEARCH RESULTS:', photos);
            return reply.status(200).send(result);
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