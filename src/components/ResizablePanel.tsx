import { useRef } from "react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";

const MIN_HEIGHT = 140;
const MAX_VIEWPORT_RATIO = 0.7;
const KEYBOARD_STEP = 24;

interface DragStart {
    pointerY: number;
    panelHeight: number;
}

/** Bottom-docked panel whose top edge can be dragged. A null height means "fit the content". */
export default function ResizablePanel({
    height,
    onHeightChange,
    children,
}: {
    height: number | null;
    onHeightChange: (height: number | null) => void;
    children: ReactNode;
}) {
    const panelRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef<DragStart | null>(null);

    function clampHeight(value: number): number {
        const maxHeight = Math.max(MIN_HEIGHT, window.innerHeight * MAX_VIEWPORT_RATIO);
        return Math.min(maxHeight, Math.max(MIN_HEIGHT, value));
    }

    function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
        const panel = panelRef.current;
        if (panel === null) {
            return;
        }
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragStartRef.current = { pointerY: event.clientY, panelHeight: panel.offsetHeight };
    }

    function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
        const dragStart = dragStartRef.current;
        if (dragStart === null) {
            return;
        }
        const distanceMovedUp = dragStart.pointerY - event.clientY;
        onHeightChange(clampHeight(dragStart.panelHeight + distanceMovedUp));
    }

    function handlePointerEnd() {
        dragStartRef.current = null;
    }

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        const panel = panelRef.current;
        if (panel === null) {
            return;
        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            onHeightChange(clampHeight(panel.offsetHeight + KEYBOARD_STEP));
        }
        if (event.key === "ArrowDown") {
            event.preventDefault();
            onHeightChange(clampHeight(panel.offsetHeight - KEYBOARD_STEP));
        }
    }

    const heightStyle = height === null ? undefined : { height: clampHeight(height) };

    return (
        <div
            ref={panelRef}
            className="relative flex shrink-0 flex-col"
            style={{ ...heightStyle, maxHeight: `${MAX_VIEWPORT_RATIO * 100}vh` }}
        >
            <div
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize composer. Double-click to reset."
                tabIndex={0}
                title="Drag to resize · double-click to reset"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onDoubleClick={() => onHeightChange(null)}
                onKeyDown={handleKeyDown}
                className="group absolute inset-x-0 top-0 z-20 h-3 -translate-y-1/2 cursor-row-resize touch-none outline-none"
            >
                <div className="mx-auto mt-[5px] h-0.5 w-10 rounded-full bg-ink-600 transition group-hover:bg-brass-600 group-focus-visible:bg-brass-600 group-active:bg-brass-500" />
            </div>
            {children}
        </div>
    );
}
