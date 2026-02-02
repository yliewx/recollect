import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { uploadsDir, rootDir } from '@/types/constants.js';
import path from 'path';
import fs from 'fs';
import FormData from 'form-data';
import { URLSearchParams } from 'url';
import { createPhotoForm, assertPhotoUpload, getPhotos } from './photo.test.utils.js';
import { PhotoWithMetadata } from '@/models/photo.model.js';

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

    before(async function () {
        this.timeout(30_000);
        app = buildApp();
        await app.ready();
        userId = await createTestUser(app);
        console.log('[photo.test] userId', userId);
    });

    after(async () => {
        await app.close();
    });

    describe('[POST /photos] -> upload multiple photos', () => {
        it('should upload 5 photos in 1 request', async () => {
            const filePaths: string[] = [];
            const metadata: PhotoMetadata[] = [];
            const captions: string[] = [
                'Cat sitting on the beach watching a golden sunset',
                'A peaceful sunset at the beach while a cat naps nearby',
                'Golden sunset over the beach with waves crashing softly',
                'Sleepy cat curled up by the window on a rainy afternoon',
                'Afternoon walk through the city with coffee and music'
            ];

            for (let i = 0; i < 5; i++) {
                const filename = `photo_${i}.jpg`;
                const filePath = path.join(rootDir, 'test_images', filename);
                filePaths.push(filePath);
                metadata.push({ filename, caption: captions[i], tags: [`tag_${i}`, 'common'] });
            }

            const form = await createPhotoForm(filePaths, metadata);

            const response = await app.inject({
                method: 'POST',
                url: '/photos',
                headers: { 'x-user-id': userId, ...form.getHeaders() },
                payload: form,
            });
            
            assertPhotoUpload(response, uploadsDir, photoIds);
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

    // describe('[GET /photos] -> get all photos', () => {
    //     it('should get all photos (currently 6)', async () => {
    //         const response = await getPhotos(app, userId);
    //         expect(response.statusCode).to.equal(200);

    //         const body = response.json();
    //         expect(body).to.have.property('photos');
    //         expect(Array.isArray(body.photos)).to.be.true;
    //         expect(body.photos.length).to.equal(6);
    //     });
    // });

    describe('[GET /photos] cursor pagination', () => {
        it('returns first page with nextCursor', async () => {
            const response = await getPhotos(app, userId, { limit: 2 });
            expect(response.statusCode).to.equal(200);

            const body = response.json();
            expect(body.photos).to.have.length(2);
            expect(body.nextCursor).to.exist;

            // convert ids back to numbers for comparison
            const firstId = Number(body.photos[0].id);
            const secondId = Number(body.photos[1].id);
            const nextCursor = Number(body.nextCursor);
            console.log('firstId:', firstId);
            console.log('secondId:', secondId);
            console.log('nextCursor:', nextCursor);

            // ordering check
            expect(firstId).to.be.greaterThan(secondId);
        });

        it('returns second page without duplicates', async () => {
            const first = await getPhotos(app, userId, { limit: 2 });
            const { nextCursor } = first.json();

            const second = await getPhotos(app, userId, {
                limit: 2,
                cursor_photo_id: nextCursor.toString(),
            });

            const page1Ids = (first.json().photos as PhotoWithMetadata[])
                .map((p: PhotoWithMetadata) => Number(p.id));
            const page2Ids = (second.json().photos as PhotoWithMetadata[])
                .map((p: PhotoWithMetadata) => Number(p.id));

            console.log('page1Ids:', page1Ids);
            console.log('page2Ids:', page2Ids);

            expect(page2Ids).to.have.length(2);

            // No overlap
            page2Ids.forEach(id => {
                expect(page1Ids).to.not.include(id);
            });
        });

        it('eventually returns empty results with no cursor', async () => {
            let cursor: string | null | undefined = undefined;
            const seen = new Set<string>();

            while (true) {
                const query: Record<string, any> = { limit: 2 };
                if (cursor !== undefined && cursor !== null) {
                    query.cursor_photo_id = cursor;
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

            // total count matches seed data
            expect(seen.size).to.equal(6);
        });

        it('orders by uploaded_at desc then id desc', async () => {
            const res = await getPhotos(app, userId, { limit: 6 });
            const photos = res.json().photos;

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
        it('should get 5 photos tagged with "common"', async () => {
            const response = await getPhotos(app, userId, { tag: ['common'] });
            expect(response.statusCode).to.equal(200);

            const body = response.json();
            expect(body.photos.length).to.equal(5);
        });

        it('should get 3 photos tagged with "tag_1", "tag_0" or "tag_4"', async () => {
            const response = await getPhotos(app, userId, { tag: ['tag_1', 'tag_0', 'tag_4'], match: ['any'] });
            expect(response.statusCode).to.equal(200);

            const body = response.json();
            expect(body.photos.length).to.equal(3);
        });

        it('should get 1 photo tagged with "common" AND "tag_0"', async () => {
            const response = await getPhotos(app, userId, { tag: ['common', 'tag_0'], match: ['all'] });
            expect(response.statusCode).to.equal(200);

            const body = response.json();
            expect(body.photos.length).to.equal(1);
        });
    });

    describe('[GET /photos] -> search by caption only', () => {
        it('should get 2 photos by caption (strict match)', async () => {
            const response = await getPhotos(app, userId, {
                caption: ['sunset beach cat'],
                match: ['all'], // strict match
            });

            expect(response.statusCode).to.equal(200);

            const body = response.json();
            expect(body).to.have.property('photos');
            expect(Array.isArray(body.photos)).to.be.true;
            expect(body.photos.length).to.equal(2);
        });

        it('should get 4 photos by caption (non-strict match)', async () => {
            const response = await getPhotos(app, userId, {
                caption: ['sunset beach cat'], // default non-strict
            });

            expect(response.statusCode).to.equal(200);

            const body = response.json();
            expect(body).to.have.property('photos');
            expect(Array.isArray(body.photos)).to.be.true;
            expect(body.photos.length).to.equal(4);
        });
    });
    
    describe('[GET /photos] -> search by caption and tags', () => {
        it('should get 1 photo by caption AND tags (strict match)', async () => {
            const queryParams = {
                caption: ['sunset beach cat'],
                tag: ['tag_1'],
                match: ['all']
            };
            const queryString = new URLSearchParams(queryParams).toString();
            console.log('queryString:', queryString);
            const response = await app.inject({
                method: 'GET',
                url: `/photos?${queryString}`,
                headers: {
                    'x-user-id': userId,
                },
            });

            expect(response.statusCode).to.equal(200);
            
            const body = response.json();
            expect(body).to.have.property('photos');
            expect(Array.isArray(body.photos)).to.equal(true);
            expect(body.photos.length).to.equal(1);
        });

        it('should get 5 photos by caption OR tags (non-strict match)', async () => {
            const queryParams = {
                caption: ['sunset beach cat'],
                tag: ['tag_1', 'tag_3', 'tag_4']
            };
            const queryString = new URLSearchParams(queryParams).toString();
            console.log('queryString:', queryString);
            const response = await app.inject({
                method: 'GET',
                url: `/photos?${queryString}`,
                headers: {
                    'x-user-id': userId,
                },
            });

            expect(response.statusCode).to.equal(200);
            
            const body = response.json();
            expect(body).to.have.property('photos');
            expect(Array.isArray(body.photos)).to.equal(true);
            expect(body.photos.length).to.equal(5);
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
            console.log('body.photo:', body.photo);
        });
    });
});
