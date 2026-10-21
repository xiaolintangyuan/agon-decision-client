import type { Dialect } from "./types";

// Session storage on purpose: the pick lasts for the tab, and a new session starts from the provider's list.
const SESSION_KEY_PREFIX = "decision-console.model";

function sessionKey(dialect: Dialect): string {
    return `${SESSION_KEY_PREFIX}.${dialect}`;
}

export function loadSelectedModel(dialect: Dialect): string | null {
    try {
        return sessionStorage.getItem(sessionKey(dialect));
    } catch (error) {
        console.warn("The selected model could not be read from sessionStorage.", error);
        return null;
    }
}

export function saveSelectedModel(dialect: Dialect, model: string): void {
    try {
        sessionStorage.setItem(sessionKey(dialect), model);
    } catch (error) {
        console.warn("The selected model could not be written to sessionStorage.", error);
    }
}

/** The remembered model when the list still has it, otherwise the first one. An empty list keeps what was remembered. */
export function resolveModel(models: string[], rememberedModel: string | null): string {
    if (rememberedModel !== null && (models.length === 0 || models.includes(rememberedModel))) {
        return rememberedModel;
    }
    if (models.length > 0) {
        return models[0];
    }
    return "";
}

export function filterModels(models: string[], query: string): string[] {
    const needle = query.trim().toLowerCase();
    if (needle === "") {
        return models;
    }
    return models.filter((model) => model.toLowerCase().includes(needle));
}
