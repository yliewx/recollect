import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import connectPrisma from './plugins/prisma.js';
import connectRedis from './plugins/redis.js'
import configUploads from './plugins/uploads.js';
import setErrorReply from './plugins/reply.error.js';
import setBigIntHandler from './plugins/bigint.handler.js';
import configSwagger from './plugins/swagger.js';
import { userRoutes } from './routes/user.routes.js';
import { photoRoutes } from './routes/photo.routes.js';
import { albumRoutes } from './routes/album.routes.js';
import { Services } from './types/search.js';
import { TagService } from '@/services/tag.service.js';
import { CacheService } from './services/cache.service.js';
import { CaptionService } from './services/caption.service.js';
import { SearchService } from './services/search.service.js';
import { PhotoModel } from './models/photo.model.js';

/**========================================================================
 **                           BUILD APP
 *? creates an instance of the app with routes & plugins registered
 *? separate from server logic to enable component testing
 *@param options: fastify options object; default = empty
 *@return app: fastify instance
 *========================================================================**/

export async function buildApp(options = {}): Promise<FastifyInstance> {
    const app = Fastify(options);

    // register prisma and connect to postgres db
    await app.register(connectPrisma);

    // register redis
    await app.register(connectRedis);

    // handle file uploads
    app.register(configUploads);

    // register error handler for requests
    app.register(setErrorReply);

    // handle conversion of bigint (IDs) to string in responses
    app.register(setBigIntHandler);

    // register swagger
    app.register(configSwagger);

    // init shared services
    const tagService = new TagService(app.prisma);
    const captionService = new CaptionService(app.prisma);
    const cacheService = new CacheService(app.redis);

    const services: Services = {
        tagService,
        captionService,
        cacheService,
        searchService: new SearchService(
            new PhotoModel(app.prisma),
            captionService,
            cacheService
        )
    }

    // define application routes
    app.register(userRoutes);
    app.register(photoRoutes, services);
    app.register(albumRoutes, services);

    app.get('/', function (request: FastifyRequest, reply: FastifyReply) {
        reply.send({ hello: 'world' })
    });

    return app;
}