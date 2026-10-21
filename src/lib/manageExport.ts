import type { Conversation, LogEntry } from "./types";
import { exportFileName, toExportedConversation, toExportedRequestLog } from "./conversationExport";
import { downloadJson } from "./downloadJson";

/** A null selection exports every row. */
function pickRows<Row extends { uuid: string }>(rows: Row[], selectedUUIDs: ReadonlySet<string> | null): Row[] {
    if (selectedUUIDs === null) {
        return rows;
    }
    return rows.filter((row) => selectedUUIDs.has(row.uuid));
}

export function exportConversations(conversations: Conversation[], selectedUUIDs: ReadonlySet<string> | null): void {
    const exported = pickRows(conversations, selectedUUIDs).map(toExportedConversation);
    downloadJson(exportFileName("conversations"), exported);
}

export function exportRequestLogs(requestLogs: LogEntry[], selectedUUIDs: ReadonlySet<string> | null): void {
    const exported = pickRows(requestLogs, selectedUUIDs).map(toExportedRequestLog);
    downloadJson(exportFileName("request-logs"), exported);
}
