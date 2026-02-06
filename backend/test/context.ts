import { describe, before, after } from 'mocha';
import { buildApp } from '../app.js';
import { serializeBigInt } from '../plugins/bigint.handler.js';

// use for testing in isolation
// eg. so that album tests don't need to rely on user APIs working
export const testContext = {
    user: null as any,
    photos: [] as any[],
    album: null as any
};

export async function initTestContext() {
    const app = await buildApp();
    await app.ready();
    const db = app.prisma;

    // create shared user
    const user = await db.users.create({
        data: {
            username: `test_user_${Date.now()}`,
            email: `test_${Date.now()}@test.com`
        }
    });
    testContext.user = serializeBigInt(user);

    // create shared photos
    const photos = await db.photos.createManyAndReturn({
        data: Array.from({ length: 100 }).map((_, i) => ({
            user_id: testContext.user.id,
            file_path: `test_${Date.now()}_${i}.jpg`
        }))
    });
    testContext.photos = serializeBigInt(photos);

    // create shared album
    const album = await db.albums.create({
        data: {
            user_id: testContext.user.id,
            title: 'Test Album'
        }
    });
    testContext.album = serializeBigInt(album);
}
