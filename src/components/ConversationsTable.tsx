import { useState } from "react";
import type { Conversation } from "../lib/types";
import { formatLocalTimestamp } from "../lib/format";
import { MODE_LABELS } from "../lib/listDisplay";
import { clampPage, pageCountFor, rowsForPage } from "../lib/pagination";
import { tableHeadCellClassName } from "../lib/dialogStyles";
import { EmptyNote, SelectCell } from "./Primitives";
import Pagination from "./Pagination";

interface ConversationsTableProps {
    /** Every stored conversation, newest first. */
    conversations: Conversation[];
    openConversationUUID: string;
    selectedUUIDs: ReadonlySet<string>;
    onToggleSelected: (uuid: string) => void;
    onOpenConversation: (uuid: string) => void;
}

interface ConversationRowProps {
    conversation: Conversation;
    isActive: boolean;
    isSelected: boolean;
    onToggleSelected: () => void;
    onOpen: () => void;
}

function ConversationRow({ conversation, isActive, isSelected, onToggleSelected, onOpen }: ConversationRowProps) {
    const rowTone = isActive ? "bg-brass-700/10" : "hover:bg-ink-800/60";
    return (
        <tr className={`border-t border-ink-750 ${rowTone}`}>
            <SelectCell label={`Select ${conversation.title}`} isChecked={isSelected} onToggle={onToggleSelected} />
            <td className="px-2.5 py-2">
                <button
                    type="button"
                    onClick={onOpen}
                    aria-current={isActive}
                    title={conversation.title}
                    className="block w-full truncate text-left text-[12px] font-medium text-mute-100 transition hover:text-brass-400"
                >
                    {conversation.title}
                </button>
            </td>
            <td className="hidden px-2.5 py-2 font-mono text-[11px] text-mute-400 sm:table-cell">
                {MODE_LABELS[conversation.mode]}
            </td>
            <td className="px-2.5 py-2 font-mono text-[11px] text-mute-400">
                {formatLocalTimestamp(conversation.updatedAt)}
            </td>
        </tr>
    );
}

export default function ConversationsTable({
    conversations,
    openConversationUUID,
    selectedUUIDs,
    onToggleSelected,
    onOpenConversation,
}: ConversationsTableProps) {
    const [requestedPage, setRequestedPage] = useState(1);
    const pageCount = pageCountFor(conversations.length);
    const page = clampPage(requestedPage, pageCount);

    if (conversations.length === 0) {
        return (
            <div className="p-4">
                <EmptyNote>No conversations yet</EmptyNote>
            </div>
        );
    }
    return (
        <>
            <table className="w-full table-fixed">
                <thead>
                    <tr>
                        <th className={`${tableHeadCellClassName} w-9`}>
                            <span className="sr-only">Select</span>
                        </th>
                        <th className={tableHeadCellClassName}>Title</th>
                        <th className={`${tableHeadCellClassName} hidden w-24 sm:table-cell`}>Mode</th>
                        <th className={`${tableHeadCellClassName} w-40`}>Last Updated</th>
                    </tr>
                </thead>
                <tbody>
                    {rowsForPage(conversations, page).map((conversation) => (
                        <ConversationRow
                            key={conversation.uuid}
                            conversation={conversation}
                            isActive={conversation.uuid === openConversationUUID}
                            isSelected={selectedUUIDs.has(conversation.uuid)}
                            onToggleSelected={() => onToggleSelected(conversation.uuid)}
                            onOpen={() => onOpenConversation(conversation.uuid)}
                        />
                    ))}
                </tbody>
            </table>
            <Pagination page={page} pageCount={pageCount} onPageChange={setRequestedPage} />
        </>
    );
}
