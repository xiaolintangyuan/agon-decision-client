import { useSyncExternalStore } from "react";

/** Tracks a CSS media query, for the few layout facts that CSS alone cannot express, such as a table colSpan. */
export function useMediaQuery(query: string): boolean {
    function subscribe(onChange: () => void): () => void {
        const mediaQueryList = window.matchMedia(query);
        mediaQueryList.addEventListener("change", onChange);
        return () => {
            mediaQueryList.removeEventListener("change", onChange);
        };
    }

    function getSnapshot(): boolean {
        return window.matchMedia(query).matches;
    }

    return useSyncExternalStore(subscribe, getSnapshot);
}
