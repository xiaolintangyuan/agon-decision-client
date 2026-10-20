import type { KeyboardEvent } from "react";
import { Send } from "lucide-react";

interface ChatComposerProps {
    value: string;
    onValueChange: (value: string) => void;
    onSend: () => void;
    busy: boolean;
    canSend: boolean;
}

export default function ChatComposer({ value, onValueChange, onSend, busy, canSend }: ChatComposerProps) {
    function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key !== "Enter" || event.shiftKey) {
            return;
        }
        // The window-level Ctrl/Cmd+Enter shortcut already sends; handling it here too would send twice.
        if (event.ctrlKey || event.metaKey) {
            return;
        }
        if (event.nativeEvent.isComposing) {
            return;
        }
        event.preventDefault();
        if (canSend && !busy) {
            onSend();
        }
    }

    return (
        <div className="shrink-0 border-t border-ink-700 bg-ink-900/85 backdrop-blur-xl">
            <div className="mx-auto w-full max-w-4xl px-4 py-3">
                <textarea
                    className="w-full resize-y rounded-xl border border-ink-700 bg-ink-950/70 px-3 py-2.5 text-[13px] leading-relaxed text-mute-100 outline-none transition placeholder:text-mute-600 focus:border-brass-600 focus:ring-1 focus:ring-brass-600/30"
                    rows={3}
                    placeholder="Message the model…"
                    value={value}
                    onChange={(event) => onValueChange(event.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <div className="mt-2 flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-mute-600">
                        Enter to send · Shift+Enter for a new line
                    </span>
                    <button
                        disabled={!canSend || busy}
                        onClick={onSend}
                        className="flex shrink-0 items-center gap-2 rounded-lg bg-brass-600 px-4 py-2 text-[12px] font-semibold text-ink-950 transition hover:bg-brass-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <Send size={13} />
                        {busy ? "Sending…" : "Send"}
                    </button>
                </div>
            </div>
        </div>
    );
}
