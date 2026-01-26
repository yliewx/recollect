import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import connectPrisma from './plugins/prisma.js';
import setUploadsDir from './plugins/uploads.js';
import setErrorReply from './plugins/reply.error.js';
import setBigIntHandler from './plugins/bigint.handler.js';
import { userRoutes } from './routes/user.routes.js';
import { photoRoutes } from './routes/photo.routes.js';

/**========================================================================
 **                           BUILD APP
 *? creates an instance of the app with routes & plugins registered
 *? separate from server logic to enable component testing
 *@param options: fastify options object; default = empty
 *@return app: fastify instance
 *========================================================================**/

export function buildApp(options = {}): FastifyInstance {
    const app = Fastify(options);

    // register prisma and connect to postgres db
    app.register(connectPrisma);

    // handle file uploads
    app.register(setUploadsDir);

    // register error handler for requests
    app.register(setErrorReply);

    // handle conversion of bigint (IDs) to string in responses
    app.register(setBigIntHandler);

    // define application routes (placeholder)
    app.register(userRoutes);
    app.register(photoRoutes);
    app.get('/', function (request: FastifyRequest, reply: FastifyReply) {
        reply.send({ hello: 'world' })
    });

    return app;
}