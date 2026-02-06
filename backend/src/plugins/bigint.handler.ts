import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**========================================================================
 **              SET HOOKS FOR SERIALIZING/DESERIALIZING BIGINT
 *? convert ID bigint->string before serializing response payload
 *? convert ID string->bigint before validating request payload
 *========================================================================**/

export default fp(async function setBigIntHandler(app: FastifyInstance) {
    // before sending response: automatically convert bigint to string
    app.addHook('preSerialization', async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
        return serializeBigInt(payload);
    });

    // before processing request: automatically convert ID fields in request.body and params
    app.addHook('preValidation', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            request.body = parseBigIntFields(request.body);
        } catch (err) {
            reply.sendError(err);
        }
    });
});

/**============================================
 *           HELPERS FOR PARSING
 *=============================================**/

// check if a string contains only digits
function isNumeric(str: string): boolean {
    return /^\d+$/.test(str);
}

export function parseBigInt(value: string, field: string): bigint {
    if (!isNumeric(value)) {
        throw new Error(`Invalid BigInt for field "${field}": ${value}`);
    }
    return BigInt(value);
}

/**------------------------------------------------------------------------
 **                  HANDLE BIGINT FIELDS IN REQUEST
 *------------------------------------------------------------------------**/
// check for ID fields that should be bigint
// convert string -> bigint and return the new body
function parseBigIntFields(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    const copy = { ...obj };
    const idFields = ['id', 'user_id', 'photo_id', 'album_id', 'tag_id'];

    // iterate over the object's keys
    for (const key of Object.keys(copy)) {
        const value = copy[key];

        // single id field: convert string->bigint
        if (idFields.includes(key) && typeof value === 'string') {
            copy[key] = parseBigInt(value, key);
        }

        // arrays of ids: convert every element in the array
        if (idFields.includes(key) && Array.isArray(value)) {
            copy[key] = value.map((v, idx) => {
                if (typeof v === 'string') {
                    return parseBigInt(v, `${key}[${idx}]`);
                }
                return v;
            });
        }
    }
    return copy;
}

/**------------------------------------------------------------------------
 **                   HANDLE BIGINT FIELDS IN REPLY
 *------------------------------------------------------------------------**/
export function serializeBigInt(value: any): any {
    if (typeof value === 'bigint') {
        return value.toString();
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (Array.isArray(value)) {
        return value.map(serializeBigInt);
    }

    if (value && typeof value === 'object') {
        const result: Record<string, any> = {};

        for (const [key, val] of Object.entries(value)) {
            // recursively check type of field before conversion
            result[key] = serializeBigInt(val);
        }
        return result;
    }
    // preserve any non-bigint value
    return value;
}
