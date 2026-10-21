import { useCallback, useState } from "react";

export type SectionId = "connections" | "conversations" | "logs";

export interface SectionState {
    isOpen: boolean;
    toggle: () => void;
}

const KEY_PREFIX = "decision-console.section";

const DEFAULT_IS_OPEN: Record<SectionId, boolean> = {
    connections: true,
    conversations: true,
    logs: false,
};

function storageKey(sectionId: SectionId): string {
    return `${KEY_PREFIX}.${sectionId}`;
}

function loadIsOpen(sectionId: SectionId): boolean {
    try {
        const stored = localStorage.getItem(storageKey(sectionId));
        if (stored === null) {
            return DEFAULT_IS_OPEN[sectionId];
        }
        return stored === "open";
    } catch (error) {
        console.warn(`The ${sectionId} section state could not be read from localStorage.`, error);
        return DEFAULT_IS_OPEN[sectionId];
    }
}

function saveIsOpen(sectionId: SectionId, isOpen: boolean): void {
    try {
        localStorage.setItem(storageKey(sectionId), isOpen ? "open" : "closed");
    } catch (error) {
        console.warn(`The ${sectionId} section state could not be written to localStorage.`, error);
    }
}

export function useSectionState(sectionId: SectionId): SectionState {
    const [isOpen, setIsOpen] = useState(() => loadIsOpen(sectionId));

    const toggle = useCallback(() => {
        const nextIsOpen = !isOpen;
        setIsOpen(nextIsOpen);
        saveIsOpen(sectionId, nextIsOpen);
    }, [isOpen, sectionId]);

    return { isOpen, toggle };
}
