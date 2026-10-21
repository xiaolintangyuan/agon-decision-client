import type { Conversation } from "./types";
import {
    CONVERSATIONS_INDEX,
    CONVERSATIONS_STORE,
    clearStore,
    deleteByKeys,
    listNewestFirst,
    openDatabase,
    requestToPromise,
    transactionDone,
} from "./db";

export function listConversations(): Promise<Conversation[]> {
    return listNewestFirst<Conversation>(CONVERSATIONS_STORE, CONVERSATIONS_INDEX);
}

export async function loadConversation(uuid: string): Promise<Conversation | undefined> {
    const database = await openDatabase();
    const transaction = database.transaction(CONVERSATIONS_STORE, "readonly");
    return requestToPromise<Conversation | undefined>(transaction.objectStore(CONVERSATIONS_STORE).get(uuid));
}

export async function saveConversation(conversation: Conversation): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(CONVERSATIONS_STORE, "readwrite");
    transaction.objectStore(CONVERSATIONS_STORE).put(conversation);
    await transactionDone(transaction);
}

export function deleteConversations(uuids: string[]): Promise<void> {
    return deleteByKeys(CONVERSATIONS_STORE, uuids);
}

export function deleteAllConversations(): Promise<void> {
    return clearStore(CONVERSATIONS_STORE);
}

export async function countConversations(): Promise<number> {
    const database = await openDatabase();
    const transaction = database.transaction(CONVERSATIONS_STORE, "readonly");
    return requestToPromise(transaction.objectStore(CONVERSATIONS_STORE).count());
}
