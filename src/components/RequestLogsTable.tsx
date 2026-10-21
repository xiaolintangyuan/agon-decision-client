import { useState } from "react";
import type { LogEntry } from "../lib/types";
import { formatLocalTimestamp } from "../lib/format";
import { statusDotClassName } from "../lib/listDisplay";
import { toggleInSet } from "../lib/toggleInSet";
import { useMediaQuery } from "../lib/useMediaQuery";
import { clampPage, pageCountFor, pageOfUUID, rowsForPage } from "../lib/pagination";
import { tableHeadCellClassName } from "../lib/dialogStyles";
import { CodeBlock } from "./CodeBlock";
import { EmptyNote, SelectCell } from "./Primitives";
import Pagination from "./Pagination";

interface RequestLogsTableProps {
    /** Every stored request, newest first. */
    requestLogs: LogEntry[];
    selectedUUIDs: ReadonlySet<string>;
    onToggleSelected: (uuid: string) => void;
    /** The row that starts expanded, and the page that is shown first. */
    initialExpandedUUID?: string;
}

function formatBody(value: unknown): string {
    const text = JSON.stringify(value, null, 2);
    if (text === undefined) {
        return "";
    }
    return text;
}

function initialExpandedSet(uuid: string | undefined): ReadonlySet<string> {
    if (uuid === undefined) {
        return new Set();
    }
    return new Set([uuid]);
}

function BodyBlock({ title, value }: { title: string; value: unknown }) {
    return (
        <div className="min-w-0">
            <h3 className="label-xs text-mute-500">{title}</h3>
            <div className="[&_pre]:max-h-72 [&_pre]:overflow-y-auto">
                <CodeBlock code={formatBody(value)} language="json" />
            </div>
        </div>
    );
}

const ALL_COLUMN_COUNT = 7;
const NARROW_COLUMN_COUNT = 5;

function RequestDetail({ entry }: { entry: LogEntry }) {
    // A colSpan wider than the visible columns would add phantom columns that squeeze the URL, so it follows the breakpoint.
    const isWide = useMediaQuery("(min-width: 640px)");
    const columnCount = isWide ? ALL_COLUMN_COUNT : NARROW_COLUMN_COUNT;
    return (
        <tr className="bg-ink-900/40">
            <td colSpan={columnCount} className="px-3 pb-1 pt-2">
                <p className="break-all font-mono text-[10px] text-mute-500 sm:hidden">
                    {entry.url} · {entry.ms}ms · {formatLocalTimestamp(entry.requestedAt)}
                </p>
                <div className="grid gap-x-4 lg:grid-cols-2">
                    <BodyBlock title="Request" value={entry.request} />
                    <BodyBlock title="Response" value={entry.response} />
                </div>
            </td>
        </tr>
    );
}

interface RequestRowProps {
    entry: LogEntry;
    isExpanded: boolean;
    isSelected: boolean;
    onToggleSelected: () => void;
    onToggleExpanded: () => void;
}

function RequestRow({ entry, isExpanded, isSelected, onToggleSelected, onToggleExpanded }: RequestRowProps) {
    const rowTone = isExpanded ? "bg-ink-800/60" : "hover:bg-ink-800/60";
    return (
        <>
            <tr
                onClick={onToggleExpanded}
                className={`cursor-pointer border-t border-ink-750 font-mono text-[11px] ${rowTone}`}
            >
                <SelectCell
                    label={`Select ${entry.method} ${entry.url}`}
                    isChecked={isSelected}
                    onToggle={onToggleSelected}
                />
                <td className="px-1 py-2">
                    <span className={`block h-1.5 w-1.5 rounded-full ${statusDotClassName(entry.ok)}`} />
                </td>
                <td className="px-2.5 py-2 text-mute-300">
                    {/* The row handles the click; the button gives keyboard users a focusable toggle. */}
                    <button type="button" aria-expanded={isExpanded} className="font-mono">
                        {entry.method}
                    </button>
                </td>
                <td className="truncate px-2.5 py-2 text-mute-400" title={entry.url}>
                    {entry.url}
                </td>
                <td className="px-2.5 py-2 text-mute-300">{entry.status}</td>
                <td className="hidden px-2.5 py-2 text-right text-mute-500 sm:table-cell">{entry.ms}ms</td>
                <td className="hidden px-2.5 py-2 text-mute-400 sm:table-cell">
                    {formatLocalTimestamp(entry.requestedAt)}
                </td>
            </tr>
            {isExpanded && <RequestDetail entry={entry} />}
        </>
    );
}

function TableHead() {
    return (
        <thead>
            <tr>
                <th className={`${tableHeadCellClassName} w-9`}>
                    <span className="sr-only">Select</span>
                </th>
                <th className={`${tableHeadCellClassName} w-4 px-1`}>
                    <span className="sr-only">Outcome</span>
                </th>
                <th className={`${tableHeadCellClassName} w-20`}>Method</th>
                <th className={tableHeadCellClassName}>URL</th>
                <th className={`${tableHeadCellClassName} w-16`}>Status</th>
                <th className={`${tableHeadCellClassName} hidden w-20 text-right sm:table-cell`}>ms</th>
                <th className={`${tableHeadCellClassName} hidden w-40 sm:table-cell`}>Requested</th>
            </tr>
        </thead>
    );
}

export default function RequestLogsTable({
    requestLogs,
    selectedUUIDs,
    onToggleSelected,
    initialExpandedUUID,
}: RequestLogsTableProps) {
    const [requestedPage, setRequestedPage] = useState(() => pageOfUUID(requestLogs, initialExpandedUUID));
    const [expandedUUIDs, setExpandedUUIDs] = useState(() => initialExpandedSet(initialExpandedUUID));
    const pageCount = pageCountFor(requestLogs.length);
    const page = clampPage(requestedPage, pageCount);

    if (requestLogs.length === 0) {
        return (
            <div className="p-4">
                <EmptyNote>No requests yet</EmptyNote>
            </div>
        );
    }
    return (
        <>
            <table className="w-full table-fixed">
                <TableHead />
                <tbody>
                    {rowsForPage(requestLogs, page).map((entry) => (
                        <RequestRow
                            key={entry.uuid}
                            entry={entry}
                            isExpanded={expandedUUIDs.has(entry.uuid)}
                            isSelected={selectedUUIDs.has(entry.uuid)}
                            onToggleSelected={() => onToggleSelected(entry.uuid)}
                            onToggleExpanded={() => setExpandedUUIDs(toggleInSet(expandedUUIDs, entry.uuid))}
                        />
                    ))}
                </tbody>
            </table>
            <Pagination page={page} pageCount={pageCount} onPageChange={setRequestedPage} />
        </>
    );
}
