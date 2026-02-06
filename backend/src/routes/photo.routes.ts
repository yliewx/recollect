import { FastifyInstance } from 'fastify';
import { PhotoModel } from '@/models/photo.model.js';
import { PhotoController } from '@/controllers/photo.controller.js';
import userContext from '@/plugins/user.context.js';
import { TagService } from '@/services/tag.service.js';
import { CaptionService } from '@/services/caption.service.js';
import { CacheService } from '@/services/cache.service.js';
import { SearchService } from '@/services/search.service.js';
import { Services } from '@/types/search.js';
import { deletePhotoSchema, querySchema, updateCaptionSchema, updateTagsSchema, uploadPhotoSchema } from './schemas/photo.schema.js';

/* define query parameters and types
eg.
    /photos?caption=x
    /photos?tag=y
    /photos?caption=x&tag=y

    /photos?tag=x,y&match=any -> (default) find photos tagged with x OR y
    /photos?tag=x,y&match=all -> find photos tagged with x AND y
 */

export async function photoRoutes(app: FastifyInstance, services: Services) {
    const {
        tagService,
        captionService,
        cacheService,
        searchService,
    } = services;

    const photoController = new PhotoController(
        app.prisma,
        new PhotoModel(app.prisma),
        tagService,
        captionService,
        cacheService,
        searchService,
    );

    // protected
    app.register(async function protectedPhotoRoutes(app) {
        app.register(userContext);

        // get photos belonging to user (optional query string)
        app.get('/photos',
            { schema: querySchema },
            photoController.findAllFromUser.bind(photoController)
        );

        // upload photos
        app.post('/photos',
            {
                validatorCompiler: () => { return data => data; },
                schema: uploadPhotoSchema
            },
            photoController.upload.bind(photoController)
        );

        // update photo tags
        app.patch<{ Params: { id: string } }>(
            '/photos/:id/tags',
            { schema: updateTagsSchema },
            photoController.updatePhotoTags.bind(photoController)
        );

        // update photo caption
        app.patch<{ Params: { id: string } }>(
            '/photos/:id/caption',
            { schema: updateCaptionSchema },
            photoController.updateCaption.bind(photoController)
        );

        // delete photo
        app.delete<{ Params: { id: string } }>(
            '/photos/:id',
            { schema: deletePhotoSchema },
            photoController.delete.bind(photoController)
        );

        // restore deleted photo
        app.patch<{ Params: { id: string } }>(
            '/photos/:id/restore',
            photoController.restore.bind(photoController)
        );
    });
}
