import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DB_URL ?? 'postgresql://dbuser:dbuserpw@postgres:5432/photo_db',
});

export default fp(async function addDbPool(server: FastifyInstance) {
  server.decorate('db', pool);

  server.addHook('onClose', async () => {
    await pool.end();
  });
});
