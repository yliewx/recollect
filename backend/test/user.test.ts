import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

describe('USER FLOW TESTS:', () => {
    let app: any;
    let newUserId: number;
    let sameUsername: string;
    let sameEmail: string;

    before(async function () {
        this.timeout(30_000);
        app = buildApp();
        await app.ready();
    });

    after(async () => {
        await app.close();
    });

    describe('[POST /users] -> create user', () => {
        it('should create a user', async () => {
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
            expect(body).to.have.property('user');
            expect(body.user).to.have.property('id');

            newUserId = body.user.id;
            sameUsername = body.user.username;
            sameEmail = body.user.email;
        });
    });

    describe('[POST /users] -> create user with non-unique username', () => {
        it('should fail', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/users',
                body: {
                    username: sameUsername,
                    email: `test_${Date.now()}@test.com`,
                },
            });

            expect(response.statusCode).to.equal(400);
        });
    });

    describe('[POST /users] -> create user with non-unique email', () => {
        it('should fail', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/users',
                body: {
                    username: `test_user_${Date.now()}`,
                    email: sameEmail,
                },
            });

            expect(response.statusCode).to.equal(400);
        });
    });

    describe('[DELETE /users/me] -> delete user', () => {
        it('should delete the created user', async () => {
            const response = await app.inject({
                method: 'DELETE',
                url: '/users/me',
                body: {
                    userId: newUserId,
                },
            });

            expect(response.statusCode).to.equal(200);
        });
    });
});
