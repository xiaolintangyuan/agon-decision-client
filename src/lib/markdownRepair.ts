const FENCE_PATTERN = /^\s{0,3}(`{3,}|~{3,})/;
const WRAPPING_MARKDOWN_FENCE_PATTERN = /^\s*(`{3,}|~{3,})(?:markdown|md)[ \t]*\n([\s\S]*)\n\1[ \t]*\s*$/i;
const GLUED_HEADING_PATTERN = /^(#{2,6})(?=[^\s#])/;
const BULLET_CHARACTER_PATTERN = /^(\s*)[•·●▪]\s+/;
const LIST_ITEM_PATTERN = /^\s*([-*+]|\d{1,9}[.)])\s+/;
const HORIZONTAL_RULE_PATTERN = /^\s*([-*_])(\s*\1){2,}\s*$/;
const TABLE_SEPARATOR_PATTERN = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

interface TextSegment {
    isCode: boolean;
    lines: string[];
}

interface SegmentedText {
    segments: TextSegment[];
    unclosedFence: string | null;
}

function readFence(line: string): string | null {
    const match = FENCE_PATTERN.exec(line);
    if (match === null) {
        return null;
    }
    return match[1];
}

function closesFence(candidate: string, openFence: string): boolean {
    return candidate[0] === openFence[0] && candidate.length >= openFence.length;
}

function splitIntoSegments(text: string): SegmentedText {
    const segments: TextSegment[] = [];
    let current: TextSegment = { isCode: false, lines: [] };
    let openFence: string | null = null;

    for (const line of text.split("\n")) {
        const fence = readFence(line);
        if (openFence === null) {
            if (fence === null) {
                current.lines.push(line);
                continue;
            }
            segments.push(current);
            current = { isCode: true, lines: [line] };
            openFence = fence;
            continue;
        }
        current.lines.push(line);
        if (fence !== null && closesFence(fence, openFence)) {
            segments.push(current);
            current = { isCode: false, lines: [] };
            openFence = null;
        }
    }
    segments.push(current);

    const nonEmptySegments = segments.filter((segment) => segment.lines.length > 0);
    return { segments: nonEmptySegments, unclosedFence: openFence };
}

function transformOutsideCode(text: string, transformLines: (lines: string[]) => string[]): string {
    const { segments } = splitIntoSegments(text);
    const rebuiltLines: string[] = [];
    for (const segment of segments) {
        if (segment.isCode) {
            rebuiltLines.push(...segment.lines);
            continue;
        }
        rebuiltLines.push(...transformLines(segment.lines));
    }
    return rebuiltLines.join("\n");
}

export function normalizeLineEndings(text: string): string {
    return text.replace(/\r\n?/g, "\n");
}

// Some gateways double-encode the reply, so the whole answer arrives on one line with literal backslash-n.
export function restoreLiteralNewlines(text: string): string {
    if (text.includes("\n") || !text.includes("\\n")) {
        return text;
    }
    return text.replace(/\\n/g, "\n");
}

export function unwrapMarkdownFence(text: string): string {
    const match = WRAPPING_MARKDOWN_FENCE_PATTERN.exec(text);
    if (match === null) {
        return text;
    }
    return match[2];
}

export function closeUnclosedFence(text: string): string {
    const { unclosedFence } = splitIntoSegments(text);
    if (unclosedFence === null) {
        return text;
    }
    return `${text}\n${unclosedFence}`;
}

// Only two or more hashes are fixed, because a single "#word" is usually a hashtag or an issue number.
export function fixHeadingSpacing(text: string): string {
    return transformOutsideCode(text, (lines) => {
        return lines.map((line) => line.replace(GLUED_HEADING_PATTERN, "$1 "));
    });
}

export function normalizeBulletCharacters(text: string): string {
    return transformOutsideCode(text, (lines) => {
        return lines.map((line) => line.replace(BULLET_CHARACTER_PATTERN, "$1- "));
    });
}

function startsListAfterParagraph(line: string, previousLine: string): boolean {
    if (!LIST_ITEM_PATTERN.test(line) || HORIZONTAL_RULE_PATTERN.test(line)) {
        return false;
    }
    if (LIST_ITEM_PATTERN.test(previousLine)) {
        return false;
    }
    const isIndented = /^\s/.test(previousLine);
    return !isIndented && !previousLine.startsWith(">");
}

function startsTableAfterParagraph(line: string, nextLine: string | undefined, previousLine: string): boolean {
    if (nextLine === undefined || !line.includes("|") || !nextLine.includes("|")) {
        return false;
    }
    return TABLE_SEPARATOR_PATTERN.test(nextLine) && !previousLine.includes("|");
}

function separateBlocksInLines(lines: string[]): string[] {
    const result: string[] = [];
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const previousLine = result.length > 0 ? result[result.length - 1] : "";
        const followsParagraph = previousLine.trim() !== "";
        const startsBlock =
            startsListAfterParagraph(line, previousLine) ||
            startsTableAfterParagraph(line, lines[index + 1], previousLine);
        if (followsParagraph && startsBlock) {
            result.push("");
        }
        result.push(line);
    }
    return result;
}

// A list or table glued to the paragraph above it is not recognised by every parser, so give it a blank line.
export function separateBlocks(text: string): string {
    return transformOutsideCode(text, separateBlocksInLines);
}

export function repairMarkdown(text: string): string {
    let repaired = normalizeLineEndings(text);
    repaired = restoreLiteralNewlines(repaired);
    repaired = unwrapMarkdownFence(repaired);
    repaired = closeUnclosedFence(repaired);
    repaired = fixHeadingSpacing(repaired);
    repaired = normalizeBulletCharacters(repaired);
    repaired = separateBlocks(repaired);
    return repaired;
}
