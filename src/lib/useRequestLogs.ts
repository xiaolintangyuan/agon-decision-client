import { useEffect, useSyncExternalStore } from "react";
import type { LogEntry } from "./types";
import { setRequestLogSink } from "./api";
import { addLogEntry, deleteAllLogEntries, deleteLogEntries, listLogEntries } from "./requestLogStore";

export interface RequestLogs {
    /** Every stored request, newest first. */
    logs: LogEntry[];
    deleteSelected: (uuids: string[]) => Promise<void>;
    deleteAll: () => Promise<void>;
}

// The list lives at module level so every component that reads it sees the same one.
let currentLogs: LogEntry[] = [];
let latestRead = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function getSnapshot(): LogEntry[] {
    return currentLogs;
}

async function refreshLogs(): Promise<void> {
    latestRead += 1;
    const thisRead = latestRead;
    try {
        const entries = await listLogEntries();
        // A slower, older read must not replace the result of a newer one.
        if (thisRead !== latestRead) {
            return;
        }
        currentLogs = entries;
        for (const listener of listeners) {
            listener();
        }
    } catch (error) {
        console.error("The request logs could not be read from IndexedDB.", error);
    }
}

async function storeEntry(entry: LogEntry): Promise<void> {
    try {
        await addLogEntry(entry);
    } catch (error) {
        console.error("A request log entry could not be saved to IndexedDB.", error);
    }
    await refreshLogs();
}

async function deleteSelected(uuids: string[]): Promise<void> {
    try {
        await deleteLogEntries(uuids);
    } catch (error) {
        console.error("The selected request logs could not be deleted from IndexedDB.", error);
    }
    await refreshLogs();
}

async function deleteAll(): Promise<void> {
    try {
        await deleteAllLogEntries();
    } catch (error) {
        console.error("The request logs could not be deleted from IndexedDB.", error);
    }
    await refreshLogs();
}

/**
 * Mount this once, in `App`: it also connects `api.ts` to the request log store. The connection is made in an
 * effect and undone in its cleanup, so React StrictMode's double effect run ends with exactly one sink.
 */
export function useRequestLogs(): RequestLogs {
    const logs = useSyncExternalStore(subscribe, getSnapshot);

    useEffect(() => {
        setRequestLogSink(storeEntry);
        void refreshLogs();
        return () => {
            setRequestLogSink(null);
        };
    }, []);

    return { logs, deleteSelected, deleteAll };
}
