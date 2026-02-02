import { FastifyInstance } from 'fastify';
import { AlbumModel } from '@/models/album.model.js';
import { AlbumController } from '@/controllers/album.controller.js';
import userContext from '@/plugins/user.context.js';
import { PhotoModel } from '@/models/photo.model.js';

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
            cursor_photo_id: { type: 'string' },
        },
    }
};

export async function albumRoutes(app: FastifyInstance) {
    const albumModel = new AlbumModel(app.prisma);
    const photoModel = new PhotoModel(app.prisma);
    const albumController = new AlbumController(albumModel, photoModel);

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
    });
}
