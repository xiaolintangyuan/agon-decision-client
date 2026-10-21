/** A copy of the set with the value removed when it was in the set, or added when it was not. */
export function toggleInSet(set: ReadonlySet<string>, value: string): ReadonlySet<string> {
    const next = new Set(set);
    if (next.has(value)) {
        next.delete(value);
    } else {
        next.add(value);
    }
    return next;
}
