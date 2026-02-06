import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';

export default fp(async function configSwagger(app: FastifyInstance) {
    // Generates the OpenAPI document from route schemas
    await app.register(swagger, {
        openapi: {
            info: {
                title: 'Photo App API',
                description: 'API documentation for the Photo App',
                version: '1.0.0',
            },
            // IMPORTANT: set to whatever your browser uses to reach the API
            // If you access backend at http://localhost:3000, keep this:
            servers: [{ url: 'http://localhost:3000' }],
            components: {
                securitySchemes: {
                    // Your userContext likely reads `x-user-id`.
                    // This makes Swagger UI show an "Authorize" button.
                    userIdHeader: {
                        type: 'apiKey',
                        name: 'x-user-id',
                        in: 'header',
                    },
                },
            },
            // Apply auth globally (can override per-route)
            security: [{ userIdHeader: [] }],
        },
    });

    // Serves the Swagger UI
    await app.register(swaggerUI, {
        routePrefix: '/docs',
        staticCSP: true,
        uiConfig: {
            docExpansion: 'list',
            deepLinking: true,
        },
    });

    // Optional: nice for debugging / linking
    app.get('/docs/openapi.json', async () => app.swagger());
});