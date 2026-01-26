import fp from 'fastify-plugin';
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { parseBigInt } from './bigint.handler.js';

// extract user id from request header
export default fp(async function userContext(app: FastifyInstance) {
    app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
        const userId = request.headers['x-user-id'];

        if (!userId || Array.isArray(userId)) {
            reply.sendError('X-User-Id header required');
            return;
        }

        try {
            request.user = { id: parseBigInt(userId, 'X-User-Id') };
        } catch (err) {
            reply.sendError(err);
        }
    });
});
