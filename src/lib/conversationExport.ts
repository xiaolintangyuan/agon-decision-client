import type { Conversation, InterfaceMode, LogEntry, Turn } from "./types";
import { formatLocalTimestamp } from "./format";

export interface ExportedConversation {
    type: "conversation";
    version: 1;
    uuid: string;
    title: string;
    mode: InterfaceMode;
    createdAt: string;
    lastUpdated: string;
    content: Turn[];
}

export interface ExportedRequestLog {
    type: "request_log";
    version: 1;
    uuid: string;
    requestedAt: string;
    method: string;
    url: string;
    status: number | "network";
    ms: number;
    ok: boolean;
    request: unknown;
    response: unknown;
}

export function toExportedConversation(conversation: Conversation): ExportedConversation {
    return {
        type: "conversation",
        version: 1,
        uuid: conversation.uuid,
        title: conversation.title,
        mode: conversation.mode,
        createdAt: formatLocalTimestamp(conversation.createdAt),
        lastUpdated: formatLocalTimestamp(conversation.updatedAt),
        content: conversation.content,
    };
}

export function toExportedRequestLog(entry: LogEntry): ExportedRequestLog {
    return {
        type: "request_log",
        version: 1,
        uuid: entry.uuid,
        requestedAt: formatLocalTimestamp(entry.requestedAt),
        method: entry.method,
        url: entry.url,
        status: entry.status,
        ms: entry.ms,
        ok: entry.ok,
        request: entry.request,
        response: entry.response,
    };
}

/** `conversations-2026-10-22-14-05-09.json`: the local timestamp with dashes, so it is safe in a filename. */
export function exportFileName(prefix: "conversations" | "request-logs"): string {
    const timestamp = formatLocalTimestamp(Date.now()).replace(/[ :]/g, "-");
    return `${prefix}-${timestamp}.json`;
}
