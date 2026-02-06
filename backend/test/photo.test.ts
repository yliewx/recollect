import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { uploadsDir, rootDir } from '@/types/constants.js';
import path from 'path';
import fs from 'fs';
import FormData from 'form-data';
import { URLSearchParams } from 'url';
import { createPhotoForm, assertPhotoUpload, getPhotos, fetchAllPhotosWithCursor } from './photo.test.utils.js';
import { PhotoPayload } from '@/models/photo.model.js';
import { debugPrintNested } from '@/utils/debug.print.js';
import { Cursor } from '@/services/paginate.utils.js';

async function createTestUser(app: FastifyInstance): Promise<string> {
    const response = await app.inject({
        method: 'POST',
        url: '/users',
        body: {
            username: `test_user_${Date.now()}`,
            email: `test_${Date.now()}@test.com`,
        },
    });

    expect(response.statusCode).to.equal(201);
    const body = response.json();
    return body.user.id;
}

type PhotoMetadata = {
    filename: string;
    caption?: string;
    tags?: string[];
};

describe('PHOTO FLOW TESTS:', () => {
    let app: any;
    let userId: string;
    let photoIds: string[] = [];
    const totalCount = 100;
    const totalLimit = 15;

    before(async function () {
        this.timeout(30_000);
        app = await buildApp();
        await app.ready();
        userId = await createTestUser(app);
    });

    after(async () => {
        await app.close();
    });

    describe('[POST /photos] -> upload multiple photos', () => {
        it('should upload 100 photos in 1 request', async () => {
            const filePaths: string[] = [];
            const metadata: PhotoMetadata[] = [];
            const captions: string[] = [
                'Cat sitting on the beach watching a golden sunset',
                'A peaceful sunset at the beach while a cat naps nearby',
                'Golden sunset over the beach with waves crashing softly',
                'Sleepy cat curled up by the window on a rainy afternoon',
                'Afternoon walk through the city with coffee and music'
            ];

            for (let i = 0; i < totalCount; i++) {
                const idx = i % 5;
                const filename = `photo_${idx}.jpg`;
                const filePath = path.join(rootDir, 'test_images', filename);
                filePaths.push(filePath);
                metadata.push({ filename, caption: captions[idx], tags: [`tag_${idx}`, 'common'] });
            }

            const CHUNK_SIZE = 10;
            for (let i = 0; i < totalCount; i += CHUNK_SIZE) {
                const filesChunk = filePaths.slice(i, i + CHUNK_SIZE);
                const metaChunk  = metadata.slice(i, i + CHUNK_SIZE);

                const form = await createPhotoForm(filesChunk, metaChunk);

                const response = await app.inject({
                    method: 'POST',
                    url: '/photos',
                    headers: { 'x-user-id': userId, ...form.getHeaders() },
                    payload: form,
                });

                assertPhotoUpload(response, uploadsDir, photoIds);
            }
            console.log(`uploaded ${photoIds.length} photos`);
            expect(photoIds).to.have.length(100);
        });
    });

    describe('[POST /photos] -> upload single photo', () => {
        it('should upload 1 photo', async () => {
            const filePath = path.join(rootDir, 'test_images', 'photo_5.jpg');
            const form = await createPhotoForm([filePath]);

            const response = await app.inject({
                method: 'POST',
                url: '/photos',
                headers: { 'x-user-id': userId, ...form.getHeaders() },
                payload: form,
            });

            assertPhotoUpload(response, uploadsDir, photoIds);
        });
    });

    describe('[GET /photos] cursor pagination', () => {
        it('returns first page with nextCursor', async () => {
            const response = await getPhotos(app, userId, { limit: totalLimit });
            expect(response.statusCode).to.equal(200);

            const body = response.json();
            expect(body.photos).to.have.length(totalLimit);
            expect(body.nextCursor).to.exist;

            // convert ids back to numbers for comparison
            const firstId = Number(body.photos[0].id);
            const secondId = Number(body.photos[1].id);
            const nextCursor = Number(body.nextCursor?.id);
            console.log('firstId:', firstId);
            console.log('secondId:', secondId);
            console.log('nextCursor:', nextCursor);

            // ordering check
            expect(firstId).to.be.greaterThan(secondId);
        });

        it('returns second page without duplicates', async () => {
            const first = await getPhotos(app, userId, { limit: totalLimit });
            const { nextCursor } = first.json();

            const second = await getPhotos(app, userId, {
                limit: totalLimit,
                cursor_id: nextCursor.id.toString(),
            });

            const page1Ids = (first.json().photos as PhotoPayload[])
                .map((p: PhotoPayload) => Number(p.id));
            const page2Ids = (second.json().photos as PhotoPayload[])
                .map((p: PhotoPayload) => Number(p.id));

            console.log('page1Ids:', page1Ids);
            console.log('page2Ids:', page2Ids);

            expect(page2Ids).to.have.length(totalLimit);

            // no overlap
            page2Ids.forEach(id => {
                expect(page1Ids).to.not.include(id);
            });
        });

        it('eventually returns empty results with no cursor', async () => {
            let cursor: Cursor | null | undefined = undefined;
            const seen = new Set<string>();

            while (true) {
                const query: Record<string, any> = { limit: totalLimit };
                if (cursor !== undefined && cursor !== null) {
                    query.cursor_id = cursor.id;
                }

                const res = await getPhotos(app, userId, query);

                const body = res.json();
                const photos = body.photos ?? [];
                const nextCursor = body.nextCursor;

                for (const p of photos) {
                    const id = String(p.id);
                    expect(seen.has(id)).to.be.false;
                    seen.add(id);
                }

                if (!nextCursor || photos.length === 0) {
                    break;
                }

                cursor = nextCursor;
            }

            expect(seen.size).to.equal(totalCount + 1);
        });

        it('orders by uploaded_at desc then id desc', async () => {
            const res = await getPhotos(app, userId, { limit: totalLimit });
            const photos = res.json().photos.map((p: PhotoPayload) => ({
                ...p,
                uploaded_at: p.uploaded_at ? new Date(p.uploaded_at) : null
            }));

            for (let i = 0; i < photos.length - 1; i++) {
                const a = photos[i];
                const b = photos[i + 1];

                if (a.uploaded_at === b.uploaded_at) {
                    expect(a.id).to.be.greaterThan(b.id);
                }
            }
        });
    });

    describe('[GET /photos] -> search by tags only', () => {
        it(`should get ${totalCount} photos tagged with "common", split into 5 pages`, async () => {
            const { pages } = await fetchAllPhotosWithCursor(app, userId, {
                limit: 20,
                totalCount,
                baseQuery: { tag: ['common'] },
            });

            expect(pages).to.equal(5);
        });

        it('should get 60 photos tagged with "tag_1", "tag_0" or "tag_4"', async () => {
            const { pages } = await fetchAllPhotosWithCursor(app, userId, {
                limit: 20,
                totalCount: 60,
                baseQuery: { tag: ['tag_1', 'tag_0', 'tag_4'], match: ['any'] },
            });

            expect(pages).to.equal(3);
        });

        it('should get 20 photos tagged with "common" AND "tag_0"', async () => {
            const { pages } = await fetchAllPhotosWithCursor(app, userId, {
                limit: 5,
                totalCount: 20,
                baseQuery: { tag: ['common', 'tag_0'], match: ['all'] },
            });

            expect(pages).to.equal(4);
        });

        it('should hit the cache for "common" AND "tag_0"', async () => {
            const { pages } = await fetchAllPhotosWithCursor(app, userId, {
                limit: 20,
                totalCount: 20,
                baseQuery: { tag: ['tag_0', 'common'], match: ['all'] },
            });

            expect(pages).to.equal(1);
        });
    });

    describe('[GET /photos] -> search by caption only', () => {
        it('should get 40 photos by caption (strict match)', async () => {
            const { pages } = await fetchAllPhotosWithCursor(app, userId, {
                limit: 20,
                totalCount: 40,
                baseQuery: {
                    caption: ['sunset beach cat'],
                    match: ['all'], // strict match
                },
            });

            expect(pages).to.equal(2);
        });

        it('should get 80 photos by caption (non-strict match)', async () => {
            const { pages } = await fetchAllPhotosWithCursor(app, userId, {
                limit: 20,
                totalCount: 80,
                baseQuery: {
                    caption: ['sunset beach cat'], // default match='any'
                },
            });

            expect(pages).to.equal(4);
        });
    });
    
    describe('[GET /photos] -> search by caption and tags', () => {
        it('should get 20 photos by caption AND tags (strict match)', async () => {
            const { pages } = await fetchAllPhotosWithCursor(app, userId, {
                limit: 7,
                totalCount: 20,
                baseQuery: {
                    caption: ['sunset beach cat'],
                    tag: ['tag_1'],
                    match: ['all']
                },
            });

            expect(pages).to.equal(3);
        });

        it('should get 100 photos by caption OR tags (non-strict match)', async () => {
            const { pages } = await fetchAllPhotosWithCursor(app, userId, {
                limit: 50,
                totalCount: 100,
                baseQuery: {
                    caption: ['sunset beach cat'],
                    tag: ['tag_1', 'tag_3', 'tag_4']
                },
            });

            expect(pages).to.equal(2);
        });
    });

    describe('[PATCH /photos/:id/caption] -> update photo caption)', () => {
        it('should update the caption', async () => {
           const response = await app.inject({
                method: 'PATCH',
                url: `/photos/${photoIds[5]}/caption`,
                headers: {
                    'x-user-id': userId,
                },
                body: {
                    caption: 'this is a test caption',
                },
            });

            expect(response.statusCode).to.equal(200);
            
            const body = response.json();
            expect(body).to.have.property('caption');
        });
    });

    describe('[PATCH /photos/:id/tags] -> update photo tags)', () => {
        it('should update the tags', async () => {
           const response = await app.inject({
                method: 'PATCH',
                url: `/photos/${photoIds[4]}/tags`,
                headers: {
                    'x-user-id': userId,
                },
                body: {
                    tags_to_insert: ['dog', 'matcha', 'coconut', 'common', 'dog'],
                    tags_to_remove: ['common', 'tag_4', 'cat']
                },
            });

            expect(response.statusCode).to.equal(200);
            
            const body = response.json();
            expect(body).to.have.property('tags');
            console.log('UPDATED TAGS:', body.tags);
        });
    });

    describe('[DELETE /photos] -> delete photo', () => {
        it('should delete a photo', async () => {
            const response = await app.inject({
                method: 'DELETE',
                url: `/photos/${photoIds[0]}`,
                headers: {
                    'x-user-id': userId,
                },
            });

            expect(response.statusCode).to.equal(200);
        });

        it('should restore the deleted photo', async () => {
            const response = await app.inject({
                method: 'PATCH',
                url: `/photos/${photoIds[0]}/restore`,
                headers: {
                    'x-user-id': userId,
                },
            });

            expect(response.statusCode).to.equal(200);
            const body = response.json();
            expect(body).to.have.property('photo');
        });
    });
});
