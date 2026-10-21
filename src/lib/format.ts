export function pct(p: number | null | undefined, digits = 1): string {
    if (p === null || p === undefined || Number.isNaN(p)) {
        return "—";
    }
    return `${(p * 100).toFixed(digits)}%`;
}

function padTwoDigits(value: number): string {
    return String(value).padStart(2, "0");
}

/** Local time as `YYYY-MM-DD HH:mm:ss`, the format shown in tables and written to exports. */
export function formatLocalTimestamp(epochMilliseconds: number): string {
    const date = new Date(epochMilliseconds);
    const day = `${date.getFullYear()}-${padTwoDigits(date.getMonth() + 1)}-${padTwoDigits(date.getDate())}`;
    const time = `${padTwoDigits(date.getHours())}:${padTwoDigits(date.getMinutes())}:${padTwoDigits(date.getSeconds())}`;
    return `${day} ${time}`;
}
