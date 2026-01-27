import { FastifyInstance } from 'fastify';
import { AlbumModel } from '@/models/album.model.js';
import { AlbumController } from '@/controllers/album.controller.js';
import userContext from '@/plugins/user.context.js';
import { PhotoModel } from '@/models/photo.model.js';

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
        
        // update albums
        app.post('/albums/:id/photos', albumController.addPhotos.bind(albumController));

        // delete album
        app.delete<{ Params: { id: bigint } }>(
            '/albums/:id',
            albumController.delete.bind(albumController)
        );
    });
}
