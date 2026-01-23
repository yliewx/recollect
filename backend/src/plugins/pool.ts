import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';

// wait to connect to postgres
async function waitForDb(pool: Pool, retries = 30) {
    while (retries--) {
        try {
            await pool.query('SELECT 1');
            return;
        } catch (err) {
            console.warn(`Database not ready yet, retrying... [${retries} attempts left]`, err);
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    throw new Error('Database not ready');
}

// create pool and add to fastify instance
export default fp(async function connectDb(app: FastifyInstance) {
    console.log('pool.ts: process.env.DB_URL:', process.env.DB_URL);
    
    const pool = new Pool({
        connectionString: process.env.DB_URL ?? 'postgresql://dbuser:dbuserpw@postgres:5432/photo_db',
    });
    await waitForDb(pool);
    console.log('Successfully connected to database at:', Date.now());
    
    app.decorate('db', pool);

    app.addHook('onClose', async () => {
        await pool.end();
    });
});
