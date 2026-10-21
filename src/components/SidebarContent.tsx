import type { ComponentProps } from "react";
import type { ConnState, LogEntry } from "../lib/types";
import { useSectionState } from "../lib/useSectionState";
import SettingsPanel, { type SettingsPanelProps } from "./SettingsPanel";
import ConversationsSection, { type ConversationsSectionProps } from "./ConversationsSection";
import LogsSection from "./LogsSection";
import SidebarSection from "./SidebarSection";
import type { ManageDialogRequest } from "./ManageDialog";
import { Chip } from "./Primitives";

export interface SidebarContentProps {
    connection: SettingsPanelProps;
    conversations: ConversationsSectionProps;
    /** Every stored request, newest first. */
    requestLogs: LogEntry[];
    onOpenManageDialog: (request: ManageDialogRequest) => void;
}

type ChipTone = NonNullable<ComponentProps<typeof Chip>["tone"]>;

type OpenManageDialog = (request: ManageDialogRequest) => void;

const CONN_TONE: Record<ConnState, ChipTone> = {
    ok: "jade",
    error: "coral",
    testing: "brass",
    unknown: "neutral",
};

const CONN_TEXT: Record<ConnState, string> = {
    ok: "connected",
    error: "unreachable",
    testing: "connecting",
    unknown: "not connected",
};

function ConnectionsGroup({ connection }: { connection: SettingsPanelProps }) {
    const { isOpen, toggle } = useSectionState("connections");
    return (
        <SidebarSection
            title="Connections"
            isOpen={isOpen}
            onToggle={toggle}
            headingExtra={<Chip tone={CONN_TONE[connection.conn]}>{CONN_TEXT[connection.conn]}</Chip>}
        >
            <SettingsPanel {...connection} />
        </SidebarSection>
    );
}

interface ConversationsGroupProps {
    conversations: ConversationsSectionProps;
    onOpenManageDialog: OpenManageDialog;
}

function ConversationsGroup({ conversations, onOpenManageDialog }: ConversationsGroupProps) {
    const { isOpen, toggle } = useSectionState("conversations");
    const openDialog = () => onOpenManageDialog({ tab: "conversations" });
    return (
        <SidebarSection
            title="Conversations"
            isOpen={isOpen}
            onToggle={toggle}
            gear={{ tooltip: "Manage conversations", onClick: openDialog }}
        >
            <ConversationsSection {...conversations} onShowMore={openDialog} />
        </SidebarSection>
    );
}

interface LogsGroupProps {
    requestLogs: LogEntry[];
    onOpenManageDialog: OpenManageDialog;
}

function LogsGroup({ requestLogs, onOpenManageDialog }: LogsGroupProps) {
    const { isOpen, toggle } = useSectionState("logs");
    const openDialog = () => onOpenManageDialog({ tab: "requests" });
    return (
        <SidebarSection
            title="Logs"
            isOpen={isOpen}
            onToggle={toggle}
            gear={{ tooltip: "Manage requests", onClick: openDialog }}
        >
            <LogsSection
                requestLogs={requestLogs}
                onOpenRequest={(uuid) => onOpenManageDialog({ tab: "requests", expandedLogUUID: uuid })}
                onShowMore={openDialog}
            />
        </SidebarSection>
    );
}

export default function SidebarContent({
    connection,
    conversations,
    requestLogs,
    onOpenManageDialog,
}: SidebarContentProps) {
    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <ConnectionsGroup connection={connection} />
            <ConversationsGroup conversations={conversations} onOpenManageDialog={onOpenManageDialog} />
            <LogsGroup requestLogs={requestLogs} onOpenManageDialog={onOpenManageDialog} />
            <p className="px-4 pb-6 pt-5 text-[10px] leading-relaxed text-mute-600">
                Everything runs in your browser. Requests go straight from this page to your endpoint, with no
                proxy and no telemetry. Saved keys stay in this browser's localStorage.
            </p>
        </div>
    );
}
