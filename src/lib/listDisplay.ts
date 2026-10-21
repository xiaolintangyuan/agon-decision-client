import type { InterfaceMode } from "./types";

export const SIDEBAR_ROW_LIMIT = 10;

export const MODE_LABELS: Record<InterfaceMode, string> = {
    decision: "SystemOne",
    chat: "Chat",
};

export function statusDotClassName(ok: boolean): string {
    if (ok) {
        return "bg-jade-500";
    }
    return "bg-coral-500";
}
