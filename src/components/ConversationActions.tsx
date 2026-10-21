import type { LucideIcon } from "lucide-react";

export interface ConversationAction {
    id: string;
    label: string;
    icon: LucideIcon;
    handler: () => void;
    disabled: boolean;
}

interface ConversationActionsProps {
    actions: ConversationAction[];
}

export default function ConversationActions({ actions }: ConversationActionsProps) {
    return (
        <div className="flex shrink-0 items-center gap-1.5">
            {actions.map((action) => {
                const Icon = action.icon;
                return (
                    <button
                        key={action.id}
                        type="button"
                        onClick={action.handler}
                        disabled={action.disabled}
                        aria-label={action.label}
                        title={action.label}
                        className="rounded-lg border border-ink-700 bg-ink-800 p-2 text-mute-300 transition hover:border-brass-700 hover:text-brass-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-ink-700 disabled:hover:text-mute-300"
                    >
                        <Icon size={14} />
                    </button>
                );
            })}
        </div>
    );
}
