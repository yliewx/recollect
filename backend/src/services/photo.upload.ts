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

interface UploadFile {
    original_filename: string;
    upload_name: string;
}

interface UploadMetadata {
    filename: string;
    caption?: string;
    tags?: string[];
}

export interface PhotoData {
    file_path: string;
    caption?: string;
    tags?: string[];
}

export type InsertedPhotoData = PhotoData & { photo_id: bigint };

async function parseFiles(part: any): Promise<UploadFile> {
    // generate unique filename
    const ext = path.extname(part.filename);
    const uploadName = crypto.randomUUID() + ext;
    const uploadPath = path.join(uploadsDir, uploadName);
    // console.log('uploadName:', uploadName);
    // console.log('uploadPath:', uploadPath);

    // write image to uploads directory
    await pipeline(part.file, fs.createWriteStream(uploadPath));
    
    return {
        original_filename: part.filename,
        upload_name: uploadName
    };
}

async function parseMetadata(
    files: UploadFile[],
    metadata: UploadMetadata[]
): Promise<PhotoData[]> {
    // map original filename -> metadata object
    const metaByFilename = new Map(
        metadata.map(meta => [meta.filename, meta])
    );

    // create a new array combining photo upload_name, caption and tags
    const result = files.map(file => {
        const meta = metaByFilename.get(file.original_filename);
        return {
            file_path: file.upload_name,
            caption: meta?.caption ?? undefined,
            tags: meta?.tags ?? []
        };
    });
    return result;
}

export async function uploadPhotos(request: FastifyRequest): Promise<PhotoData[]> {
    // handle multipart form data
    const parts = request.parts();
    const uploadFiles: UploadFile[] = [];
    let uploadMetadata: UploadMetadata[] = [];

    for await (const part of parts) {
        if (part.type === 'file') {
            if (!validFileTypes.includes(part.mimetype)) {
                throw new Error(`Unsupported file type: ${part.mimetype}`);
            }
            uploadFiles.push(await parseFiles(part));
        }
        if (part.type === 'field' && part.fieldname === 'metadata') {
            if (typeof part.value !== 'string' && !Buffer.isBuffer(part.value)) {
                throw new Error('Metadata must be a string or buffer');
            }
            const valueStr = Buffer.isBuffer(part.value)
                ? part.value.toString('utf-8')
                : part.value;

            const meta = JSON.parse(valueStr).items ?? [];
            if (meta.length > 0) {
                uploadMetadata.push(... meta);
            }
        }
    }
    return await parseMetadata(uploadFiles, uploadMetadata);
}
