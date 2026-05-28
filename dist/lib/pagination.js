export function getPaginationParams(page, limit) {
    return {
        skip: (page - 1) * limit,
        take: limit,
    };
}
export function buildPaginatedResult(data, total, page, limit) {
    return {
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages: total === 0 ? 0 : Math.ceil(total / limit),
        },
    };
}
