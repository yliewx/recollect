import { PhotoModel } from '@/models/photo.model.js';
import { uploadPhotos } from '@/services/photo.upload.js';
import { TagService } from '@/services/tag.service.js';
import { Photo } from "@/types/models.js";
import { FastifyReply, FastifyRequest } from "fastify";
import { PhotoData, InsertedPhotoData } from '@/services/photo.upload.js';
import { CaptionService } from '@/services/caption.service.js';

/*
    async create(request: FastifyRequest, reply: FastifyReply) {
    
    }
 */

export class PhotoController {
    constructor(
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
        const { tag, caption, match } = request.query as {
            tag?: string;
            caption?: string;
            match: 'any' | 'all'
        };
        const tags = (tag || '').split(',').filter(Boolean);
        // const captions = (caption || '').split(',').filter(Boolean);
        const captions = (caption || '').trim();
        const hasTagFilter = tags.length > 0;
        const hasCaptionSearch = captions.length > 0;
        console.log('tags:', tags);
        console.log('captions:', captions);
        console.log('match:', match);

        try {
            // 1. no filters: get all photos from user
            if (!hasTagFilter && !hasCaptionSearch) {
                const photos = await this.photoModel.findAllFromUser(user_id);
                return reply.status(200).send({ photos });
            }
            // 2. tags only
            if (hasTagFilter && !hasCaptionSearch) {
                const photos = await this.photoModel.findByTags(tags, match, user_id);
                return reply.status(200).send({ photos });
            }
            // 3. captions only
            if (hasCaptionSearch && !hasTagFilter) {
                const photos = await this.captionService.searchCaptions(captions, match, user_id);
                // console.log('CAPTION SEARCH RESULTS:', photos);
                return reply.status(200).send({ photos });
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
    update tag:
    - create tags_to_insert if doesn't exist (get tag_id)
    update photo_tag:
    - delete (photo_id, tags_to_remove)
    - insert (photo_id, tags_to_insert)
    update tag:
    - hard delete tags_to_remove if no more in photo_tag */
    // async updatePhotoTags(request: FastifyRequest<{ Params: { id: bigint } }>, reply: FastifyReply) {
    //     const user_id = request.user.id;
    //     const photo_id = request.params.id;
    //     const { tags_to_insert, tags_to_remove } = request.body as {
    //         tags_to_insert?: string;
    //         tags_to_remove?: string;
    //     };
    //     const addTags = (tags_to_insert || '').split(',').filter(Boolean);
    //     const removeTags = (tags_to_remove || '').split(',').filter(Boolean);
    //     console.log('addTags:', addTags);
    //     console.log('removeTags:', removeTags);
    // }

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
}