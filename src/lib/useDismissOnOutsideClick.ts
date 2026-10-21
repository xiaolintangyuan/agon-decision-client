import { useEffect, type RefObject } from "react";

/** Calls `onDismiss` for a mouse press anywhere outside the container. Pass a stable `onDismiss`. */
export function useDismissOnOutsideClick(containerRef: RefObject<HTMLElement | null>, onDismiss: () => void): void {
    useEffect(() => {
        function handleMouseDown(event: MouseEvent): void {
            const container = containerRef.current;
            if (container !== null && event.target instanceof Node && container.contains(event.target)) {
                return;
            }
            onDismiss();
        }
        document.addEventListener("mousedown", handleMouseDown);
        return () => {
            document.removeEventListener("mousedown", handleMouseDown);
        };
    }, [containerRef, onDismiss]);
}
