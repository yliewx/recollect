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
export function buildCursorOptions(cursor?: bigint) {
    if (cursor !== undefined) {
        return { cursor: { id: cursor }, skip: 1 };
    }
    return {};
}