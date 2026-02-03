import { AlbumModel } from '@/models/album.model.js';
import { PhotoModel } from '@/models/photo.model.js';
import { FastifyReply, FastifyRequest } from "fastify";
import { parseBigInt } from '@/plugins/bigint.handler.js';
import { TagService, normalizeTags } from '@/services/tag.service.js';
import { CaptionService, normalizeCaption } from '@/services/caption.service.js';
import { debugPrint } from '@/utils/debug.print.js';
import { CacheService } from '@/services/cache.service.js';

export class AlbumController {
    constructor(
        private albumModel: AlbumModel,
        private photoModel: PhotoModel,
        private tagService: TagService,
        private captionService: CaptionService,
        private cache: CacheService
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
    async addPhotos(request: FastifyRequest<{ Params: { id: bigint } }>, reply: FastifyReply) {
        const user_id = request.user.id;
        const album_id = request.params.id;
        const { photo_ids } = request.body as any;

        if (!album_id || !photo_ids || !Array.isArray(photo_ids)) {
            return reply.sendError('Album or photo details not found in request');
        }

        try {
            // check if album exists and belongs to user
            const album = await this.albumModel.findById(album_id, user_id);
            if (!album) {
                return reply.sendError('Album not found', 404);
            }

            // check if photos exist and belong to user
            const photos = await this.photoModel.findOwnedByIds(photo_ids, user_id);
            if (photos.length !== photo_ids.length) {
                return reply.sendError('One or more photos are not owned by user', 403);
            }

            // add photos to album
            const { count } = await this.albumModel.addPhotos(album_id, photo_ids);
            return reply.status(200).send({ total_added: count });
        } catch (err) {
            console.error('Error in AlbumController.addPhotos:', err);
            return reply.sendError(err);
        }
    }

    // GET /albums/:id/photos - get all photos from album
    async findAllPhotosFromAlbum(request: FastifyRequest<{ Params: { id: bigint } }>, reply: FastifyReply) {
        const user_id = request.user.id;
        const album_id = request.params.id;
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
        }, 'AlbumController.findAllPhotosFromAlbum');

        if (!album_id) {
            return reply.sendError('Album details not found in request');
        }

        try {
            // 1. no filters: get all photos from album
            if (!hasTagFilter && !hasCaptionSearch) {
                const result = await this.photoModel.findAllFromUser(
                    user_id,
                    cursor_id,
                    limit,
                    album_id
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
                    limit,
                    album_id
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
                    limit,
                    album_id
                );
                // console.log('CAPTION SEARCH RESULTS:', photos);
                return reply.status(200).send(result);
            }
            // 4. tags + captions
            const photos = await this.captionService.searchCaptionsAndTags(
                captions,
                tags,
                match,
                user_id,
                cursor_fts,
                limit,
                album_id
            );
            // console.log('CAPTION + TAG SEARCH RESULTS:', photos);
            return reply.status(200).send({ photos });
        } catch (err) {
            console.error('Error in AlbumController.findAllPhotosFromAlbum:', err);
            return reply.sendError(err);
        }
    }

    // GET /albums
    // list all albums belonging to the user + photo count per album
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
            const result = await this.albumModel.delete(album_id, user_id);

            return reply.status(200).send({ success: true });
        } catch (err) {
            console.error('Error in AlbumController.delete:', err);
            return reply.sendError(err);
        }
    }

    // PATCH /albums/:id/restore - recover deleted album
    async restore(request: FastifyRequest<{ Params: { id: bigint } }>, reply: FastifyReply) {
        const user_id = request.user.id;
        const album_id = request.params.id;
        if (!album_id) {
            return reply.sendError('Album details not found in request');
        }

        try {
            const album = await this.albumModel.restore(album_id, user_id);

            return reply.status(200).send({ album });
        } catch (err) {
            console.error('Error in AlbumController.restore:', err);
            return reply.sendError(err);
        }
    }

    // DELETE /albums/:id/photos - remove photos from album
    async deleteAlbumPhotos(
        request: FastifyRequest<{ Params: { id: bigint }}>,
        reply: FastifyReply
    ) {
        const user_id = request.user.id;
        const album_id = request.params.id;
        const { photo_ids } = request.body as { photo_ids: string[] };
    
        debugPrint({ user_id, album_id, photo_ids }, 'AlbumController.deleteAlbumPhotos');

        try {
            const photo_ids_bigint = photo_ids.map(p => parseBigInt(p, 'photo_ids'));
            const count = await this.albumModel.deleteAlbumPhotos(album_id, photo_ids_bigint, user_id);

            return reply.status(200).send(count);
        } catch (err) {
            console.error('Error in AlbumController.deleteAlbumPhotos:', err);
            return reply.sendError(err);
        }
    }
}