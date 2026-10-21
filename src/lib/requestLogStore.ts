import type { LogEntry } from "./types";
import {
    REQUEST_LOGS_INDEX,
    REQUEST_LOGS_STORE,
    clearStore,
    deleteByKeys,
    listNewestFirst,
    openDatabase,
    transactionDone,
} from "./db";

const MAX_LOG_ENTRIES = 100;

/** Keys arrive oldest first, so the surplus is the front of the list. */
function surplusKeys(keys: IDBValidKey[]): IDBValidKey[] {
    const surplusCount = Math.max(0, keys.length - MAX_LOG_ENTRIES);
    return keys.slice(0, surplusCount);
}

/** Inserts the entry and drops the oldest ones beyond the limit, in one transaction. */
export async function addLogEntry(entry: LogEntry): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(REQUEST_LOGS_STORE, "readwrite");
    const store = transaction.objectStore(REQUEST_LOGS_STORE);
    store.put(entry);
    // Requests of one transaction run in order, so this read already sees the entry just put.
    const keysRequest = store.index(REQUEST_LOGS_INDEX).getAllKeys();
    keysRequest.onsuccess = () => {
        for (const key of surplusKeys(keysRequest.result)) {
            store.delete(key);
        }
    };
    await transactionDone(transaction);
}

export function listLogEntries(): Promise<LogEntry[]> {
    return listNewestFirst<LogEntry>(REQUEST_LOGS_STORE, REQUEST_LOGS_INDEX);
}

export function deleteLogEntries(uuids: string[]): Promise<void> {
    return deleteByKeys(REQUEST_LOGS_STORE, uuids);
}

export function deleteAllLogEntries(): Promise<void> {
    return clearStore(REQUEST_LOGS_STORE);
}
