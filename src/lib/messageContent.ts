import { extractHtmlDocument } from "./htmlDocument";
import { repairMarkdown } from "./markdownRepair";
import { splitReasoning } from "./reasoningSplit";

export interface MessageContent {
    reasoning: string;
    htmlDocument: string | null;
    markdown: string;
}

export function prepareMessageContent(text: string): MessageContent {
    const { reasoning, answer } = splitReasoning(text);
    return {
        reasoning,
        htmlDocument: extractHtmlDocument(answer),
        markdown: repairMarkdown(answer),
    };
}
