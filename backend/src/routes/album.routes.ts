import { FastifyInstance } from 'fastify';
import { AlbumModel } from '@/models/album.model.js';
import { AlbumController } from '@/controllers/album.controller.js';
import userContext from '@/plugins/user.context.js';
import { PhotoModel } from '@/models/photo.model.js';
import { TagService } from '@/services/tag.service.js';
import { CaptionService } from '@/services/caption.service.js';
import { CacheService } from '@/services/cache.service.js';
import { Services } from '@/types/search.js';

const querySchema = {
    querystring: {
        type: 'object',
        properties: {
            tag: { type: 'string' },
            caption: { type: 'string' },
            match: {
                type: 'string',
                enum: ['any', 'all'],
                default: 'any',
            },
            limit: {
                type: 'integer',
                minimum: 1,
                maximum: 50,
                default: 20,
            },
            cursor_rank: { type: 'number' }, // only applicable for caption FTS
            cursor_id: { type: 'string' },
        },
    }
};

const deleteAlbumPhotosSchema = {
    body: {
        type: 'object',
        properties: {
            photo_ids: {
                type: 'array',
                items: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 20,
                },
                minItems: 1,
                maxItems: 100,
            },
        },
        required: ['photo_ids'],
        additionalProperties: false,
    },
};

const renameAlbumSchema = {
    body: {
        type: 'object',
        properties: {
            title: {
                type: 'string',
                minLength: 1,
                maxLength: 30,
            },
        },
        required: ['title'],
        additionalProperties: false,
    },
};

export async function albumRoutes(app: FastifyInstance, services: Services) {
    const {
        tagService,
        captionService,
        cacheService,
        searchService,
    } = services;

    const albumController = new AlbumController(
        new AlbumModel(app.prisma),
        new PhotoModel(app.prisma),
        tagService,
        captionService,
        cacheService,
        searchService,
    );

    // protected
    app.register(async function protectedAlbumRoutes(app) {
        app.register(userContext);

        // get all albums belonging to user
        app.get('/albums', albumController.findAllFromUser.bind(albumController));

        // create albums
        app.post('/albums', albumController.create.bind(albumController));

        // get all photos in an album
        app.get<{ Params: { id: bigint } }>(
            '/albums/:id/photos',
            { schema: querySchema },
            albumController.findAllPhotosFromAlbum.bind(albumController)
        );
        
        // add photos to an album
        app.post<{ Params: { id: bigint } }>(
            '/albums/:id/photos',
            albumController.addPhotos.bind(albumController)
        );

        // remove photos from an album
        app.delete<{ Params: { id: bigint }}>(
            '/albums/:id/photos',
            { schema: deleteAlbumPhotosSchema },
            albumController.deleteAlbumPhotos.bind(albumController)
        );

        // delete album
        app.delete<{ Params: { id: bigint } }>(
            '/albums/:id',
            albumController.delete.bind(albumController)
        );

        // restore deleted album
        app.patch<{ Params: { id: bigint } }>(
            '/albums/:id/restore',
            albumController.restore.bind(albumController)
        );

        // change album title
        app.patch<{ Params: { id: bigint } }>(
            '/albums/:id/title',
            { schema: renameAlbumSchema },
            albumController.renameAlbum.bind(albumController)
        );
    });
}
