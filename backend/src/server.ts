import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { buildApp } from './app.js';

const server = buildApp({
    logger: {
        level: 'info',
        transport: {
            target: 'pino-pretty'
        }
    }
});

// start server
const start = async () => {
    try {
        await server.listen({ port: 3000, host: '0.0.0.0' });
        console.log('Server listening at http://0.0.0.0:3000');
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();