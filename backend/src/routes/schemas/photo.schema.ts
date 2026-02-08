// take photo_id or album_id as params
// request: string -> controller: convert to bigint
export const idParamSchema = {
    params: {
        type: 'object',
        properties: {
            id: {
                type: 'string',
                description: 'Photo ID (BigInt serialized as string)',
                pattern: '^[0-9]+$',
            },
        },
        required: ['id'],
        additionalProperties: false,
    },
};

export const photoPayloadSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        user_id: { type: 'string' },
        filename: { type: 'string' },
        uploaded_at: { type: 'string' },
        deleted_at: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        caption: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        tags: { type: 'array', items: { type: 'string' } },
        url: { type: 'string', format: 'uri' }, // image url for display
    },
    required: ['id', 'url', 'uploaded_at'],
    additionalProperties: false,
};

/**============================================
 *               POST /photos
 *=============================================**/
export const uploadPhotoSchema = {
    tags: ['Photos'],
    summary: 'Upload photos',
    description: 'Upload one or more photos using multipart/form-data',
    security: [{ userIdHeader: [] }],
    consumes: ['multipart/form-data'],
    body: {
        type: 'object',
        properties: {
            files: {
                description: 'Photo files to upload (max 10 files). Must be in the same order as `metadata`.',
                type: 'array',
                items: { type: 'string', format: 'binary' },
            },
            metadata: {
                type: 'string',
                description: `
                    JSON string representing metadata for each uploaded file.
                    Must be an array with the same order as \`files\`.

                    Example:
                    [
                        { "caption": "hello", "tags": ["tag_1","common"] },
                        { "caption": "world", "tags": ["tag_2","common"] },
                        { "caption": "cat", "tags": ["tag_3","pets","common"] }
                    ]
                `.trim(),
                examples: [
                    JSON.stringify(
                        [{ caption: 'hello', tags: ['tag_1','common'] }],
                        null,
                        2
                    ),
                        JSON.stringify(
                        [{ caption: 'world', tags: ['tag_2','common'] }],
                        null,
                        2
                    ),
                ],
            },
        },
        required: ['files'],
    },
    response: {
        201: {
            type: 'object',
            properties: {
                count: { type: 'integer' },
                photos: { type: 'array', items: photoPayloadSchema },
            },
            required: ['photos'],
            additionalProperties: false,
        },
    },
} 

/**============================================
 *               DELETE /photos
 *=============================================**/
export const deletePhotoSchema = {
    tags: ['Photos'],
    summary: 'Delete photo',
    security: [{ userIdHeader: [] }],
    ...idParamSchema,
    response: {
        200: {
            type: 'object',
            properties: { success: { type: 'boolean' } },
            required: ['success'],
            additionalProperties: false,
        },
    },
}

/**============================================
 *          PATCH /photos/:id/restore
 *=============================================**/
export const restorePhotoSchema = {
    tags: ['Photos'],
    summary: 'Restore deleted photo',
    security: [{ userIdHeader: [] }],
    ...idParamSchema,
    response: {
        200: {
            type: 'object',
            properties: { success: { type: 'boolean' } },
            required: ['success'],
            additionalProperties: false,
        },
    },
}

/**============================================
 *               GET /photos
 *=============================================**/
export const querySchema = {
    tags: ['Photos'],
    summary: 'List photos (optionally filter by tags/caption)',
    description:
        'Returns photos belonging to the authenticated user. Supports tag filtering and caption search with cursor pagination.',
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
 *           PATCH /photos/:id/tags
 *=============================================**/
export const updateTagsSchema = {
    tags: ['Photos'],
    summary: 'Update photo tags',
    security: [{ userIdHeader: [] }],
    ...idParamSchema,
    body: {
        type: 'object',
        properties: {
        tags_to_insert: {
            type: 'array',
            items: { type: 'string', maxLength: 30 },
            maxItems: 10,
        },
        tags_to_remove: {
            type: 'array',
            items: { type: 'string', maxLength: 30 },
            maxItems: 10,
        },
        },
        additionalProperties: false,
        anyOf: [{ required: ['tags_to_insert'] }, { required: ['tags_to_remove'] }],
    },
    response: {
        200: {
        type: 'object',
        properties: {
            photo_id: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['photo_id', 'tags'],
        additionalProperties: false,
        },
    },
};

/**============================================
 *          PATCH /photos/:id/caption
 *=============================================**/
export const updateCaptionSchema = {
    tags: ['Photos'],
    summary: 'Update photo caption',
    security: [{ userIdHeader: [] }],
    ...idParamSchema,
    body: {
        type: 'object',
        properties: {
            caption: { type: 'string', maxLength: 200 },
        },
        required: ['caption'],
        additionalProperties: false,
    },
    response: {
        200: {
        type: 'object',
        properties: {
            photo_id: { type: 'string' },
            caption: { type: 'string' },
        },
        required: ['photo_id', 'caption'],
        additionalProperties: false,
        },
    },
};
