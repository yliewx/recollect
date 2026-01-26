import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

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
    console.log('create test user body:', body);
    return body.user.id;
}

describe('PHOTO FLOW TESTS:', () => {
    let app: any;
    let userId: string;
    // let newPhotoId: string;
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

    describe('[POST /photos] -> upload photo', () => {
        it('should upload 5 photos', async () => {
            for (let i = 0; i < 5; i++) {
                const response = await app.inject({
                    method: 'POST',
                    url: '/photos',
                    headers: {
                        'x-user-id': userId,
                    },
                    body: {
                        file_path: `test_${Date.now()}.png`
                    },
                });

                expect(response.statusCode).to.equal(201);

                const body = response.json();
                expect(body).to.have.property('photo');
                expect(body.photo).to.have.property('id');
                
                photoIds.push(body.photo.id);
            }
        });
    });

    describe('[GET /photos] -> get all photos', () => {
        it('should get 5 photos', async () => {
           const response = await app.inject({
                method: 'GET',
                url: '/photos',
                headers: {
                    'x-user-id': userId,
                },
            });

            expect(response.statusCode).to.equal(200);
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
