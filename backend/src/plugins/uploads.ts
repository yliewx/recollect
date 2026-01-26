import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fs from 'fs';
import { uploadsDir } from '@/types/constants.js';

export default fp(async function setUploadsDir(app: FastifyInstance) {
    app.register(fastifyMultipart, {
        limits: {
            fieldNameSize: 100,
            fieldSize: 100,
            fields: 10,
            fileSize: 10000000, // max 10mb
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
