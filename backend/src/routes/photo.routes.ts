import { FastifyInstance } from 'fastify';
import { PhotoModel } from '@/models/photo.model.js';
import { PhotoController } from '@/controllers/photo.controller.js';
import userContext from '@/plugins/user.context.js';
import { TagService } from '@/services/tag.service.js';
import { CaptionService } from '@/services/caption.service.js';

/* define query parameters and types
eg.
    /photos?caption=x
    /photos?tag=y
    /photos?caption=x&tag=y

    /photos?tag=x,y&match=any -> (default) find photos tagged with x OR y
    /photos?tag=x,y&match=all -> find photos tagged with x AND y
 */
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
        }
    }
};

export async function photoRoutes(app: FastifyInstance) {
    const photoModel = new PhotoModel(app.prisma);
    const tagService = new TagService(app.prisma);
    const captionService = new CaptionService(app.prisma);
    const photoController = new PhotoController(photoModel, tagService, captionService);

    // protected
    app.register(async function protectedPhotoRoutes(app) {
        app.register(userContext);

        // get photos belonging to user (optional query string)
        app.get('/photos', { schema: querySchema },
            photoController.findAllFromUser.bind(photoController)
        );

        // upload photos
        app.post('/photos', photoController.upload.bind(photoController));
        app.delete<{ Params: { id: bigint } }>(
            '/photos/:id',
            photoController.delete.bind(photoController)
        );
    });
}
