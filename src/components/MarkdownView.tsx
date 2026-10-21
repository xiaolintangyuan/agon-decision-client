import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown, { type Components, type ExtraProps, type Options } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";

type PreProps = ComponentPropsWithoutRef<"pre"> & ExtraProps;
type LinkProps = ComponentPropsWithoutRef<"a"> & ExtraProps;
type ImageProps = ComponentPropsWithoutRef<"img"> & ExtraProps;
type TableProps = ComponentPropsWithoutRef<"table"> & ExtraProps;
type HastChild = NonNullable<PreProps["node"]>["children"][number];

interface CodeBlockData {
    code: string;
    language: string;
}

const REMARK_PLUGINS = [remarkGfm];
// Order matters: raw HTML is parsed first, then sanitized with the default allowlist (no script, style,
// iframe, event handlers or javascript: URLs; unknown tags keep their text). Highlighting runs last so
// the hljs classes it adds are not stripped by the sanitizer.
const REHYPE_PLUGINS: NonNullable<Options["rehypePlugins"]> = [
    rehypeRaw,
    rehypeSanitize,
    [rehypeHighlight, { ignoreMissing: true }],
];
const REMARK_REHYPE_OPTIONS: Options["remarkRehypeOptions"] = { allowDangerousHtml: true };

function readLanguage(classNames: unknown): string {
    if (!Array.isArray(classNames)) {
        return "";
    }
    for (const className of classNames) {
        if (typeof className === "string" && className.startsWith("language-")) {
            return className.slice("language-".length);
        }
    }
    return "";
}

// Highlighted code is nested span elements, so the plain text for the Copy button is collected recursively.
function collectText(children: HastChild[]): string {
    let text = "";
    for (const child of children) {
        if (child.type === "text") {
            text += child.value;
        }
        if (child.type === "element") {
            text += collectText(child.children);
        }
    }
    return text;
}

function readCodeBlock(node: PreProps["node"]): CodeBlockData | null {
    const codeElement = node?.children[0];
    if (codeElement === undefined || codeElement.type !== "element" || codeElement.tagName !== "code") {
        return null;
    }
    return {
        code: collectText(codeElement.children),
        language: readLanguage(codeElement.properties.className),
    };
}

function PreBlock({ node, children }: PreProps) {
    const codeBlock = readCodeBlock(node);
    if (codeBlock === null) {
        return <pre>{children}</pre>;
    }
    return (
        <CodeBlock code={codeBlock.code} language={codeBlock.language}>
            {children}
        </CodeBlock>
    );
}

function ExternalLink({ href, children }: LinkProps) {
    return (
        <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
        </a>
    );
}

// A relative src would resolve against this app's own origin, so only absolute web images are shown.
function ChatImage({ src, alt }: ImageProps) {
    if (typeof src !== "string" || !/^https?:\/\//i.test(src)) {
        return null;
    }
    return <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" />;
}

function ScrollableTable({ children }: TableProps) {
    return (
        <div className="chat-table-scroll">
            <table>{children}</table>
        </div>
    );
}

const MARKDOWN_COMPONENTS: Components = {
    pre: PreBlock,
    a: ExternalLink,
    img: ChatImage,
    table: ScrollableTable,
};

export function MarkdownView({ markdown }: { markdown: string }) {
    return (
        <div className="chat-markdown">
            <ReactMarkdown
                remarkPlugins={REMARK_PLUGINS}
                remarkRehypeOptions={REMARK_REHYPE_OPTIONS}
                rehypePlugins={REHYPE_PLUGINS}
                components={MARKDOWN_COMPONENTS}
            >
                {markdown}
            </ReactMarkdown>
        </div>
    );
}
