import { AlbumModel } from '@/models/album.model.js';
import { PhotoModel } from '@/models/photo.model.js';
import { Album } from "@/types/models.js";
import { FastifyReply, FastifyRequest } from "fastify";

export class AlbumController {
    constructor(
        private albumModel: AlbumModel,
        private photoModel: PhotoModel
    ) {}

    // POST /albums
    async create(request: FastifyRequest, reply: FastifyReply) {
        const user_id = request.user.id;
        const { title } = request.body as any;
        if (!title) {
            reply.sendError('Album details not found in request');
        }

        try {
            const newAlbum = await this.albumModel.create(user_id, title);
            console.log('new album:', newAlbum);
            return reply.status(201).send({ album: newAlbum });
        } catch (err) {
            console.error('Error in AlbumController.create:', err);
            return reply.sendError(err);
        }
    }

    // POST /albums/:id/photos - add photo to album
    // only accept existing photos (photo_id). photos are uploaded separately
    async addPhotos(request: FastifyRequest, reply: FastifyReply) {
        console.log('inside addPhotos');
        const user_id = request.user.id;
        const { album_id, photo_ids } = request.body as any;
        console.log('album_id', album_id);
        console.log('photo_ids', photo_ids);
        if (!album_id || !photo_ids || !Array.isArray(photo_ids)) {
            return reply.sendError('Album or photo details not found in request');
        }

        try {
            // check if album exists and belongs to user
            const album = await this.albumModel.findById(album_id, user_id);
            if (!album) {
                return reply.sendError('Album not found', 404);
            }
            console.log('album exists');

            // check if photos exist and belong to user
            const photos = await this.photoModel.findOwnedByIds(photo_ids, user_id);
            if (photos.length !== photo_ids.length) {
                return reply.sendError('One or more photos are not owned by user', 403);
            }
            console.log('photos exist and belong to user');

            // add photos to album
            const { count } = await this.albumModel.addPhotos(album_id, photo_ids);
            console.log('count:', count);
            console.log('typeof count:', typeof count);
            return reply.status(200).send({ total_added: count });
        } catch (err) {
            console.error('Error in AlbumController.addPhotos:', err);
            return reply.sendError(err);
        }
    }

    // GET /albums
    // list all albums belonging to the user
    async findAllFromUser(request: FastifyRequest, reply: FastifyReply) {
        const user_id = request.user.id;

        try {
            const albums = await this.albumModel.findAllFromUser(user_id);

            return reply.status(200).send({ albums });
        } catch (err) {
            console.error('Error in AlbumController.findAllFromUser:', err);
            return reply.sendError(err);
        }
    }

    // DELETE /albums/:id
    async delete(request: FastifyRequest<{ Params: { id: bigint } }>, reply: FastifyReply) {
        const user_id = request.user.id;
        const album_id = request.params.id;
        if (!album_id) {
            return reply.sendError('Album details not found in request');
        }

        try {
            const response = await this.albumModel.delete(album_id, user_id);

            return reply.status(200).send({ success: true });
        } catch (err) {
            console.error('Error in AlbumController.delete:', err);
            return reply.sendError(err);
        }
    }
}