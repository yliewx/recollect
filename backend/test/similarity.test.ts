import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

async function createTestUser(app: FastifyInstance): Promise<string> {
    const response = await app.inject({
        method: 'POST',
        url: '/users',
        body: {
            username: `test_user_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            email: `test_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
        },
    });

    expect(response.statusCode).to.equal(201);
    return response.json().user.id;
}

type RegisterItem = { asset_id: string; embedding?: number[] };

async function registerPhotos(app: FastifyInstance, userId: string, items: RegisterItem[]) {
    const response = await app.inject({
        method: 'POST',
        url: '/photos',
        headers: { 'x-user-id': userId },
        body: { items },
    });
    expect(response.statusCode).to.equal(201);
    return response.json().photos as Array<{ id: string; asset_id: string }>;
}

function findId(photos: Array<{ id: string; asset_id: string }>, asset_id: string): string {
    const photo = photos.find(p => p.asset_id === asset_id);
    if (!photo) throw new Error(`photo not registered: ${asset_id}`);
    return photo.id;
}

async function getSimilar(app: FastifyInstance, userId: string, photoId: string, query?: Record<string, any>) {
    let url = `/photos/${photoId}/similar`;
    if (query) url += `?${new URLSearchParams(query).toString()}`;
    return app.inject({
        method: 'GET',
        url,
        headers: { 'x-user-id': userId },
    });
}

describe('SIMILARITY SEARCH TESTS:', () => {
    let app: FastifyInstance;
    let userId: string;

    before(async function () {
        this.timeout(30_000);
        app = await buildApp();
        await app.ready();
        userId = await createTestUser(app);
    });

    after(async () => {
        await app.close();
    });

    describe('[GET /photos/:id/similar] -> ranking', () => {
        it('ranks the nearer embedding ahead of the farther one, and excludes photos with no embedding', async () => {
            const anchor = [1, 0, 0, 0, 0, 0, 0, 0];
            const near = [0.99, 0.01, 0, 0, 0, 0, 0, 0];
            const far = [0, 0, 0, 0, 0, 0, 0, 1];

            const photos = await registerPhotos(app, userId, [
                { asset_id: `sim_anchor_${Date.now()}`, embedding: anchor },
                { asset_id: `sim_near_${Date.now()}`, embedding: near },
                { asset_id: `sim_far_${Date.now()}`, embedding: far },
                { asset_id: `sim_no_embedding_${Date.now()}` },
            ]);

            const anchorId = findId(photos, photos[0].asset_id);
            const nearId = photos[1].id;
            const farId = photos[2].id;
            const noEmbeddingId = photos[3].id;

            const response = await getSimilar(app, userId, anchorId);
            expect(response.statusCode).to.equal(200);

            const body = response.json();
            const resultIds = body.photos.map((p: any) => p.id);

            expect(resultIds).to.include(nearId);
            expect(resultIds).to.include(farId);
            expect(resultIds).to.not.include(noEmbeddingId);
            expect(resultIds).to.not.include(anchorId);
            expect(resultIds.indexOf(nearId)).to.be.lessThan(resultIds.indexOf(farId));
        });

        it('returns an empty list when the anchor photo has no embedding', async () => {
            const photos = await registerPhotos(app, userId, [
                { asset_id: `sim_bare_anchor_${Date.now()}` },
            ]);

            const response = await getSimilar(app, userId, photos[0].id);
            expect(response.statusCode).to.equal(200);
            expect(response.json()).to.deep.equal({ photos: [], count: 0 });
        });

        it('excludes candidates whose embedding has a different dimension than the anchor', async () => {
            const photos = await registerPhotos(app, userId, [
                { asset_id: `sim_dim_anchor_${Date.now()}`, embedding: [1, 0, 0, 0] },
                { asset_id: `sim_dim_mismatch_${Date.now()}`, embedding: [1, 0, 0, 0, 0, 0] },
            ]);

            const response = await getSimilar(app, userId, photos[0].id);
            expect(response.statusCode).to.equal(200);
            expect(response.json().photos).to.have.length(0);
        });

        it('respects the limit query param', async () => {
            const items: RegisterItem[] = [{ asset_id: `sim_limit_anchor_${Date.now()}`, embedding: [1, 0, 0] }];
            for (let i = 0; i < 5; i++) {
                items.push({ asset_id: `sim_limit_${i}_${Date.now()}`, embedding: [1, 0, i / 10] });
            }
            const photos = await registerPhotos(app, userId, items);

            const response = await getSimilar(app, userId, photos[0].id, { limit: 2 });
            expect(response.statusCode).to.equal(200);
            expect(response.json().photos).to.have.length(2);
        });

        it('rejects a photo that does not belong to the requesting user', async () => {
            const otherUserId = await createTestUser(app);
            const photos = await registerPhotos(app, userId, [
                { asset_id: `sim_owner_check_${Date.now()}`, embedding: [1, 0, 0] },
            ]);

            const response = await getSimilar(app, otherUserId, photos[0].id);
            expect(response.statusCode).to.not.equal(200);
        });
    });
});
