import { uploadsDir } from '@/types/constants.js';
import { FastifyRequest } from 'fastify';
import { pipeline } from 'stream/promises';
import path from 'path';
import fs from 'fs';

const validFileTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
];

export async function uploadPhotos(request: FastifyRequest) {
    // handle multipart form data
    const parts = request.parts();
    const file_paths: string[] = [];

    for await (const part of parts) {
        if (part.type === 'file') {
            // validate filetype
            console.log('filename:', part.filename);
            console.log('mimetype:', part.mimetype);
            console.log();
            if (!validFileTypes.includes(part.mimetype)) {
                throw new Error(`Unsupported file type: ${part.mimetype}`);
            }

            // generate unique filename
            const ext = path.extname(part.filename);
            const fileName = crypto.randomUUID() + ext;
            const uploadPath = path.join(uploadsDir, fileName);
            console.log('uploadPath:', uploadPath);

            // write image to uploads directory
            await pipeline(part.file, fs.createWriteStream(uploadPath));
            file_paths.push(fileName);
        }
    }
    return file_paths;
}
