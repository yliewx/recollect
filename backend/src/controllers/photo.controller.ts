import { PhotoModel } from '@/models/photo.model.js';
import { uploadPhotos } from '@/services/photo.upload.js';
import { Photo } from "@/types/models.js";
import { FastifyReply, FastifyRequest } from "fastify";

/*
    async create(request: FastifyRequest, reply: FastifyReply) {
    
    }
 */

export class PhotoController {
    constructor(private photoModel: PhotoModel) {}

    // POST /photos
    async upload(request: FastifyRequest, reply: FastifyReply) {
        const user_id = request.user.id;

        try {
            // validate & upload images, return file path
            const file_paths = await uploadPhotos(request);
            if (file_paths.length === 0) {
                return reply.sendError('No images uploaded');
            }

            // single image upload
            if (file_paths.length === 1) {
                const newPhoto = await this.photoModel.upload(user_id, file_paths[0]);
                console.log('UPLOADED 1 NEW PHOTO:', newPhoto);
                return reply.status(201).send({ photo: newPhoto }); 
            }
            
            // bulk upload
            const newPhotos = await this.photoModel.uploadMany(user_id, file_paths);
            // newPhotos.forEach(photo => console.log('UPLOADED PHOTO:', photo));
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
            // photos.forEach(photo => console.log(`retrieved user ${user_id}'s photos:`, photo));

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