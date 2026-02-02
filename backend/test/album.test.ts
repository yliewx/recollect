import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { testContext, initTestContext } from './context.js';
import { getAlbumPhotos } from './photo.test.utils.js';
import { PhotoWithMetadata } from '@/models/photo.model.js';

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
        it('should add 100 photos', async () => {
           const response = await app.inject({
                method: 'POST',
                url: `/albums/${albumId}/photos`,
                headers: {
                    'x-user-id': user.id,
                },
                body: {
                    photo_ids: photos.map(photo => photo.id)
                },
            });

            expect(response.statusCode).to.equal(200);

            const body = response.json();
            expect(body).to.have.property('total_added');
            expect(body.total_added).to.equal(100);
        });
    });

    describe('[GET /albums/:id/photos] -> get photos from album', () => {
        const limitTake = 25;
    
        it('returns first page with nextCursor', async () => {
            const response = await getAlbumPhotos(app, user.id, albumId, { limit: limitTake });
            expect(response.statusCode).to.equal(200);

            const body = response.json();
            expect(body.photos).to.have.length(limitTake);
            expect(body.nextCursor).to.exist;

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
            const first = await getAlbumPhotos(app, user.id, albumId, { limit: limitTake });
            const { nextCursor } = first.json();

            const second = await getAlbumPhotos(app, user.id, albumId, {
                limit: limitTake,
                cursor_photo_id: nextCursor.toString(),
            });

            const page1Ids = (first.json().photos as PhotoWithMetadata[]).map(p => Number(p.id));
            const page2Ids = (second.json().photos as PhotoWithMetadata[]).map(p => Number(p.id));

            console.log('page1Ids:', page1Ids);
            console.log('page2Ids:', page2Ids);

            expect(page2Ids).to.have.length(limitTake);

            page2Ids.forEach(id => {
                expect(page1Ids).to.not.include(id);
            });
        });

        it('eventually returns empty results with no cursor', async () => {
            let cursor: string | null | undefined = undefined;
            const seen = new Set<string>();

            while (true) {
                const query: Record<string, any> = { limit: limitTake };
                if (cursor !== undefined && cursor !== null) {
                    query.cursor_photo_id = cursor;
                }

                const res = await getAlbumPhotos(app, user.id, albumId, query);
                const body = res.json();
                const photos = body.photos ?? [];
                const nextCursor = body.nextCursor;

                for (const p of photos) {
                    const id = String(p.id);
                    expect(seen.has(id)).to.be.false;
                    seen.add(id);
                }

                if (!nextCursor || photos.length === 0) break;

                cursor = nextCursor;
            }

            expect(seen.size).to.equal(100);
        });

        it('orders by uploaded_at desc then id desc', async () => {
            const res = await getAlbumPhotos(app, user.id, albumId, { limit: limitTake });
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

        it('should restored the deleted album', async () => {
            const response = await app.inject({
                method: 'PATCH',
                url: `/albums/${albumId}/restore`,
                headers: {
                    'x-user-id': user.id,
                },
            });

            expect(response.statusCode).to.equal(200);
            const body = response.json();
            expect(body).to.have.property('album');
            console.log('body.album:', body.album);
        });
    });
})
