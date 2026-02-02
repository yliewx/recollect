import fp from 'fastify-plugin';
import redis from '@fastify/redis';
import { FastifyInstance } from 'fastify';

export default fp(async function connectRedis(app: FastifyInstance) {
    await app.register(redis, {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
        db: Number(process.env.REDIS_DB ?? 0),
    });
});
