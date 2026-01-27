import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { uploadsDir, rootDir } from '@/types/constants.js';
import path from 'path';
import fs from 'fs';
import FormData from 'form-data';

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

            // read and append files to form data
            for (let i = 0; i < 5; i++) {
                const filePath = path.join(rootDir, 'test_images', `photo_${i}.jpg`);
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
            expect(body).to.have.property('photo');
            expect(body.photo).to.have.property('id');
            expect(body.photo).to.have.property('file_path');

            // check that image was saved to /uploads
            expect(
                fs.existsSync(
                    path.join(uploadsDir, body.photo.file_path)
                )
            ).to.equal(true);

            photoIds.push(body.photo.id);
        });
    });

    describe('[GET /photos] -> get all photos', () => {
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
