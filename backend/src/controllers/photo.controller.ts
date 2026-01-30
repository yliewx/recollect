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

            insertedPhotoData.forEach(async (photo, i) => {
                console.log(`UPLOADED PHOTO ${i}:`, photo);
            });

            // HANDLE TAG INSERTION
            // extract all unique tag names to insert into tags table (if it doesn't exist)
            // insert (photo_id, tag_id) into photo_tags table
            const insertedTags = await this.tagService.applyPhotoTags(insertedPhotoData, user_id);
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

        try {
            const photos = await this.photoModel.findAllFromUser(user_id);
            photos.forEach((photo, i) => console.log(`retrieved user ${user_id}'s photo[${i}]:`, photo));

            return reply.status(200).send({ photos });
        } catch (err) {
            console.error('Error in PhotoController.findAllFromUser:', err);
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