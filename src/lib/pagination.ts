export const ROWS_PER_PAGE = 50;

export function pageCountFor(rowCount: number): number {
    return Math.max(1, Math.ceil(rowCount / ROWS_PER_PAGE));
}

/** Pages are 1-based. A page past the end (after a delete) falls back to the last one. */
export function clampPage(page: number, pageCount: number): number {
    return Math.min(Math.max(1, page), pageCount);
}

export function rowsForPage<Row>(rows: Row[], page: number): Row[] {
    const start = (page - 1) * ROWS_PER_PAGE;
    return rows.slice(start, start + ROWS_PER_PAGE);
}

/** The page that holds the row, or the first page when the row is unknown. */
export function pageOfUUID(rows: { uuid: string }[], uuid: string | undefined): number {
    if (uuid === undefined) {
        return 1;
    }
    const index = rows.findIndex((row) => row.uuid === uuid);
    if (index === -1) {
        return 1;
    }
    return Math.floor(index / ROWS_PER_PAGE) + 1;
}
