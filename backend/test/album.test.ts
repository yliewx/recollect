import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { testContext, initTestContext } from './context.js';

// testContext has 1 dummy user with 10 photos, 1 album
describe('ALBUM FLOW TESTS:', () => {
    let app: any;
    let user: any;
    let photos: any[];
    let albumId: string;

    before(async function () {
        this.timeout(30_000);
        app = buildApp();
        await app.ready();
        await initTestContext();
        ({ user, photos } = testContext);
    });

    after(async () => {
        await app.close();
    });

    describe('[POST /albums] -> create new album', () => {
        it('should create an album', async () => {
           const response = await app.inject({
                method: 'POST',
                url: '/albums',
                headers: {
                    'x-user-id': user.id,
                },
                body: {
                    title: 'Test Album 2'
                },
            });

            expect(response.statusCode).to.equal(201);

            const body = response.json();
            expect(body).to.have.property('album');
            expect(body.album).to.have.property('id');
            albumId = body.album.id;
        });
    });

    describe('[GET /albums] -> get all albums', () => {
        it('should get 2 albums', async () => {
           const response = await app.inject({
                method: 'GET',
                url: '/albums',
                headers: {
                    'x-user-id': user.id,
                },
            });

            expect(response.statusCode).to.equal(200);

            const body = response.json();
            expect(body).to.have.property('albums');
            expect(Array.isArray(body.albums)).to.equal(true);
            expect(body.albums.length).to.equal(2);
        });
    });

    describe('[POST /albums/:id/photos] -> add photos to album', () => {
        it('should add 10 photos', async () => {
           const response = await app.inject({
                method: 'POST',
                url: `/albums/${albumId}/photos`,
                headers: {
                    'x-user-id': user.id,
                },
                body: {
                    album_id: albumId,
                    photo_ids: photos.map(photo => photo.id)
                },
            });

            expect(response.statusCode).to.equal(200);

            const body = response.json();
            expect(body).to.have.property('total_added');
            expect(body.total_added).to.equal(10);
        });
    });

    describe('[DELETE /albums] -> delete album', () => {
        it('should delete an album', async () => {
            const response = await app.inject({
                method: 'DELETE',
                url: `/albums/${albumId}`,
                headers: {
                    'x-user-id': user.id,
                },
            });

            expect(response.statusCode).to.equal(200);
        });
    });
})
