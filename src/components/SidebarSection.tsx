import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, Settings } from "lucide-react";

export interface SidebarSectionGear {
    tooltip: string;
    onClick: () => void;
}

interface SidebarSectionProps {
    title: string;
    isOpen: boolean;
    onToggle: () => void;
    headingExtra?: ReactNode;
    gear?: SidebarSectionGear;
    children: ReactNode;
}

function GearButton({ gear }: { gear: SidebarSectionGear }) {
    return (
        <button
            type="button"
            onClick={gear.onClick}
            aria-label={gear.tooltip}
            title={gear.tooltip}
            className="rounded-md border border-ink-700 bg-ink-800 p-1.5 text-mute-300 transition hover:border-brass-700 hover:text-brass-400"
        >
            <Settings size={13} />
        </button>
    );
}

function ChevronButton({ title, isOpen, onToggle }: Pick<SidebarSectionProps, "title" | "isOpen" | "onToggle">) {
    const action = isOpen ? "Collapse" : "Expand";
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            aria-label={`${action} ${title}`}
            title={`${action} ${title}`}
            className="rounded-md p-1.5 text-mute-400 transition hover:bg-ink-700 hover:text-mute-100"
        >
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
    );
}

export default function SidebarSection({
    title,
    isOpen,
    onToggle,
    headingExtra,
    gear,
    children,
}: SidebarSectionProps) {
    return (
        <section className="shrink-0 border-b border-ink-700">
            <div className="flex items-center gap-2 px-4 py-3">
                <h2 className="min-w-0 flex-1">
                    <button
                        type="button"
                        onClick={onToggle}
                        className="label-xs block w-full truncate py-1 text-left text-mute-400"
                    >
                        {title}
                    </button>
                </h2>
                {headingExtra}
                {gear !== undefined && <GearButton gear={gear} />}
                <ChevronButton title={title} isOpen={isOpen} onToggle={onToggle} />
            </div>
            {isOpen && <div className="px-4 pb-5">{children}</div>}
        </section>
    );
}

export function MoreButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="mt-2 text-[11px] text-mute-400 transition hover:text-brass-400"
        >
            More...
        </button>
    );
}
