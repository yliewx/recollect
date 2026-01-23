import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import connectDb from './plugins/pool.js';
import setErrorHandler from './plugins/reply.error.js';
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

    // register postgres connection pool
    app.register(connectDb);

    // register error handler for requests
    app.register(setErrorHandler);

    // define application routes (placeholder)
    app.register(userRoutes);
    app.register(photoRoutes);
    app.get('/', function (request: FastifyRequest, reply: FastifyReply) {
        reply.send({ hello: 'world' })
    });

    return app;
}