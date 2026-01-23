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
    // TODO: user auth check? temporarily use request.body
    async upload(request: FastifyRequest, reply: FastifyReply) {
        const { userId, filePath, caption } = request.body as any;
        if (!userId || !filePath) {
            return reply.sendError('Photo details not found in request');
        }

        try {
            const newPhoto = await this.photoModel.upload(userId, filePath, caption);
            console.log('uploaded new photo:', newPhoto);

            return reply.status(201).send({ photo: newPhoto });
        } catch (err) {
            console.error('Error in PhotoController.upload:', err);
            return reply.sendError(err);
        }
    }

    // DELETE /photos/:id

}