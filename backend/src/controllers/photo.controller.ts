import { PhotoModel } from '@/models/photo.model.js';
import { uploadPhotos } from '@/services/photo.upload.js';
import { TagService } from '@/services/tag.service.js';
import { Photo } from "@/types/models.js";
import { FastifyReply, FastifyRequest } from "fastify";
import { PhotoData, InsertedPhotoData } from '@/services/photo.upload.js';
import { CaptionService } from '@/services/caption.service.js';
import { PrismaClient } from '@/generated/prisma/client.js';
import { parseBigInt } from '@/plugins/bigint.handler.js';

export class PhotoController {
    constructor(
        private prisma: PrismaClient,
        private photoModel: PhotoModel,
        private tagService: TagService,
        private captionService: CaptionService
    ) {}

    // POST /photos
    async upload(request: FastifyRequest, reply: FastifyReply) {
        const user_id = request.user.id;

        try {
            //TODO: wrap in transaction
            /* uploadPhotos validates & uploads images; returns an array of PhotoData objects with these fields:
                file_path: string;
                caption?: string;
                tags?: string[];
             */
            const photoData: PhotoData[] = await uploadPhotos(request);
            if (photoData.length === 0) {
                throw new Error('No images uploaded');
            }
            
            // bulk insert into photos table
            const file_paths = photoData.map(photo => photo.file_path);
            const newPhotos = await this.photoModel.uploadMany(user_id, file_paths);
            if (newPhotos.length !== photoData.length) {
                throw new Error('Failed to upload all images');
            }

            const filePathToPhotoId = new Map(newPhotos.map(p => [p.file_path, p.id]));

            const insertedPhotoData = photoData.map(photo => {
                const photo_id = filePathToPhotoId.get(photo.file_path);
                if (!photo_id) {
                    throw new Error('Photo ID missing');
                }
                return { ... photo, photo_id}
            })
            console.log('insertedPhotoData:', insertedPhotoData);

            // HANDLE TAG INSERTION
            // extract all unique tag names to insert into tags table (if it doesn't exist)
            // insert (photo_id, tag_id) into photo_tags table
            const insertedTags = await this.tagService.addPhotoTags(insertedPhotoData, user_id);
            // console.log('inserted tags:', insertedTags);

            // HANDLE CAPTION INSERTION
            // insert (photo_id, caption) into captions table
            const insertedCaptions = await this.captionService.insertCaptions(insertedPhotoData);
            console.log('inserted captions:', insertedCaptions);

            return reply.status(201).send({ photos: Array.from(newPhotos) });
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
        let tags = (tag || '').split(',').filter(Boolean);
        tags = this.tagService.normalizeTags(tags);
        const captions = (caption || '').trim();

        const cursor_id = cursor_photo_id !== undefined
            ? parseBigInt(cursor_photo_id, 'cursor_photo_id')
            : undefined;

        // only applicable for caption FTS
        const cursor_fts = cursor_id && cursor_rank !== undefined
            ? { rank: cursor_rank, photo_id: cursor_id }
            : undefined;

        const hasTagFilter = tags.length > 0;
        const hasCaptionSearch = captions.length > 0;

        console.log('tags:', tags);
        console.log('captions:', captions);
        console.log('match:', match);
        console.log('limit:', limit);
        console.log('cursor_id:', cursor_id);
        console.log('cursor_fts:', cursor_fts);

        try {
            // 1. no filters: get all photos from user
            if (!hasTagFilter && !hasCaptionSearch) {
                const result = await this.photoModel.findAllFromUser(
                    user_id,
                    cursor_id,
                    limit
                );
                return reply.status(200).send(result);
            }
            // 2. tags only
            if (hasTagFilter && !hasCaptionSearch) {
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
            const photos = await this.captionService.searchCaptionsAndTags(
                captions,
                tags,
                match,
                user_id
            );
            // console.log('CAPTION + TAG SEARCH RESULTS:', photos);
            return reply.status(200).send({ photos });
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
        console.log('tags_to_insert:', tags_to_insert);
        console.log('tags_to_remove:', tags_to_remove);

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