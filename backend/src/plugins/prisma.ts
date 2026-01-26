import fp from 'fastify-plugin'
import { PrismaClient } from '@/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { FastifyInstance } from 'fastify';

// wait to connect to postgres
async function connectDb(prisma: PrismaClient, retries = 30) {
    while (retries--) {
        try {
            await prisma.$connect();
            return;
        } catch (err) {
            console.warn(`Database not ready yet, retrying... [${retries} attempts left]`, err);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    throw new Error('Database not ready');
}

// init prisma client and add to fastify instance
export default fp(async function connectPrisma(app: FastifyInstance) {
    const connectionString = process.env.DATABASE_URL ?? 'postgresql://dbuser:dbuserpw@postgres:5432/photo_db';
    
    const adapter = new PrismaPg({ connectionString });
    const prisma = new PrismaClient({ adapter });

    await connectDb(prisma);
    console.log('connected to db at', Date.now());

    app.decorate('prisma', prisma)

    app.addHook('onClose', async (app) => {
        await app.prisma.$disconnect()
    })
})
