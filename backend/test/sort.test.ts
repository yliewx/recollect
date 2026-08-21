import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { buildApp } from '../src/app.js';
import { FastifyInstance } from 'fastify';
import { getPhotos, fetchAllPhotosWithCursor } from './photo.test.utils.js';

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

type RegisterItem = {
    asset_id: string;
    tags?: string[];
    width?: number;
    height?: number;
    size_bytes?: number;
};

async function registerPhotos(app: FastifyInstance, userId: string, items: RegisterItem[]) {
    const response = await app.inject({
        method: 'POST',
        url: '/photos',
        headers: { 'x-user-id': userId },
        body: { items },
    });
    expect(response.statusCode).to.equal(201);
    return response.json().photos as Array<{ id: string; asset_id: string; width: number | null; height: number | null; size_bytes: number | null }>;
}

describe('SORT TESTS:', () => {
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

    describe('[POST /photos] -> registers width/height/size_bytes metadata', () => {
        it('stores and returns the metadata fields', async () => {
            const photos = await registerPhotos(app, userId, [
                { asset_id: `meta_${Date.now()}`, width: 1920, height: 1080, size_bytes: 500_000 },
            ]);

            expect(photos[0].width).to.equal(1920);
            expect(photos[0].height).to.equal(1080);
            expect(photos[0].size_bytes).to.equal(500_000);
        });

        it('leaves the fields null when omitted', async () => {
            const photos = await registerPhotos(app, userId, [
                { asset_id: `meta_bare_${Date.now()}` },
            ]);

            expect(photos[0].width).to.be.null;
            expect(photos[0].height).to.be.null;
            expect(photos[0].size_bytes).to.be.null;
        });
    });

    describe('[GET /photos] -> sort_by validation', () => {
        it('rejects an unrecognised sort_by value with 400 (never reaches ORDER BY)', async () => {
            const res = await getPhotos(app, userId, { sort_by: 'id; DROP TABLE photos;--' });
            expect(res.statusCode).to.equal(400);
        });

        it('rejects an unrecognised order value with 400', async () => {
            const res = await getPhotos(app, userId, { order: 'sideways' });
            expect(res.statusCode).to.equal(400);
        });
    });

    describe('[GET /photos] -> sort_by=size_bytes', () => {
        const stamp = Date.now();
        const sizes = [300, 100, 500, 200, 400];

        before(async () => {
            for (const size_bytes of sizes) {
                await registerPhotos(app, userId, [
                    { asset_id: `size_${stamp}_${size_bytes}`, size_bytes },
                ]);
            }
        });

        it('orders ascending', async () => {
            const res = await getPhotos(app, userId, { sort_by: 'size_bytes', order: 'asc' });
            expect(res.statusCode).to.equal(200);
            const values = res.json().photos
                .map((p: any) => p.size_bytes)
                .filter((v: number | null): v is number => v !== null);
            const sorted = [...values].sort((a, b) => a - b);
            expect(values).to.deep.equal(sorted);
        });

        it('orders descending (default)', async () => {
            const res = await getPhotos(app, userId, { sort_by: 'size_bytes' });
            expect(res.statusCode).to.equal(200);
            const values = res.json().photos
                .map((p: any) => p.size_bytes)
                .filter((v: number | null): v is number => v !== null);
            const sorted = [...values].sort((a, b) => b - a);
            expect(values).to.deep.equal(sorted);
        });
    });

    describe('[GET /photos] -> sort_by=dimensions', () => {
        const stamp = Date.now();

        before(async () => {
            // width is the primary key; height only breaks ties on equal width
            await registerPhotos(app, userId, [
                { asset_id: `dim_${stamp}_a`, width: 800, height: 200 },
                { asset_id: `dim_${stamp}_b`, width: 800, height: 100 },
                { asset_id: `dim_${stamp}_c`, width: 400, height: 900 },
            ]);
        });

        it('orders by width then height, ascending', async () => {
            const res = await getPhotos(app, userId, { sort_by: 'dimensions', order: 'asc', limit: 50 });
            expect(res.statusCode).to.equal(200);
            const own = res.json().photos.filter((p: any) => p.asset_id.startsWith(`dim_${stamp}_`));
            expect(own.map((p: any) => p.asset_id)).to.deep.equal([
                `dim_${stamp}_c`, // width 400
                `dim_${stamp}_b`, // width 800, height 100
                `dim_${stamp}_a`, // width 800, height 200
            ]);
        });
    });

    describe('[GET /photos] -> sort_by combined with tag filter', () => {
        const stamp = Date.now();
        const tag = `sorttag_${stamp}`;

        before(async () => {
            await registerPhotos(app, userId, [
                { asset_id: `tagged_${stamp}_1`, tags: [tag], size_bytes: 900 },
                { asset_id: `tagged_${stamp}_2`, tags: [tag], size_bytes: 100 },
                { asset_id: `tagged_${stamp}_3`, tags: [tag], size_bytes: 500 },
            ]);
        });

        it('applies sort_by within a tag-filtered result set', async () => {
            const res = await getPhotos(app, userId, { tag, sort_by: 'size_bytes', order: 'asc' });
            expect(res.statusCode).to.equal(200);
            expect(res.json().photos.map((p: any) => p.size_bytes)).to.deep.equal([100, 500, 900]);
        });

        it('keeps cursor pagination consistent (no dupes/misses) while sorted', async () => {
            const { totalPhotos } = await fetchAllPhotosWithCursor(app, userId, {
                limit: 2,
                totalCount: 3,
                baseQuery: { tag, sort_by: 'size_bytes', order: 'asc' },
            });
            expect(totalPhotos).to.equal(3);
        });
    });
});
