import fp from 'fastify-plugin';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fs from 'fs';
import { uploadsDir } from '@/types/constants.js';

export default fp(async function configUploads(app: FastifyInstance) {
    app.register(fastifyMultipart, {
        limits: {
            fieldNameSize: 100,
            fieldSize: 10000, // max 10kb for json metadata
            fields: 10,
            fileSize: 10000000, // max 10mb per file
            files: 10, // max 10 files per request
            headerPairs: 2000,
            parts: 1000
        }
    });

    fs.mkdirSync(uploadsDir, { recursive: true });

    app.register(fastifyStatic, {
        root: uploadsDir, // specifies the directory to serve files from
        prefix: '/uploads/'
    });
});
