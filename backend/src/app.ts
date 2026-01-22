import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import addDbPool from './plugins/pool.js';
import { userRoutes } from './routes/user.routes.js';

/**========================================================================
 **                           BUILD APP
 *? creates an instance of the app with routes & plugins registered
 *? separate from server logic to enable component testing
 *@param options: fastify options object; default = empty
 *@return app: fastify instance
 *========================================================================**/

export function buildApp(options = {}) {
    const app = Fastify(options);

    // register postgres connection pool
    app.register(addDbPool);

    // define application routes (placeholder)
    app.register(userRoutes);
    app.get('/', function (request: FastifyRequest, reply: FastifyReply) {
        reply.send({ hello: 'world' })
    });

    return app;
}