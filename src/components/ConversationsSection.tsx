import { Plus } from "lucide-react";
import type { Conversation } from "../lib/types";
import { MODE_LABELS, SIDEBAR_ROW_LIMIT } from "../lib/listDisplay";
import { EmptyNote } from "./Primitives";
import ConversationActions, { type ConversationAction } from "./ConversationActions";
import { MoreButton } from "./SidebarSection";

export interface ConversationsSectionProps {
    /** Every stored conversation, newest first. */
    conversations: Conversation[];
    openConversationUUID: string;
    actions: ConversationAction[];
    onNewConversation: () => void;
    onOpenConversation: (uuid: string) => void;
}

interface ConversationsBodyProps extends ConversationsSectionProps {
    onShowMore: () => void;
}

interface ConversationRowProps {
    conversation: Conversation;
    isActive: boolean;
    onOpen: () => void;
}

function ConversationRow({ conversation, isActive, onOpen }: ConversationRowProps) {
    const rowTone = isActive
        ? "border-brass-600/60 bg-brass-700/10"
        : "border-ink-750 bg-ink-900/60 hover:border-ink-600";
    return (
        <li>
            <button
                type="button"
                onClick={onOpen}
                aria-current={isActive}
                title={conversation.title}
                className={`flex w-full min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left transition ${rowTone}`}
            >
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-mute-100">
                    {conversation.title}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-mute-500">{MODE_LABELS[conversation.mode]}</span>
            </button>
        </li>
    );
}

function ActionRow({ actions, onNewConversation }: Pick<ConversationsSectionProps, "actions" | "onNewConversation">) {
    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={onNewConversation}
                className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-[12px] font-medium text-mute-100 transition hover:border-brass-700 hover:text-brass-400"
            >
                <Plus size={13} />
                <span className="truncate">New Conversation</span>
            </button>
            <ConversationActions actions={actions} />
        </div>
    );
}

export default function ConversationsSection({
    conversations,
    openConversationUUID,
    actions,
    onNewConversation,
    onOpenConversation,
    onShowMore,
}: ConversationsBodyProps) {
    const visibleConversations = conversations.slice(0, SIDEBAR_ROW_LIMIT);
    return (
        <div className="space-y-3">
            <ActionRow actions={actions} onNewConversation={onNewConversation} />
            {conversations.length === 0 && <EmptyNote>No conversations yet</EmptyNote>}
            <ul className="space-y-1.5">
                {visibleConversations.map((conversation) => (
                    <ConversationRow
                        key={conversation.uuid}
                        conversation={conversation}
                        isActive={conversation.uuid === openConversationUUID}
                        onOpen={() => onOpenConversation(conversation.uuid)}
                    />
                ))}
            </ul>
            {conversations.length > SIDEBAR_ROW_LIMIT && <MoreButton onClick={onShowMore} />}
        </div>
    );
}
