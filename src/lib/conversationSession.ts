import type { Conversation, InterfaceMode, Turn } from "./types";
import {
    countConversations,
    deleteAllConversations,
    deleteConversations,
    listConversations,
    loadConversation,
    saveConversation,
} from "./conversationStore";
import { titleFromUserTurn, untitledTitle } from "./conversationTitle";
import { turnsBefore, withReply, withoutReply, withoutTurnAndReply } from "./turnEditing";

export interface ConversationSnapshot {
    /** Every stored conversation, newest `updatedAt` first. */
    conversations: Conversation[];
    open: Conversation;
    /** The user turn the open conversation is waiting a reply for, or null when it is not waiting. */
    pendingAfterTurnId: string | null;
}

interface CacheEntry {
    /** Always the latest content. Every change builds on this, never on a copy read earlier. */
    conversation: Conversation;
    /** False for a draft that was never queued for storage, so it is not in the database. */
    queued: boolean;
    /** Saves queued or running; an entry that is not open, not waiting and has none left is dropped. */
    unsavedCount: number;
}

function createDraft(mode: InterfaceMode): Conversation {
    const now = Date.now();
    return { uuid: crypto.randomUUID(), title: "", mode, content: [], createdAt: now, updatedAt: now };
}

function firstUserTitle(conversation: Conversation): string {
    const firstUserTurn = conversation.content.find((turn) => turn.role === "user");
    if (firstUserTurn === undefined) {
        return "";
    }
    return titleFromUserTurn(firstUserTurn);
}

/**
 * Holds every conversation the app touched this session, and is the only writer of the conversation store.
 *
 * A reply can arrive long after the user moved on, and a demo reply arrives before the save of the user turn
 * has finished. Two rules keep that correct: each change is applied to the latest cached content of its own
 * conversation (found by uuid, never through the open one), and the saves of one conversation run one after
 * another, each writing whatever the cache holds at that moment, so an older snapshot cannot overwrite a newer one.
 */
export class ConversationSession {
    private readonly cache = new Map<string, CacheEntry>();
    private readonly saveChains = new Map<string, Promise<void>>();
    private readonly pendingByUUID = new Map<string, string>();
    private readonly listeners = new Set<() => void>();
    private storedConversations: Conversation[] = [];
    private openUUID: string;
    private snapshot: ConversationSnapshot;
    private latestListRead = 0;

    constructor(initialMode: InterfaceMode) {
        const draft = createDraft(initialMode);
        this.cache.set(draft.uuid, { conversation: draft, queued: false, unsavedCount: 0 });
        this.openUUID = draft.uuid;
        this.snapshot = this.buildSnapshot();
    }

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    getSnapshot = (): ConversationSnapshot => {
        return this.snapshot;
    };

    isOpen = (uuid: string): boolean => {
        return this.openUUID === uuid;
    };

    refreshList = async (): Promise<void> => {
        this.latestListRead += 1;
        const thisRead = this.latestListRead;
        try {
            const conversations = await listConversations();
            // A slower, older read must not replace the result of a newer one.
            if (thisRead === this.latestListRead) {
                this.storedConversations = conversations;
                this.publish();
            }
        } catch (error) {
            console.error("The conversation list could not be read from IndexedDB.", error);
        }
    };

    startDraft = (mode: InterfaceMode): void => {
        const draft = createDraft(mode);
        this.cache.set(draft.uuid, { conversation: draft, queued: false, unsavedCount: 0 });
        this.show(draft.uuid);
    };

    /** Resolves to undefined when the conversation cannot be loaded. */
    open = async (uuid: string): Promise<Conversation | undefined> => {
        if (!this.cache.has(uuid)) {
            const stored = await this.loadStored(uuid);
            if (stored === undefined) {
                void this.refreshList();
                return undefined;
            }
            // A concurrent open of the same uuid may have cached it first, and that copy is the newer one.
            if (!this.cache.has(uuid)) {
                this.cache.set(uuid, { conversation: stored, queued: true, unsavedCount: 0 });
            }
        }
        this.show(uuid);
        return this.openEntry().conversation;
    };

    appendTurn = (uuid: string, turn: Turn): void => {
        this.changeContent(uuid, (turns) => [...turns, turn]);
    };

    beginExchange = (uuid: string, userTurnId: string): void => {
        this.pendingByUUID.set(uuid, userTurnId);
        this.publish();
    };

    endExchange = (uuid: string): void => {
        this.pendingByUUID.delete(uuid);
        this.publish();
    };

    insertReply = (uuid: string, userTurnId: string, reply: Turn): void => {
        this.changeContent(uuid, (turns) => withReply(turns, userTurnId, reply));
    };

    removeReply = (uuid: string, userTurnId: string): void => {
        this.changeContent(uuid, (turns) => withoutReply(turns, userTurnId));
    };

    rewindDecisionTurn = (userTurnId: string): void => {
        this.changeContent(this.openUUID, (turns) => withoutTurnAndReply(turns, userTurnId));
    };

    rewindChatTurn = (userTurnId: string): void => {
        this.changeContent(this.openUUID, (turns) => turnsBefore(turns, userTurnId));
    };

