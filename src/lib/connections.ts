import { useSyncExternalStore } from "react";
import type { SavedConnection } from "./types";
import { normalizeBaseUrl } from "./api";

export interface EndpointPreset {
    id: string;
    label: string;
    baseUrl: string;
    keyPlaceholder: string;
    description: string;
}

// Base URLs omit /v1 because apiUrl() appends it.
export const ENDPOINT_PRESETS: EndpointPreset[] = [
    {
        id: "openrouter",
        label: "OpenRouter",
        baseUrl: "https://openrouter.ai/api",
        keyPlaceholder: "sk-or-…",
        description: "Hosted gateway to hundreds of models",
    },
    {
        id: "unsloth",
        label: "Unsloth (localhost)",
        baseUrl: "http://localhost:8000",
        keyPlaceholder: "sk-unsloth-…",
        description: "Local server on its default port",
    },
    {
        id: "openai",
        label: "OpenAI",
        baseUrl: "https://api.openai.com",
        keyPlaceholder: "sk-…",
        description: "OpenAI's hosted API",
    },
    {
        id: "groq",
        label: "Groq",
        baseUrl: "https://api.groq.com/openai",
        keyPlaceholder: "gsk_…",
        description: "Fast hosted inference, OpenAI-compatible",
    },
    {
        id: "together",
        label: "Together AI",
        baseUrl: "https://api.together.xyz",
        keyPlaceholder: "Together API key",
        description: "Hosted open-weight models",
    },
    {
        id: "ollama",
        label: "Ollama (localhost)",
        baseUrl: "http://localhost:11434",
        keyPlaceholder: "No key needed",
        description: "Local Ollama server on its default port",
    },
    {
        id: "lmstudio",
        label: "LM Studio (localhost)",
        baseUrl: "http://localhost:1234",
        keyPlaceholder: "No key needed",
        description: "LM Studio's local server on its default port",
    },
    {
        id: "llamacpp",
        label: "llama.cpp server (localhost)",
        baseUrl: "http://localhost:8080",
        keyPlaceholder: "No key needed",
        description: "llama-server on its default port",
    },
];

// Separate from the app's main blob so "Clear conversation" never wipes saved keys.
const STORAGE_KEY = "decision-console.connections.v1";

const MASK_VISIBLE_PREFIX = 6;
const MASK_VISIBLE_SUFFIX = 4;

function isSavedConnection(value: unknown): value is SavedConnection {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.baseUrl === "string" &&
        candidate.baseUrl !== "" &&
        typeof candidate.apiKey === "string" &&
        typeof candidate.savedAt === "number" &&
        Number.isFinite(candidate.savedAt)
    );
}

export function loadSavedConnections(): SavedConnection[] {
    // localStorage throws in some private modes and the stored JSON may be hand-edited or truncated, so a
    // failure here must degrade to an empty list instead of breaking the whole app on startup.
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null) {
            return [];
        }
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.filter(isSavedConnection);
    } catch (error) {
        console.warn("Saved connections could not be read; starting with an empty list.", error);
        return [];
    }
}

export function findSavedConnection(
    connections: SavedConnection[],
    baseUrl: string,
): SavedConnection | undefined {
    const normalizedURL = normalizeBaseUrl(baseUrl);
    if (normalizedURL === "") {
        return undefined;
    }
    return connections.find((connection) => normalizeBaseUrl(connection.baseUrl) === normalizedURL);
}

export function presetForURL(baseUrl: string): EndpointPreset | undefined {
    const normalizedURL = normalizeBaseUrl(baseUrl);
    return ENDPOINT_PRESETS.find((preset) => normalizeBaseUrl(preset.baseUrl) === normalizedURL);
}

function hostFromURL(baseUrl: string): string {
    const withoutScheme = normalizeBaseUrl(baseUrl).replace(/^https?:\/\//i, "");
    return withoutScheme.split("/")[0];
}

/** The preset's name when the URL is a known one, otherwise the host, so a row is recognisable at a glance. */
export function connectionLabel(baseUrl: string): string {
    const preset = presetForURL(baseUrl);
    if (preset !== undefined) {
        return preset.label;
    }
    return hostFromURL(baseUrl);
}

/** Shows enough of the key to tell two keys apart without exposing it, e.g. `sk-or-…a1b2`. */
export function maskKey(apiKey: string): string {
    const trimmedKey = apiKey.trim();
    if (trimmedKey === "") {
        return "no key";
    }
    if (trimmedKey.length <= MASK_VISIBLE_PREFIX + MASK_VISIBLE_SUFFIX) {
        return "••••••";
    }
    const prefix = trimmedKey.slice(0, MASK_VISIBLE_PREFIX);
    const suffix = trimmedKey.slice(-MASK_VISIBLE_SUFFIX);
    return `${prefix}…${suffix}`;
}

// Every mounted hook instance (two sidebars plus the dialog) must see the same list, so the list lives at
// module level and components subscribe to it.
let currentConnections: SavedConnection[] = loadSavedConnections();
const listeners = new Set<() => void>();

function persistConnections(connections: SavedConnection[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
    } catch (error) {
        console.error("Saved connections could not be written to localStorage.", error);
    }
}

function publishConnections(next: SavedConnection[]): void {
    currentConnections = next;
    persistConnections(next);
    for (const listener of listeners) {
        listener();
    }
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function getSnapshot(): SavedConnection[] {
    return currentConnections;
}

function connectionsWithout(connections: SavedConnection[], normalizedURL: string): SavedConnection[] {
    return connections.filter((connection) => normalizeBaseUrl(connection.baseUrl) !== normalizedURL);
}

function saveConnection(baseUrl: string, apiKey: string): void {
    const normalizedURL = normalizeBaseUrl(baseUrl);
    if (normalizedURL === "") {
        return;
    }
    const others = connectionsWithout(currentConnections, normalizedURL);
    const saved: SavedConnection = { baseUrl: normalizedURL, apiKey: apiKey.trim(), savedAt: Date.now() };
    publishConnections([saved, ...others]);
}

function removeConnection(baseUrl: string): void {
    const normalizedURL = normalizeBaseUrl(baseUrl);
    publishConnections(connectionsWithout(currentConnections, normalizedURL));
}

function clearConnections(): void {
    publishConnections([]);
}

export function useSavedConnections(): {
    connections: SavedConnection[];
    saveConnection: (baseUrl: string, apiKey: string) => void;
    removeConnection: (baseUrl: string) => void;
    clearConnections: () => void;
} {
    const connections = useSyncExternalStore(subscribe, getSnapshot);
    return { connections, saveConnection, removeConnection, clearConnections };
}
