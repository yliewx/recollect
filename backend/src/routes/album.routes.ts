import { FastifyInstance } from 'fastify';
import { AlbumModel } from '@/models/album.model.js';
import { AlbumController } from '@/controllers/album.controller.js';
import userContext from '@/plugins/user.context.js';
import { PhotoModel } from '@/models/photo.model.js';
import { Services } from '@/types/search.js';
import { addAlbumPhotosSchema, createAlbumSchema, deleteAlbumPhotosSchema, deleteAlbumSchema, listAlbumsSchema, queryAlbumSchema, renameAlbumSchema, restoreAlbumSchema } from './schemas/album.schema.js';

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
        app.get('/albums',
            { schema: listAlbumsSchema },
            albumController.findAllFromUser.bind(albumController)
        );

        // create albums
        app.post('/albums',
            { schema: createAlbumSchema },
            albumController.create.bind(albumController)
        );

        // get all photos in an album
        app.get<{ Params: { id: string } }>(
            '/albums/:id/photos',
            { schema: queryAlbumSchema },
            albumController.findAllPhotosFromAlbum.bind(albumController)
        );
        
        // add photos to an album
        app.post<{ Params: { id: string } }>(
            '/albums/:id/photos',
            { schema: addAlbumPhotosSchema },
            albumController.addPhotos.bind(albumController)
        );

        // remove photos from an album
        app.delete<{ Params: { id: string } }>(
            '/albums/:id/photos',
            { schema: deleteAlbumPhotosSchema },
            albumController.deleteAlbumPhotos.bind(albumController)
        );

        // delete album
        app.delete<{ Params: { id: string } }>(
            '/albums/:id',
            { schema: deleteAlbumSchema },
            albumController.delete.bind(albumController)
        );

        // restore deleted album
        app.patch<{ Params: { id: string } }>(
            '/albums/:id/restore',
            { schema: restoreAlbumSchema },
            albumController.restore.bind(albumController)
        );

        // change album title
        app.patch<{ Params: { id: string } }>(
            '/albums/:id/title',
            { schema: renameAlbumSchema },
            albumController.renameAlbum.bind(albumController)
        );
    });
}
