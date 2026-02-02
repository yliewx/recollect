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

const updateTagsSchema = {
    body: {
        type: 'object',
        properties: {
            tags_to_insert: {
                type: 'array',
                items: { type: 'string' },
            },
            tags_to_remove: {
                type: 'array',
                items: { type: 'string' },
            },
        },
        additionalProperties: false,
        anyOf: [
            { required: ['tags_to_insert'] },
            { required: ['tags_to_remove'] },
        ],
    }
};

const updateCaptionSchema = {
    body: {
        type: 'object',
        properties: {
            caption: { type: 'string' },
        },
        required: ['caption'],
        additionalProperties: false,
    }
};

export async function photoRoutes(app: FastifyInstance) {
    const photoModel = new PhotoModel(app.prisma);
    const tagService = new TagService(app.prisma);
    const captionService = new CaptionService(app.prisma);
    const photoController = new PhotoController(
        app.prisma,
        photoModel,
        tagService,
        captionService
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
        app.post('/photos', photoController.upload.bind(photoController));

        // update photo tags
        app.patch<{ Params: { id: bigint } }>(
            '/photos/:id/tags',
            { schema: updateTagsSchema },
            photoController.updatePhotoTags.bind(photoController)
        );

        // update photo caption
        app.patch<{ Params: { id: bigint } }>(
            '/photos/:id/caption',
            { schema: updateCaptionSchema },
            photoController.updateCaption.bind(photoController)
        );

        // delete photo
        app.delete<{ Params: { id: bigint } }>(
            '/photos/:id',
            photoController.delete.bind(photoController)
        );

        // restore deleted photo
        app.patch<{ Params: { id: bigint } }>(
            '/photos/:id/restore',
            photoController.restore.bind(photoController)
        );
    });
}