    /** Empties the open conversation but keeps its uuid and title. A draft has nothing to empty. */
    clear = (): void => {
        if (this.openEntry().conversation.content.length === 0) {
            return;
        }
        this.changeContent(this.openUUID, () => []);
    };

    deleteSelected = async (uuids: string[]): Promise<void> => {
        await this.removeConversations(uuids, () => deleteConversations(uuids));
    };

    deleteAll = async (): Promise<void> => {
        const queuedUUIDs: string[] = [];
        for (const [uuid, entry] of this.cache) {
            if (entry.queued) {
                queuedUUIDs.push(uuid);
            }
        }
        await this.removeConversations(queuedUUIDs, deleteAllConversations);
    };

    private openEntry(): CacheEntry {
        const entry = this.cache.get(this.openUUID);
        if (entry === undefined) {
            throw new Error("The open conversation is missing from the session cache.");
        }
        return entry;
    }

    private buildSnapshot(): ConversationSnapshot {
        return {
            conversations: this.storedConversations,
            open: this.openEntry().conversation,
            pendingAfterTurnId: this.pendingByUUID.get(this.openUUID) ?? null,
        };
    }

    private publish(): void {
        this.snapshot = this.buildSnapshot();
        for (const listener of this.listeners) {
            listener();
        }
    }

    private show(uuid: string): void {
        this.openUUID = uuid;
        this.dropIdleEntries();
        this.publish();
    }

    private dropIdleEntries(): void {
        for (const [uuid, entry] of this.cache) {
            const inUse = uuid === this.openUUID || entry.unsavedCount > 0 || this.pendingByUUID.has(uuid);
            if (!inUse) {
                this.cache.delete(uuid);
                this.saveChains.delete(uuid);
            }
        }
    }

    private async loadStored(uuid: string): Promise<Conversation | undefined> {
        try {
            return await loadConversation(uuid);
        } catch (error) {
            console.error(`Conversation ${uuid} could not be loaded from IndexedDB.`, error);
            return undefined;
        }
    }

    /** A change to a conversation that was deleted meanwhile is dropped, so a late reply cannot bring it back. */
    private changeContent(uuid: string, update: (turns: Turn[]) => Turn[]): void {
        const entry = this.cache.get(uuid);
        if (entry === undefined) {
            return;
        }
        const content = update(entry.conversation.content);
        entry.conversation = { ...entry.conversation, content, updatedAt: Date.now() };
        this.queueSave(uuid, entry);
        this.publish();
    }

    private queueSave(uuid: string, entry: CacheEntry): void {
        entry.queued = true;
        entry.unsavedCount += 1;
        const previousSave = this.saveChains.get(uuid) ?? Promise.resolve();
        this.saveChains.set(uuid, previousSave.then(() => this.persist(uuid, entry)));
    }

    /** Never rejects, so one failed save cannot stop the saves queued behind it. */
    private async persist(uuid: string, entry: CacheEntry): Promise<void> {
        try {
            await this.completeFirstSave(uuid);
            const latest = this.cache.get(uuid);
            if (latest === undefined) {
                return;
            }
            await saveConversation(latest.conversation);
        } catch (error) {
            console.error(`Conversation ${uuid} could not be saved to IndexedDB.`, error);
        } finally {
            entry.unsavedCount -= 1;
        }
        await this.refreshList();
    }

    /** A draft gets its title and creation time when it is first stored, not when it is created. */
    private async completeFirstSave(uuid: string): Promise<void> {
        const entry = this.cache.get(uuid);
        if (entry === undefined || entry.conversation.title !== "") {
            return;
        }
        const title = await this.chooseTitle(entry.conversation);
        // The cache may have moved on while the count was read, so the title is applied to the latest content.
        const latest = this.cache.get(uuid);
        if (latest === undefined || latest.conversation.title !== "") {
            return;
        }
        const createdAt = latest.conversation.content[0]?.createdAt ?? Date.now();
        latest.conversation = { ...latest.conversation, title, createdAt };
        this.publish();
    }

    private async chooseTitle(conversation: Conversation): Promise<string> {
        const title = firstUserTitle(conversation);
        if (title !== "") {
            return title;
        }
        return untitledTitle(await countConversations());
    }

    /** Forgets the conversations and returns their running saves, which must finish before the store delete. */
    private forget(uuids: string[]): Promise<void>[] {
        const runningSaves: Promise<void>[] = [];
        for (const uuid of uuids) {
            const chain = this.saveChains.get(uuid);
            if (chain !== undefined) {
                runningSaves.push(chain);
            }
            this.saveChains.delete(uuid);
            this.cache.delete(uuid);
            this.pendingByUUID.delete(uuid);
        }
        return runningSaves;
    }

    private async removeConversations(uuids: string[], deleteFromStore: () => Promise<void>): Promise<void> {
        const openMode = this.openEntry().conversation.mode;
        const openWasRemoved = uuids.includes(this.openUUID);
        const runningSaves = this.forget(uuids);
        if (openWasRemoved) {
            this.startDraft(openMode);
        } else {
            this.publish();
        }
        await Promise.all(runningSaves);
        try {
            await deleteFromStore();
        } catch (error) {
            console.error("Conversations could not be deleted from IndexedDB.", error);
        }
        await this.refreshList();
    }
}
