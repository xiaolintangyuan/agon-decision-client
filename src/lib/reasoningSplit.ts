export interface ReasoningSplit {
    reasoning: string;
    answer: string;
}

const COMPLETE_BLOCK_PATTERN = /<(think|thinking)>([\s\S]*?)<\/\1>/gi;
const OPEN_TAG_PATTERN = /<(?:think|thinking)>/i;
const CLOSE_TAG_PATTERN = /<\/(?:think|thinking)>/i;

function buildSplit(reasoningParts: string[], answer: string): ReasoningSplit {
    const nonEmptyParts = reasoningParts.filter((part) => part !== "");
    return {
        reasoning: nonEmptyParts.join("\n\n"),
        answer: answer.replace(/^\s*\n/, "").trimEnd(),
    };
}

// Reasoning models put their chain of thought in the content between think tags. Some drop the opening
// tag and some are cut off before the closing one, so those two shapes are handled as well.
export function splitReasoning(text: string): ReasoningSplit {
    const reasoningParts: string[] = [];
    const withoutBlocks = text.replace(COMPLETE_BLOCK_PATTERN, (_match, _tagName, body: string) => {
        reasoningParts.push(body.trim());
        return "";
    });

    const openMatch = OPEN_TAG_PATTERN.exec(withoutBlocks);
    if (openMatch !== null) {
        const afterTag = withoutBlocks.slice(openMatch.index + openMatch[0].length);
        reasoningParts.push(afterTag.trim());
        return buildSplit(reasoningParts, withoutBlocks.slice(0, openMatch.index));
    }

    const closeMatch = CLOSE_TAG_PATTERN.exec(withoutBlocks);
    if (closeMatch !== null) {
        reasoningParts.unshift(withoutBlocks.slice(0, closeMatch.index).trim());
        return buildSplit(reasoningParts, withoutBlocks.slice(closeMatch.index + closeMatch[0].length));
    }

    return buildSplit(reasoningParts, withoutBlocks);
}
