import { useEffect, useState, useSyncExternalStore } from "react";
import type { Conversation, InterfaceMode, Turn } from "./types";
import { ConversationSession } from "./conversationSession";

export interface Conversations {
    /** Every stored conversation, newest first. The sidebar shows the first 10. */
    conversations: Conversation[];
    openConversation: Conversation;
    openUUID: string;
    turns: Turn[];
    mode: InterfaceMode;
    /** The user turn the open conversation is waiting a reply for, or null. */
    pendingAfterTurnId: string | null;
    /** True while the open conversation, and only it, has a request in flight. */
    isPending: boolean;
    /** True when the uuid is the conversation shown right now, read at call time for use after an await. */
    isOpen: (uuid: string) => boolean;
    startDraft: (mode: InterfaceMode) => void;
    /** Opens a stored conversation and, when its mode differs, asks the caller to switch the dialect. */
    open: (uuid: string) => Promise<void>;
    appendTurn: (uuid: string, turn: Turn) => void;
    beginExchange: (uuid: string, userTurnId: string) => void;
    endExchange: (uuid: string) => void;
    insertReply: (uuid: string, userTurnId: string, reply: Turn) => void;
    removeReply: (uuid: string, userTurnId: string) => void;
    rewindDecisionTurn: (userTurnId: string) => void;
    rewindChatTurn: (userTurnId: string) => void;
    clear: () => void;
    deleteSelected: (uuids: string[]) => Promise<void>;
    deleteAll: () => Promise<void>;
}

/** A new draft starts in `initialMode`; `onModeOpened` receives the mode of every conversation opened from storage. */
export function useConversations(
    initialMode: InterfaceMode,
    onModeOpened: (mode: InterfaceMode) => void,
): Conversations {
    const [session] = useState(() => new ConversationSession(initialMode));
    const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);

    useEffect(() => {
        void session.refreshList();
    }, [session]);

    async function open(uuid: string): Promise<void> {
        const conversation = await session.open(uuid);
        if (conversation !== undefined) {
            onModeOpened(conversation.mode);
        }
    }

    return {
        conversations: snapshot.conversations,
        openConversation: snapshot.open,
        openUUID: snapshot.open.uuid,
        turns: snapshot.open.content,
        mode: snapshot.open.mode,
        pendingAfterTurnId: snapshot.pendingAfterTurnId,
        isPending: snapshot.pendingAfterTurnId !== null,
        isOpen: session.isOpen,
        startDraft: session.startDraft,
        open,
        appendTurn: session.appendTurn,
        beginExchange: session.beginExchange,
        endExchange: session.endExchange,
        insertReply: session.insertReply,
        removeReply: session.removeReply,
        rewindDecisionTurn: session.rewindDecisionTurn,
        rewindChatTurn: session.rewindChatTurn,
        clear: session.clear,
        deleteSelected: session.deleteSelected,
        deleteAll: session.deleteAll,
    };
}
