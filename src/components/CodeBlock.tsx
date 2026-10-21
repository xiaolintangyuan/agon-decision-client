import type { ReactNode } from "react";
import { CopyButton } from "./Primitives";

interface CodeBlockProps {
    code: string;
    language: string;
    // Pre-rendered (highlighted) code element; the plain code string is used when it is omitted.
    children?: ReactNode;
}

export function CodeBlock({ code, language, children }: CodeBlockProps) {
    const displayCode = code.replace(/\n$/, "");
    const label = language === "" ? "text" : language;

    return (
        <div className="my-3 overflow-hidden rounded-xl border border-ink-700 bg-ink-950/80">
            <div className="flex items-center justify-between border-b border-ink-700 bg-ink-900 px-3 py-1.5">
                <span className="label-xs text-mute-500">{label}</span>
                <CopyButton text={displayCode} />
            </div>
            <pre className="overflow-x-auto px-3.5 py-3 text-[12.5px] leading-relaxed text-mute-100 [&_code]:font-code">
                {children ?? <code>{displayCode}</code>}
            </pre>
        </div>
    );
}
