import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { Conversation, LogEntry } from "../lib/types";
import { exportConversations, exportRequestLogs } from "../lib/manageExport";
import { toggleInSet } from "../lib/toggleInSet";
import { dangerButtonClassName, primaryButtonClassName, secondaryButtonClassName } from "../lib/dialogStyles";
import { ConfirmButton, ModalShell } from "./Primitives";
import ConversationsTable from "./ConversationsTable";
import RequestLogsTable from "./RequestLogsTable";

export type ManageDialogTab = "conversations" | "requests";

export interface ManageDialogRequest {
    tab: ManageDialogTab;
    expandedLogUUID?: string;
}

type DeleteHandler = (uuids: string[]) => void | Promise<void>;
type DeleteAllHandler = () => void | Promise<void>;

export interface ManageDialogProps {
    /** Null keeps the dialog closed. A request opens it on that tab. */
    request: ManageDialogRequest | null;
    onClose: () => void;
    /** Every stored conversation, newest first. */
    conversations: Conversation[];
    openConversationUUID: string;
    onOpenConversation: (uuid: string) => void;
    onDeleteConversations: DeleteHandler;
    onDeleteAllConversations: DeleteAllHandler;
    /** Every stored request, newest first. */
    requestLogs: LogEntry[];
    onDeleteRequestLogs: DeleteHandler;
    onDeleteAllRequestLogs: DeleteAllHandler;
}

type DialogViewProps = Omit<ManageDialogProps, "request"> & { request: ManageDialogRequest };

interface TabOperations {
    total: number;
    deleteSelected: DeleteHandler;
    deleteAll: DeleteAllHandler;
    exportRows: (selectedUUIDs: ReadonlySet<string> | null) => void;
}

const TABS: { id: ManageDialogTab; label: string }[] = [
    { id: "conversations", label: "Conversations" },
    { id: "requests", label: "Requests" },
];

function operationsFor(tab: ManageDialogTab, props: DialogViewProps): TabOperations {
    if (tab === "conversations") {
        return {
            total: props.conversations.length,
            deleteSelected: props.onDeleteConversations,
            deleteAll: props.onDeleteAllConversations,
            exportRows: (selectedUUIDs) => exportConversations(props.conversations, selectedUUIDs),
        };
    }
    return {
        total: props.requestLogs.length,
        deleteSelected: props.onDeleteRequestLogs,
        deleteAll: props.onDeleteAllRequestLogs,
        exportRows: (selectedUUIDs) => exportRequestLogs(props.requestLogs, selectedUUIDs),
    };
}

interface TabBarProps {
    tab: ManageDialogTab;
    onChange: (tab: ManageDialogTab) => void;
}

function TabBar({ tab, onChange }: TabBarProps) {
    return (
        <div role="tablist" className="flex gap-1 border-b border-ink-700 px-3 sm:px-4">
            {TABS.map((entry) => {
                const isActive = entry.id === tab;
                const tone = isActive
                    ? "border-brass-500 text-brass-400"
                    : "border-transparent text-mute-400 hover:text-mute-100";
                return (
                    <button
                        key={entry.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onChange(entry.id)}
                        className={`-mb-px border-b-2 px-3 py-3 text-[12px] font-medium transition ${tone}`}
                    >
                        {entry.label}
                    </button>
                );
            })}
        </div>
    );
}

interface FooterProps {
    total: number;
    selectedCount: number;
    onDeleteAll: () => void;
    onDeleteSelected: () => void;
    onExportAll: () => void;
    onExportSelected: () => void;
    onClose: () => void;
}

