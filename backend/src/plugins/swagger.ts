import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';

export default fp(async function configSwagger(app: FastifyInstance) {
    await app.register(swagger, {
        openapi: {
            info: {
                title: 'Recollect',
                description: 'API documentation for Recollect',
                version: '1.0.0',
            },
            servers: [{ url: 'http://localhost:3000' }],
            components: {
                securitySchemes: {
                    // enable user id authentication
                    userIdHeader: {
                        type: 'apiKey',
                        name: 'x-user-id',
                        in: 'header',
                    },
                },
            },
            security: [{ userIdHeader: [] }],
        },
    });

    // serve swagger ui
    await app.register(swaggerUI, {
        routePrefix: '/docs',
        staticCSP: true,
        uiConfig: {
            docExpansion: 'list',
            deepLinking: true,
        },
    });
});