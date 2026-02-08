// src/schemas/user.schema.ts (or inline in routes)

export const createUserSchema = {
    tags: ['Users'],
    summary: 'Create user',
    description: 'Creates a new user account.',
    body: {
        type: 'object',
        properties: {
            username: { type: 'string', minLength: 1, maxLength: 50 },
            email: { type: 'string', format: 'email', maxLength: 50 },
        },
        required: ['username', 'email'],
        additionalProperties: false,
    },
    response: {
        201: {
            type: 'object',
            properties: {
                user: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'BigInt serialized as string' },
                    username: { type: 'string' },
                    email: { type: 'string' },
                    created_at: { type: 'string' },
                },
                required: ['id', 'username', 'email'],
                additionalProperties: true,
                },
            },
            required: ['user'],
            additionalProperties: false,
        },
        400: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                error: { type: 'string' },
            },
            required: ['success', 'error'],
            additionalProperties: true,
        },
    },
};

export const deleteUserSchema = {
    tags: ['Users'],
    summary: 'Delete current user',
    description: 'Deletes the currently authenticated user.',
    security: [{ userIdHeader: [] }],
    response: {
        200: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
            },
            required: ['success'],
            additionalProperties: false,
        },
        400: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                error: { type: 'string' },
            },
            required: ['success', 'error'],
            additionalProperties: true,
        },
    },
};
