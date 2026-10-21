const DOCUMENT_START_PATTERN = /^\s*(<!doctype\s+html|<html[\s>])/i;
const DOCUMENT_END_PATTERN = /<\/html>\s*$/i;
const HTML_FENCE_PATTERN = /^\s*(`{3,}|~{3,})html[ \t]*\n([\s\S]*)\n\1[ \t]*\s*$/i;

// Returns the page source when the whole reply is one HTML document (bare or in an html code fence).
// A snippet or a partial page stays ordinary markdown and shows up as code.
export function extractHtmlDocument(text: string): string | null {
    const fenceMatch = HTML_FENCE_PATTERN.exec(text);
    const candidate = fenceMatch === null ? text : fenceMatch[2];
    if (!DOCUMENT_START_PATTERN.test(candidate) || !DOCUMENT_END_PATTERN.test(candidate)) {
        return null;
    }
    return candidate.trim();
}
