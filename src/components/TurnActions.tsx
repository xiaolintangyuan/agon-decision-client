import { Rewind, RotateCcw } from "lucide-react";
import type { InterfaceMode } from "../lib/types";

interface TurnActionsProps {
    mode: InterfaceMode;
    /** True while the conversation waits for a reply; both actions change the transcript. */
    disabled: boolean;
    onReplay: () => void;
    onRewind: () => void;
}

// Replay means two different things, so the tooltip says which one this mode does.
const REPLAY_TITLE: Record<InterfaceMode, string> = {
    decision: "Load into the form",
    chat: "Resend",
};

const REWIND_TITLE: Record<InterfaceMode, string> = {
    decision: "Remove this turn and load it into the form",
    chat: "Remove this message and everything after it",
};

const BUTTON_CLASS =
    "inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[11px] text-mute-500 transition " +
    "enabled:hover:text-brass-400 disabled:cursor-not-allowed disabled:opacity-40";

export default function TurnActions({ mode, disabled, onReplay, onRewind }: TurnActionsProps) {
    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={onReplay}
                disabled={disabled}
                title={REPLAY_TITLE[mode]}
                className={BUTTON_CLASS}
            >
                <RotateCcw size={11} />
                Replay
            </button>
            <button
                type="button"
                onClick={onRewind}
                disabled={disabled}
                title={REWIND_TITLE[mode]}
                className={BUTTON_CLASS}
            >
                <Rewind size={11} />
                Rewind
            </button>
        </div>
    );
}
