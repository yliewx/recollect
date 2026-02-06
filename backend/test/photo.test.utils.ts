import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { expect } from 'chai';
import { PhotoPayload } from '@/models/photo.model.js';
import { Cursor } from '@/services/paginate.utils.js';

type PhotoMetadata = {
    filename: string;
    caption?: string;
    tags?: string[];
};

// helper to create a FormData instance for uploading photos
export async function createPhotoForm(files: string[], metadata?: PhotoMetadata[]) {
    const form = new FormData();

    if (metadata) {
        form.append('metadata', JSON.stringify({ items: metadata }));
    }

    for (const filePath of files) {
        form.append('file', fs.createReadStream(filePath));
    }

    return form;
}

// helper to assert a successful photo upload
export function assertPhotoUpload(response: any, uploadsDir: string, photoIds: string[]) {
    expect(response.statusCode).to.equal(201);

    const body = response.json();
    expect(body).to.have.property('photos');
    expect(Array.isArray(body.photos)).to.be.true;

    // check that each image was saved to /uploads
    for (const photo of body.photos) {
        expect(photo).to.have.property('id');
        expect(photo).to.have.property('file_path');
        expect(
            fs.existsSync(
                path.join(uploadsDir, photo.file_path)
            )
        ).to.be.true;

        photoIds.push(photo.id);
    }
    return body.photos;
}

// helper to perform GET /photos with optional query params
export async function getPhotos(app: any, userId: string, query?: any) {
    let url = '/photos';
    if (query) {
        const queryString = new URLSearchParams(query).toString();
        url += `?${queryString}`;
    }

    return app.inject({
        method: 'GET',
        url,
        headers: { 'x-user-id': userId },
    });
}

// helper to perform GET /albums/:id/photos with optional query params
export async function getAlbumPhotos(app: any, userId: string, albumId: string, query?: any) {
    let url = `/albums/${albumId}/photos`;
    if (query) {
        const queryString = new URLSearchParams(query).toString();
        url += `?${queryString}`;
    }

    return app.inject({
        method: 'GET',
        url,
        headers: { 'x-user-id': userId },
    });
}

// helper to perform GET /photos with cursor pagination
type FetchAllPhotosOptions = {
    limit: number;
    totalCount: number;
    baseQuery?: Record<string, any>;
};

export async function fetchAllPhotosWithCursor(
    app: any,
    userId: string,
    {
        limit,
        totalCount,
        baseQuery = {},
    }: FetchAllPhotosOptions
) {
    let cursor: Cursor | null = null;
    const seen = new Set<string>();
    let page = 0;

    while (true) {
        const query: Record<string, any> = {
            ...baseQuery,
            limit,
        };

        if (cursor !== null) {
            query.cursor_id = cursor.id;
            if (cursor.rank !== undefined && cursor.rank !== null) {
                query.cursor_rank = cursor.rank;
            }
        }

        const res = await getPhotos(app, userId, query);
        expect(res.statusCode).to.equal(200);

        const body = res.json();
        const photos = body.photos ?? [];
        const nextCursor = body.nextCursor;

        const pageIds = (body.photos as PhotoPayload[])
            .map((p: PhotoPayload) => Number(p.id));
        console.log(`page [${page}] ids`, pageIds);
        console.log('next cursor:', nextCursor);

        // ensure page size never exceeds limit
        expect(photos.length, `page ${page} exceeded limit`).to.be.at.most(limit);

        if (nextCursor !== null) {
            expect(
                photos.length,
                `page ${page} returned empty but nextCursor exists`
            ).to.be.greaterThan(0);
        }
        
        // check uniqueness
        for (const p of photos) {
            const id = String(p.id);
            expect(seen.has(id), `duplicate photo id ${id}`).to.be.false;
            seen.add(id);
        }

        if (nextCursor === null) break;

        cursor = nextCursor;
        page++;
    }

    // check total count
    expect(seen.size, `expected ${totalCount} photos, got ${seen.size}`).to.equal(totalCount);

    return {
        totalPhotos: seen.size,
        pages: page,
    };
}