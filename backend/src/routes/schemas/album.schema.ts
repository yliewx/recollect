import { idParamSchema, photoPayloadSchema } from "./photo.schema.js";

const albumSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        user_id: { type: 'string' },
        title: { type: 'string', minLength: 1, maxLength: 30 },
        created_at: { type: 'string' },
        updated_at: { type: 'string' },
        deleted_at: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    },
    additionalProperties: true,
};

/**============================================
 *            GET /albums/:id/photos
 *=============================================**/
export const queryAlbumSchema = {
    tags: ['Albums'],
    summary: 'List photos belonging to an album (optionally filter by tags/caption)',
    description:
        'Returns album photos belonging to the authenticated user. Supports tag filtering and caption search with cursor pagination.',
    security: [{ userIdHeader: [] }],
    querystring: {
        type: 'object',
        properties: {
            tag: {
                type: 'string',
                description: 'Comma-separated tags'
            },
            caption: {type: 'string', maxLength: 50 },
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
            cursor_rank: {
                type: 'number',
                description: 'For caption FTS pagination'
            },
            cursor_id: {
                type: 'string',
                description: 'Cursor photo id (stringified bigint)'
            },
        },
        additionalProperties: false,
    },
    response: {
        200: {
        type: 'object',
        properties: {
            photos: { type: 'array', items: photoPayloadSchema },
            nextCursor: {
            anyOf: [
                { type: 'null' },
                {
                    type: 'object',
                    properties: {
                        rank: { type: 'number' },
                        id: { type: 'string' },
                    },
                    required: ['id'],
                    additionalProperties: false,
                },
            ],
            },
        },
        required: ['photos', 'nextCursor'],
        additionalProperties: false,
        },
    },
};

/**============================================
 *                POST /albums
 *=============================================**/
export const createAlbumSchema = {
    tags: ['Albums'],
    summary: 'Create an album',
    security: [{ userIdHeader: [] }],
    body: {
        type: 'object',
        properties: {
            title: { type: 'string', minLength: 1, maxLength: 30 },
        },
        required: ['title'],
        additionalProperties: false,
    },
    response: {
        201: {
            type: 'object',
            properties: {
                album: albumSchema,
            },
            required: ['album'],
            additionalProperties: false,
        },
    }
};

/**============================================
 *                GET /albums
 *=============================================**/
export const listAlbumsSchema = {
    tags: ['Albums'],
    summary: 'List user albums',
    security: [{ userIdHeader: [] }],
    response: {
        200: {
            type: 'object',
            properties: {
                albums: { type: 'array', items: albumSchema },
            },
            required: ['albums'],
            additionalProperties: false,
        },
    }
};

/**============================================
 *           POST /albums/:id/photos
 *=============================================**/
export const addAlbumPhotosSchema = {
    tags: ['Albums'],
    summary: 'Add photos to album',
    security: [{ userIdHeader: [] }],
    ...idParamSchema,
    body: {
        type: 'object',
        properties: {
            photo_ids: {
                type: 'array',
                items: { type: 'string', minLength: 1, maxLength: 20 },
                minItems: 1,
                maxItems: 100,
            },
        },
        required: ['photo_ids'],
        additionalProperties: false,
    },
    response: {
        200: {
            type: 'object',
            properties: {
                count: { type: 'integer' },
            },
            required: ['count'],
            additionalProperties: false,
        },
    },
};

/**============================================
 *          DELETE /albums/:id/photos
 *=============================================**/
export const deleteAlbumPhotosSchema = {
    tags: ['Albums'],
    summary: 'Remove photos from album',
    security: [{ userIdHeader: [] }],
    ...idParamSchema,
    body: {
        type: 'object',
        properties: {
            photo_ids: {
                type: 'array',
                items: { type: 'string', minLength: 1, maxLength: 20 },
                minItems: 1,
                maxItems: 100,
            },
        },
        required: ['photo_ids'],
        additionalProperties: false,
    },
    response: {
        200: {
            type: 'object',
            properties: {
                count: { type: 'integer' },
            },
            required: ['removed'],
            additionalProperties: false,
        },
    },
};

/**============================================
 *             DELETE /albums/:id
 *=============================================**/
export const deleteAlbumSchema = {
    tags: ['Albums'],
    summary: 'Delete album',
    security: [{ userIdHeader: [] }],
    ...idParamSchema,
    response: {
        200: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
            },
            required: ['success'],
            additionalProperties: false,
        },
    },
};

/**============================================
 *          PATCH /albums/:id/restore
 *=============================================**/
export const restoreAlbumSchema = {
    tags: ['Albums'],
    summary: 'Restore deleted album',
    security: [{ userIdHeader: [] }],
    ...idParamSchema,
    response: {
        200: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
            },
            required: ['success'],
            additionalProperties: false,
        },
    },
};

/**============================================
 *             PATCH /albums/:id
 *=============================================**/
export const renameAlbumSchema = {
    tags: ['Albums'],
    summary: 'Rename album',
    security: [{ userIdHeader: [] }],
    ...idParamSchema,
    body: {
        type: 'object',
        properties: {
            title: { type: 'string', minLength: 1, maxLength: 30 },
        },
        required: ['title'],
        additionalProperties: false,
    },
    response: {
        200: {
            type: 'object',
            properties: {
                album: albumSchema,
            },
            required: ['album'],
            additionalProperties: false,
        },
    },
};
