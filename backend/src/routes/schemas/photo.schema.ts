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
        asset_id: { type: 'string' },
        uploaded_at: { type: 'string' },
        deleted_at: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        caption: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        tags: { type: 'array', items: { type: 'string' } },
        width: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
        height: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
        size_bytes: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    },
    required: ['id', 'uploaded_at'],
    additionalProperties: false,
};

/**============================================
 *               POST /photos
 *=============================================**/
export const uploadPhotoSchema = {
    tags: ['Photos'],
    summary: 'Register photos from the device photo library',
    description: 'Register one or more photos by local device asset_id (no file upload; single-device prototype scope)',
    security: [{ userIdHeader: [] }],
    body: {
        type: 'object',
        properties: {
            items: {
                description: 'Assets to register. Already-registered asset_ids for this user are skipped.',
                type: 'array',
                minItems: 1,
                items: {
                    type: 'object',
                    properties: {
                        asset_id: { type: 'string', description: 'Local device asset identifier (e.g. PHAsset localIdentifier)' },
                        caption: { type: 'string', maxLength: 200 },
                        tags: { type: 'array', items: { type: 'string', maxLength: 30 } },
                        width: { type: 'integer', minimum: 1, description: 'Image width in pixels' },
                        height: { type: 'integer', minimum: 1, description: 'Image height in pixels' },
                        size_bytes: { type: 'integer', minimum: 1, description: 'Image file size in bytes' },
                        embedding: {
                            type: 'array',
                            description:
                                'On-device visual feature print (VNGenerateImageFeaturePrintRequest). ' +
                                'Length is not fixed -- it depends on iOS version/device -- so no exact ' +
                                'size is enforced here; mismatched-dimension photos are simply excluded ' +
                                'from similarity results by the backend.',
                            items: { type: 'number' },
                            minItems: 1,
                            maxItems: 8192,
                        },
                    },
                    required: ['asset_id'],
                    additionalProperties: false,
                },
                examples: [
                    JSON.stringify(
                        [{ asset_id: '48F3C1B2-...-IMG_0421.HEIC/L0/001', caption: 'hello', tags: ['tag_1', 'common'] }],
                        null,
                        2
                    ),
                ],
            },
        },
        required: ['items'],
        additionalProperties: false,
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
            sort_by: {
                type: 'string',
                enum: ['uploaded_at', 'dimensions', 'size_bytes'],
                default: 'uploaded_at',
                description:
                    'Field to sort by. "dimensions" sorts by width then height. ' +
                    'Ignored when a caption search is active -- those results are always ranked by relevance.',
            },
            order: {
                type: 'string',
                enum: ['asc', 'desc'],
                default: 'desc',
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

/**============================================
 *          GET /photos/:id/similar
 *=============================================**/
export const similarPhotosSchema = {
    tags: ['Photos'],
    summary: 'Find visually similar photos',
    description:
        'Returns other photos in the same user\'s library ranked by visual similarity to the given photo, ' +
        'using the on-device embedding captured at import time. Photos with no embedding never appear as ' +
        'the anchor or as a match.',
    security: [{ userIdHeader: [] }],
    ...idParamSchema,
    querystring: {
        type: 'object',
        properties: {
            limit: {
                type: 'integer',
                minimum: 1,
                maximum: 50,
                default: 20,
            },
        },
        additionalProperties: false,
    },
    response: {
        200: {
            type: 'object',
            properties: {
                photos: { type: 'array', items: photoPayloadSchema },
                count: { type: 'integer' },
            },
            required: ['photos', 'count'],
            additionalProperties: false,
        },
    },
};
