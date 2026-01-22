/**========================================================================
 * *                      TYPE DECLARATIONS: FASTIFY
 * 
 *   - extends fastify to include custom definitions
 *========================================================================**/

import { Pool } from 'pg';

declare module 'fastify' {
  interface FastifyInstance {
    db: Pool;
  }
}
