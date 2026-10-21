import type { Turn } from "./types";

const TITLE_WORD_COUNT = 3;

/** The first three whitespace-separated words, or "" when the text has none. */
export function titleFromMessage(text: string): string {
    const words = text.split(/\s+/).filter((word) => word !== "");
    return words.slice(0, TITLE_WORD_COUNT).join(" ");
}

export function untitledTitle(storedCount: number): string {
    return `Untitled ${storedCount + 1}`;
}

/**
 * The title source for a user turn: its state, or when the state is empty the first question's instructions
 * (a Decision turn may carry only a free-text question). "" means the caller falls back to `untitledTitle`.
 */
export function titleFromUserTurn(turn: Turn): string {
    const stateTitle = titleFromMessage(turn.state ?? "");
    if (stateTitle !== "") {
        return stateTitle;
    }
    const firstQuestion = turn.questions?.[0];
    if (firstQuestion === undefined) {
        return "";
    }
    return titleFromMessage(firstQuestion.instructions);
}
