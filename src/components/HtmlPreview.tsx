import { useState, type ReactNode } from "react";
import { CodeBlock } from "./CodeBlock";

type PreviewTab = "preview" | "source";

interface HtmlPreviewProps {
    html: string;
    // Pre-rendered (highlighted) source element for the Source tab; the plain html is shown when omitted.
    children?: ReactNode;
}

// Scripts run so generated pages such as charts work. Leaving out allow-same-origin keeps the page in an
// opaque origin, so it cannot read this app's storage or saved API keys; popups and top navigation stay blocked.
const PREVIEW_SANDBOX = "allow-scripts";

const TAB_LABELS: Record<PreviewTab, string> = {
    preview: "Preview",
    source: "Source",
};

export function HtmlPreview({ html, children }: HtmlPreviewProps) {
    const [tab, setTab] = useState<PreviewTab>("preview");

    return (
        <div className="my-1">
            <div className="mb-2 flex gap-1">
                {(Object.keys(TAB_LABELS) as PreviewTab[]).map((tabName) => (
                    <button
                        key={tabName}
                        onClick={() => setTab(tabName)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                            tab === tabName
                                ? "bg-ink-700 text-mute-100"
                                : "text-mute-500 hover:text-mute-100"
                        }`}
                    >
                        {TAB_LABELS[tabName]}
                    </button>
                ))}
            </div>
            {tab === "preview" ? (
                <iframe
                    title="HTML preview"
                    sandbox={PREVIEW_SANDBOX}
                    srcDoc={html}
                    className="h-[420px] w-full rounded-xl border border-ink-700 bg-white"
                />
            ) : (
                <CodeBlock code={html} language="html">
                    {children}
                </CodeBlock>
            )}
        </div>
    );
}
