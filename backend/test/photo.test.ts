import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { uploadsDir, rootDir } from '@/types/constants.js';
import path from 'path';
import fs from 'fs';
import FormData from 'form-data';
import { URLSearchParams } from 'url';

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
            const form = new FormData();
            const filePaths: string[] = [];
            const metadata = {
                items: [] as {
                    filename: string;
                    caption?: string;
                    tags?: string[];
                }[]
            };
            const captions: string[] = [
                'Cat sitting on the beach watching a golden sunset',
                'A peaceful sunset at the beach while a cat naps nearby',
                'Golden sunset over the beach with waves crashing softly',
                'Sleepy cat curled up by the window on a rainy afternoon',
                'Afternoon walk through the city with coffee and music'
            ];

            // read and append files to form data
            for (let i = 0; i < 5; i++) {
                const filename = `photo_${i}.jpg`;
                const filePath = path.join(rootDir, 'test_images', filename);

                // form.append('file', fs.createReadStream(filePath));
                filePaths.push(filePath);
                metadata.items.push({
                    filename,
                    caption: captions[i],
                    tags: [`tag_${i}`, 'common']
                });
            }

            form.append('metadata', JSON.stringify(metadata));
            for (const filePath of filePaths) {
                form.append('file', fs.createReadStream(filePath));
            }

            const response = await app.inject({
                method: 'POST',
                url: '/photos',
                headers: {
                    'x-user-id': userId,
                    ...form.getHeaders(),
                },
                payload: form,
            });

            expect(response.statusCode).to.equal(201);

            const body = response.json();
            expect(body).to.have.property('photos');
            expect(Array.isArray(body.photos)).to.equal(true);

            // check that each image was saved to /uploads
            for (const photo of body.photos) {
                expect(photo).to.have.property('id');
                expect(photo).to.have.property('file_path');
                expect(
                    fs.existsSync(
                        path.join(uploadsDir, photo.file_path)
                    )
                ).to.equal(true);

                photoIds.push(photo.id);
            }
        });
    });

    describe('[POST /photos] -> upload single photo', () => {
        it('should upload 1 photo', async () => {
            const form = new FormData();

            const filePath = path.join(rootDir, 'test_images', `photo_5.jpg`);
            form.append('file', fs.createReadStream(filePath));

            const response = await app.inject({
                method: 'POST',
                url: '/photos',
                headers: {
                    'x-user-id': userId,
                    ...form.getHeaders(),
                },
                payload: form,
            });

            expect(response.statusCode).to.equal(201);

            const body = response.json();
            // single photo upload is still treated as batch upload -> 'photos' array with 1 object
            expect(body).to.have.property('photos');
            expect(Array.isArray(body.photos)).to.equal(true);
            expect(body.photos.length).to.equal(1);

            // check that each image was saved to /uploads
            for (const photo of body.photos) {
                expect(photo).to.have.property('id');
                expect(photo).to.have.property('file_path');
                expect(
                    fs.existsSync(
                        path.join(uploadsDir, photo.file_path)
                    )
                ).to.equal(true);

                photoIds.push(photo.id);
            }
        });
    });

    describe('[GET /photos] -> get all photos (no filters)', () => {
        it('should get 6 photos', async () => {
           const response = await app.inject({
                method: 'GET',
                url: '/photos',
                headers: {
                    'x-user-id': userId,
                },
            });

            expect(response.statusCode).to.equal(200);
            
            const body = response.json();
            expect(body).to.have.property('photos');
            expect(Array.isArray(body.photos)).to.equal(true);
            expect(body.photos.length).to.equal(6);
        });
    });

    describe('[GET /photos] -> search by tags only', () => {
        it(`should get 5 photos tagged with 'common'`, async () => {
            const queryParams = {
                tag: ['common']
            };
            const queryString = new URLSearchParams(queryParams).toString();
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

        it(`should get 3 photos tagged with 'tag_1' OR 'tag_0' OR 'tag_4'`, async () => {
            const queryParams = {
                tag: ['tag_1', 'tag_0', 'tag_4'],
                match: ['any']
            };
            const queryString = new URLSearchParams(queryParams).toString();
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
            expect(body.photos.length).to.equal(3);
        });

        it(`should get 1 photo tagged with 'common' AND 'tag_0'`, async () => {
            const queryParams = {
                tag: ['common', 'tag_0'],
                match: ['all']
            };
            const queryString = new URLSearchParams(queryParams).toString();
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
    });

    describe('[GET /photos] -> search by caption only', () => {
        it('should get photos by caption', async () => {
            const queryParams = {
                caption: ['sunset beach cat']
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
    });
});