function Footer({
    total,
    selectedCount,
    onDeleteAll,
    onDeleteSelected,
    onExportAll,
    onExportSelected,
    onClose,
}: FooterProps) {
    const hasSelection = selectedCount > 0;
    return (
        <footer className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-ink-700 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
                <ConfirmButton
                    label="Delete All"
                    confirmLabel="Delete all"
                    triggerClassName={dangerButtonClassName}
                    onConfirm={onDeleteAll}
                    disabled={total === 0}
                    variant="button"
                />
                {hasSelection && (
                    <button type="button" onClick={onDeleteSelected} className={secondaryButtonClassName}>
                        Delete Selected
                    </button>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={onExportAll}
                    disabled={total === 0}
                    className={secondaryButtonClassName}
                >
                    Export All
                </button>
                {hasSelection && (
                    <button type="button" onClick={onExportSelected} className={secondaryButtonClassName}>
                        Export Selected
                    </button>
                )}
            </div>
            <button type="button" onClick={onClose} className={`ml-auto ${primaryButtonClassName}`}>
                Close
            </button>
        </footer>
    );
}

interface TabBodyProps {
    tab: ManageDialogTab;
    conversations: Conversation[];
    openConversationUUID: string;
    requestLogs: LogEntry[];
    selectedUUIDs: ReadonlySet<string>;
    initialExpandedLogUUID: string | undefined;
    onToggleSelected: (uuid: string) => void;
    onOpenConversation: (uuid: string) => void;
}

function TabBody({
    tab,
    conversations,
    openConversationUUID,
    requestLogs,
    selectedUUIDs,
    initialExpandedLogUUID,
    onToggleSelected,
    onOpenConversation,
}: TabBodyProps) {
    if (tab === "conversations") {
        return (
            <ConversationsTable
                conversations={conversations}
                openConversationUUID={openConversationUUID}
                selectedUUIDs={selectedUUIDs}
                onToggleSelected={onToggleSelected}
                onOpenConversation={onOpenConversation}
            />
        );
    }
    return (
        <RequestLogsTable
            requestLogs={requestLogs}
            selectedUUIDs={selectedUUIDs}
            onToggleSelected={onToggleSelected}
            initialExpandedUUID={initialExpandedLogUUID}
        />
    );
}

function DialogView(props: DialogViewProps) {
    const { request, onClose, onOpenConversation } = props;
    const [tab, setTab] = useState<ManageDialogTab>(request.tab);
    const [initialExpandedLogUUID, setInitialExpandedLogUUID] = useState(request.expandedLogUUID);
    const [selectedUUIDs, setSelectedUUIDs] = useState<ReadonlySet<string>>(new Set());
    const operations = operationsFor(tab, props);

    function changeTab(nextTab: ManageDialogTab): void {
        setTab(nextTab);
        setSelectedUUIDs(new Set());
        setInitialExpandedLogUUID(undefined);
    }

    async function deleteSelected(): Promise<void> {
        await operations.deleteSelected([...selectedUUIDs]);
        setSelectedUUIDs(new Set());
    }

    async function deleteAll(): Promise<void> {
        await operations.deleteAll();
        setSelectedUUIDs(new Set());
    }

    function openConversation(uuid: string): void {
        onClose();
        onOpenConversation(uuid);
    }

    return (
        <ModalShell onClose={onClose} maxWidthClassName="max-w-[880px]" label="Manage conversations and requests">
            <TabBar tab={tab} onChange={changeTab} />
            <div role="tabpanel" className="min-h-[20rem] min-w-0 flex-1 overflow-y-auto">
                <TabBody
                    key={tab}
                    tab={tab}
                    conversations={props.conversations}
                    openConversationUUID={props.openConversationUUID}
                    requestLogs={props.requestLogs}
                    selectedUUIDs={selectedUUIDs}
                    initialExpandedLogUUID={initialExpandedLogUUID}
                    onToggleSelected={(uuid) => setSelectedUUIDs(toggleInSet(selectedUUIDs, uuid))}
                    onOpenConversation={openConversation}
                />
            </div>
            <Footer
                key={tab}
                total={operations.total}
                selectedCount={selectedUUIDs.size}
                onDeleteAll={() => void deleteAll()}
                onDeleteSelected={() => void deleteSelected()}
                onExportAll={() => operations.exportRows(null)}
                onExportSelected={() => operations.exportRows(selectedUUIDs)}
                onClose={onClose}
            />
        </ModalShell>
    );
}

export default function ManageDialog({ request, ...viewProps }: ManageDialogProps) {
    return (
        <AnimatePresence>
            {request !== null && <DialogView key="manage-dialog" request={request} {...viewProps} />}
        </AnimatePresence>
    );
}
