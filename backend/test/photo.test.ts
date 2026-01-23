import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

async function createTestUser(app: FastifyInstance): Promise<number> {
    const response = await app.inject({
        method: 'POST',
        url: '/users',
        body: {
            username: `test_user_${Date.now()}`,
            email: `test_${Date.now()}@test.com`,
        },
    });

    expect(response.statusCode).to.equal(201);
    return response.json().user;
}

describe('PHOTO FLOW TESTS:', () => {
    let app: any;
    let testUserId: number;
    let newPhotoId: number;

    before(async function () {
        this.timeout(30_000);
        app = buildApp();
        await app.ready();
        testUserId = await createTestUser(app);
    });

    after(async () => {
        await app.close();
    });

    describe('[POST /photos] -> upload photo', () => {
        it('should upload a photo', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/photos',
                body: {
                    userId: testUserId,
                    filePath: `test_${Date.now()}.png`,
                    caption: 'test caption'
                },
            });

            expect(response.statusCode).to.equal(201);

            const body = response.json();
            expect(body).to.have.property('photo');
            expect(body.photo).to.have.property('id');
        });
    });
});
