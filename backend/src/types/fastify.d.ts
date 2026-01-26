/**========================================================================
 * *                      TYPE DECLARATIONS: FASTIFY
 * 
 *   - extends fastify to include custom definitions
 *========================================================================**/

import { PrismaClient } from '@/generated/prisma/client.js';

declare module 'fastify' {
    interface FastifyInstance {
        prisma: PrismaClient;
    }

    interface FastifyReply {
        sendError(error: any, status?: number): FastifyReply;
    }

    interface FastifyRequest {
        user: {
            id: bigint;
        };
    }
}
