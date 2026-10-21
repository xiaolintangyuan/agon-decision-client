const DATABASE_NAME = "agon-decision-client";
const DATABASE_VERSION = 1;

export const CONVERSATIONS_STORE = "conversations";
export const REQUEST_LOGS_STORE = "request_logs";
export const CONVERSATIONS_INDEX = "updatedAt";
export const REQUEST_LOGS_INDEX = "requestedAt";

// React StrictMode runs every effect twice, so the open request is shared instead of started again.
let openPromise: Promise<IDBDatabase> | null = null;

function createStores(database: IDBDatabase): void {
    if (!database.objectStoreNames.contains(CONVERSATIONS_STORE)) {
        const conversations = database.createObjectStore(CONVERSATIONS_STORE, { keyPath: "uuid" });
        conversations.createIndex(CONVERSATIONS_INDEX, "updatedAt");
    }
    if (!database.objectStoreNames.contains(REQUEST_LOGS_STORE)) {
        const requestLogs = database.createObjectStore(REQUEST_LOGS_STORE, { keyPath: "uuid" });
        requestLogs.createIndex(REQUEST_LOGS_INDEX, "requestedAt");
    }
}

function startOpening(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") {
            reject(new Error("IndexedDB is not available in this browser."));
            return;
        }
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
            createStores(request.result);
        };
        request.onblocked = () => {
            console.warn("Opening the database is blocked by another tab that still uses an older version.");
        };
        request.onerror = () => {
            reject(request.error);
        };
        request.onsuccess = () => {
            const database = request.result;
            // A newer version in another tab needs this connection closed, or its upgrade would wait forever.
            database.onversionchange = () => {
                database.close();
                openPromise = null;
            };
            resolve(database);
        };
    });
}

export function openDatabase(): Promise<IDBDatabase> {
    if (openPromise !== null) {
        return openPromise;
    }
    const pendingPromise = startOpening();
    openPromise = pendingPromise;
    // A failed open must not be cached, or every later call would fail without trying again.
    pendingPromise.catch(() => {
        if (openPromise === pendingPromise) {
            openPromise = null;
        }
    });
    return pendingPromise;
}

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = () => {
            reject(request.error);
        };
    });
}

/** Resolves once the transaction is committed; a failed request or an abort rejects. */
export function transactionDone(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => {
            resolve();
        };
        transaction.onerror = () => {
            reject(transaction.error);
        };
        transaction.onabort = () => {
            reject(transaction.error ?? new Error("The database transaction was aborted."));
        };
    });
}

/** Reads every record of a store ordered by an index, largest value first. */
export async function listNewestFirst<T>(storeName: string, indexName: string): Promise<T[]> {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, "readonly");
    const index = transaction.objectStore(storeName).index(indexName);
    const records = await requestToPromise<T[]>(index.getAll());
    return records.reverse();
}

export async function deleteByKeys(storeName: string, keys: IDBValidKey[]): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    for (const key of keys) {
        store.delete(key);
    }
    await transactionDone(transaction);
}

export async function clearStore(storeName: string): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).clear();
    await transactionDone(transaction);
}
