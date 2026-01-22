import { buildApp } from '../app.js';
import { describe, it } from 'mocha';
import { expect } from 'chai';

describe('USER MODEL TESTS:', () => {
    describe('POST /users -> create user', () => {
        let response: any;

        before(async () => {
            const app = buildApp();
            response = await app.inject({
                method: 'POST',
                url: '/users',
                body: {
                    username: 'username_test2',
                    email: 'username_test2@test.com'
                }
            });
        });

        it('should return statusCode: 201', () => {
            expect(response.statusCode).to.be.equal(201);
        });

        it('should return id', () => {
            const body = response.json();
            expect(body).to.have.property('newUser');
            expect(body.newUser).to.be.an('object');
            expect(body.newUser).to.have.property('id');
        });
    })
})