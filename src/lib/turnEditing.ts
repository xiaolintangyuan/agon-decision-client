import type { Turn } from "./types";

/** A reply is the assistant turn that directly follows a user turn, 1 when it exists and 0 when it does not. */
function replyCount(turns: Turn[], userIndex: number): number {
    const following = turns[userIndex + 1];
    if (following === undefined || following.role !== "assistant") {
        return 0;
    }
    return 1;
}

/** Keeps the user turn and drops its reply. Later turns stay where they are. */
export function withoutReply(turns: Turn[], userTurnId: string): Turn[] {
    const userIndex = turns.findIndex((turn) => turn.id === userTurnId);
    if (userIndex === -1) {
        return turns;
    }
    const afterReply = userIndex + 1 + replyCount(turns, userIndex);
    return [...turns.slice(0, userIndex + 1), ...turns.slice(afterReply)];
}

/** Puts the reply directly after its user turn, which also covers a user turn whose reply was lost. */
export function withReply(turns: Turn[], userTurnId: string, reply: Turn): Turn[] {
    const userIndex = turns.findIndex((turn) => turn.id === userTurnId);
    if (userIndex === -1) {
        return turns;
    }
    return [...turns.slice(0, userIndex + 1), reply, ...turns.slice(userIndex + 1)];
}

/** Drops the user turn and its reply; the other turns stay. */
export function withoutTurnAndReply(turns: Turn[], userTurnId: string): Turn[] {
    const userIndex = turns.findIndex((turn) => turn.id === userTurnId);
    if (userIndex === -1) {
        return turns;
    }
    const afterReply = userIndex + 1 + replyCount(turns, userIndex);
    return [...turns.slice(0, userIndex), ...turns.slice(afterReply)];
}

/** The turns before the given one: the history a resent message is answered with, and what a chat rewind keeps. */
export function turnsBefore(turns: Turn[], turnId: string): Turn[] {
    const index = turns.findIndex((turn) => turn.id === turnId);
    if (index === -1) {
        return turns;
    }
    return turns.slice(0, index);
}
