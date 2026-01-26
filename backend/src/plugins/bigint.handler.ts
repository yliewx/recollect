import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**========================================================================
 **              SET HOOKS FOR SERIALIZING/DESERIALIZING BIGINT
 *? convert ID bigint->string before serializing response payload
 *? convert ID string->bigint before validating request payload
 *========================================================================**/

export default fp(async function setBigIntHandler(app: FastifyInstance) {
    app.addHook('preSerialization', async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
        return serializeBigInt(payload);
    });

    app.addHook('preValidation', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            // console.log();
            // console.log('request.body:', JSON.stringify(request.body));
            // console.log('request.params:', JSON.stringify(request.params));
            // console.log();
            request.body = parseBigIntFields(request.body);
            request.params = parseBigIntFields(request.params);
        } catch (err) {
            reply.sendError(err);
        }
    });
});

/**------------------------------------------------------------------------
 **                  HANDLE BIGINT FIELDS IN REQUEST
 *------------------------------------------------------------------------**/
// check request.body for ID fields that should be bigint
// convert string -> bigint and return the new body
function parseBigIntFields(body: any): any {
    if (!body) return body;

    const copy = { ...body };
    const idFields = ['id', 'user_id', 'photo_id', 'album_id', 'tag_id'];

    for (const i of idFields) {
        if (copy[i] !== undefined && typeof copy[i] === 'string') {
            copy[i] = parseBigInt(copy[i], i);
        }
    }
    return copy;
}

/**------------------------------------------------------------------------
 **                   HANDLE BIGINT FIELDS IN REPLY
 *------------------------------------------------------------------------**/
function serializeBigInt(value: any): any {
    if (typeof value === 'bigint') {
        return value.toString();
    }

    // if (Array.isArray(value)) {
    //     return value.map(serializeBigInt);
    // }

    if (value && typeof value === 'object') {
        const result: Record<string, any> = {};

        for (const [key, val] of Object.entries(value)) {
            // check type of field before conversion
            if (typeof val === 'bigint') {
                result[key] = val.toString();
            } else if (val && typeof val === 'object') {
                result[key] = serializeBigInt(val);
            } else {
                result[key] = val;
            }
        }
        return result;
    }
}

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
