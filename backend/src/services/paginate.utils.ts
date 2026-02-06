import { parseBigInt } from "@/plugins/bigint.handler.js";

export type Cursor = { id: bigint, rank?: number};

// helper function for cursor-based pagination
export async function paginateFindMany<T>(
    model: any,
    options: {
        cursor?: { id: bigint }; // "bookmarked" location in results
        skip?: number; // skip the cursor
        take?: number; // select range
        where?: any;
        include?: any;
        select?: any;
        orderBy?: any
    }
): Promise<T[]> {
    const query: any = {
        take: options.take ?? 20,
        where: options.where,
        include: options.include,
        orderBy: options.orderBy,
    };

    // set query options if cursor is defined
    if (options.cursor) {
        query.cursor = options.cursor;
    }
    if (options.skip) {
        query.skip = options.skip;
    }
    // ensure select and include are not used together
    if (options.select && options.include === undefined) {
        query.select = options.select;
    }

    return model.findMany(query);
}

// helper function to build cursor options for query
export function buildCursorOptions(cursor?: Cursor) {
    if (cursor !== undefined && cursor.id !== undefined) {
        return { cursor: { id: cursor.id }, skip: 1 };
    }
    return {};
}

export function buildCursor(
    cursorId?: string,
    cursorRank?: number
): Cursor | undefined {
    // no cursor provided
    if (cursorId === undefined) return undefined;

    const id = parseBigInt(cursorId, 'cursorId');

    const cursor: Cursor = { id: id, rank: cursorRank };
    return cursor;
}

export function nextCursorFromIds(photoIds: bigint[], rank?: number): Cursor | null {
    if (photoIds.length === 0) return null;

    if (rank !== undefined) {
        return { id: photoIds[photoIds.length - 1], rank };
    }
    return { id: photoIds[photoIds.length - 1] };
}