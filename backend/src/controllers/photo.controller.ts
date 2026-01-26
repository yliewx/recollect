import { PhotoModel } from '@/models/photo.model.js';
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
        const { file_path, caption } = request.body as any;
        if (!file_path) {
            return reply.sendError('Photo details not found in request');
        }

        try {
            const newPhoto = await this.photoModel.upload(user_id, file_path);
            console.log('uploaded new photo:', newPhoto);

            return reply.status(201).send({ photo: newPhoto });
        } catch (err) {
            console.error('Error in PhotoController.upload:', err);
            return reply.sendError(err);
        }
    }

    // GET /photos
    async findFromUser(request: FastifyRequest, reply: FastifyReply) {
        const user_id = request.user.id;

        try {
            const photos = await this.photoModel.findFromUser(user_id);
            console.log(`retrieved user ${user_id}'s photos: ${photos}`);

            return reply.status(200).send({ photos });
        } catch (err) {
            console.error('Error in PhotoController.findFromUser:', err);
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