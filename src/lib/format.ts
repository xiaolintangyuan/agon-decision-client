export function pct(p: number | null | undefined, digits = 1): string {
    if (p === null || p === undefined || Number.isNaN(p)) {
        return "—";
    }
    return `${(p * 100).toFixed(digits)}%`;
}
