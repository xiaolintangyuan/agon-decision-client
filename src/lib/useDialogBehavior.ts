import { useEffect, type RefObject } from "react";

/** Moves focus into the dialog panel, gives it back on close, and closes on Escape. */
export function useDialogBehavior(panelRef: RefObject<HTMLDivElement | null>, onClose: () => void): void {
    useEffect(() => {
        const previouslyFocused = document.activeElement;
        const panel = panelRef.current;
        if (panel !== null) {
            panel.focus();
        }
        return () => {
            if (previouslyFocused instanceof HTMLElement) {
                previouslyFocused.focus();
            }
        };
    }, [panelRef]);

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent): void {
            if (event.key === "Escape") {
                onClose();
            }
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose]);
}
