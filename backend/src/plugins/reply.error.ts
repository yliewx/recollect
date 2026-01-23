import fp from 'fastify-plugin';
import { FastifyInstance, FastifyReply } from 'fastify';

// helper for sending default error responses for requests
export default fp(async function setErrorHandler(app: FastifyInstance) {
    app.decorateReply('sendError', function sendError(
        this: FastifyReply,
        error: any,
        status = 400
    ) {
        return this.status(status).send({
            success: false,
            error: error instanceof Error ? error.message : error
        });
    })
});