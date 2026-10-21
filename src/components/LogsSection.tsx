import type { LogEntry } from "../lib/types";
import { SIDEBAR_ROW_LIMIT, statusDotClassName } from "../lib/listDisplay";
import { EmptyNote } from "./Primitives";
import { MoreButton } from "./SidebarSection";

export interface LogsSectionProps {
    /** Every stored request, newest first. */
    requestLogs: LogEntry[];
    onOpenRequest: (uuid: string) => void;
    onShowMore: () => void;
}

function LogRow({ entry, onOpen }: { entry: LogEntry; onOpen: () => void }) {
    return (
        <li>
            <button
                type="button"
                onClick={onOpen}
                className="flex w-full min-w-0 items-center gap-2 rounded-md border border-ink-750 bg-ink-900/60 px-2 py-1.5 text-left font-mono text-[10px] transition hover:border-ink-600"
            >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClassName(entry.ok)}`} />
                <span className="w-9 shrink-0 text-mute-400">{entry.method}</span>
                <span className="shrink-0 text-mute-300">{entry.status}</span>
                <span className="truncate text-mute-500">{entry.ms}ms</span>
                <span className="ml-auto shrink-0 text-mute-600">
                    {new Date(entry.requestedAt).toLocaleTimeString()}
                </span>
            </button>
        </li>
    );
}

export default function LogsSection({ requestLogs, onOpenRequest, onShowMore }: LogsSectionProps) {
    const visibleEntries = requestLogs.slice(0, SIDEBAR_ROW_LIMIT);
    return (
        <div className="space-y-2">
            {requestLogs.length === 0 && <EmptyNote>No requests yet</EmptyNote>}
            <ul className="space-y-1">
                {visibleEntries.map((entry) => (
                    <LogRow key={entry.uuid} entry={entry} onOpen={() => onOpenRequest(entry.uuid)} />
                ))}
            </ul>
            {requestLogs.length > SIDEBAR_ROW_LIMIT && <MoreButton onClick={onShowMore} />}
        </div>
    );
}
