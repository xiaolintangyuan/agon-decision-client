import { useMemo, useState } from "react";
import { Brain, Code, Eye } from "lucide-react";
import { prepareMessageContent } from "../lib/messageContent";
import { HtmlPreview } from "./HtmlPreview";
import { MarkdownView } from "./MarkdownView";

function ReasoningSection({ reasoning }: { reasoning: string }) {
    return (
        <details className="group mb-2 rounded-lg border border-ink-750 bg-ink-900/60 px-3 py-2">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] text-mute-500 hover:text-mute-300">
                <Brain size={12} />
                Thinking
            </summary>
            <p className="mt-2 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-mute-400">
                {reasoning}
            </p>
        </details>
    );
}

export function AssistantMessage({ text }: { text: string }) {
    const [showRaw, setShowRaw] = useState(false);
    const content = useMemo(() => prepareMessageContent(text), [text]);

    function renderBody() {
        if (showRaw) {
            return (
                <pre className="whitespace-pre-wrap break-words text-[12.5px] leading-relaxed">
                    <code className="font-code">{text}</code>
                </pre>
            );
        }
        if (content.htmlDocument !== null) {
            return <HtmlPreview html={content.htmlDocument} />;
        }
        return <MarkdownView markdown={content.markdown} />;
    }

    return (
        <div>
            <div className="rounded-2xl rounded-bl-md border border-ink-700 bg-ink-850/70 px-4 py-3 text-[13.5px] leading-relaxed text-mute-100">
                {content.reasoning !== "" && <ReasoningSection reasoning={content.reasoning} />}
                {renderBody()}
            </div>
            <div className="mt-1 flex">
                <button
                    onClick={() => setShowRaw((current) => !current)}
                    title="Switch between the formatted reply and the exact text the model returned"
                    className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[11px] text-mute-500 transition hover:text-mute-100"
                >
                    {showRaw ? <Eye size={11} /> : <Code size={11} />}
                    {showRaw ? "Show formatted" : "Show raw text"}
                </button>
            </div>
        </div>
    );
}
