import { useCallback, useEffect, useState } from "react";
import { fetchModels, normalizeBaseUrl, type ModelRequestSettings } from "./api";
import { loadSelectedModel, resolveModel, saveSelectedModel } from "./modelSelection";

// Typing in the connection dialog changes these settings on every keystroke; wait until it settles.
const FETCH_DEBOUNCE_MILLISECONDS = 400;

const EMPTY_LIST_MESSAGE = "Endpoint reachable but returned no model list.";

interface CatalogResult {
    requestKey: string;
    models: string[];
    errorMessage: string | null;
}

export interface ModelCatalog {
    models: string[];
    isLoading: boolean;
    errorMessage: string | null;
    reload: () => void;
    selectModel: (model: string) => void;
}

function describeError(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

function resultForRequest(result: CatalogResult | null, requestKey: string): CatalogResult | null {
    if (result !== null && result.requestKey === requestKey) {
        return result;
    }
    return null;
}

/**
 * Loads the models the endpoint offers for the current mode and keeps `onModelChange` pointed at a valid one:
 * the model picked earlier in this session for the mode, or else the first model of the list.
 */
export function useModelCatalog(
    settings: ModelRequestSettings,
    onModelChange: (model: string) => void,
): ModelCatalog {
    const { baseUrl, apiKey, dialect, extraHeaders } = settings;
    const [reloadCount, setReloadCount] = useState(0);
    const [result, setResult] = useState<CatalogResult | null>(null);

    const hasEndpoint = normalizeBaseUrl(baseUrl) !== "";
    const requestKey = [baseUrl, apiKey, dialect, extraHeaders, reloadCount].join("\n");

    useEffect(() => {
        if (!hasEndpoint) {
            return;
        }
        let isStale = false;

        async function loadCatalog(): Promise<void> {
            const rememberedModel = loadSelectedModel(dialect);
            try {
                const discovered = await fetchModels({ baseUrl, apiKey, dialect, extraHeaders });
                if (isStale) {
                    return;
                }
                const errorMessage = discovered.length === 0 ? EMPTY_LIST_MESSAGE : null;
                setResult({ requestKey, models: discovered, errorMessage });
                onModelChange(resolveModel(discovered, rememberedModel));
            } catch (error) {
                if (isStale) {
                    return;
                }
                setResult({ requestKey, models: [], errorMessage: describeError(error) });
                onModelChange(resolveModel([], rememberedModel));
            }
        }

        const timer = setTimeout(() => {
            void loadCatalog();
        }, FETCH_DEBOUNCE_MILLISECONDS);
        return () => {
            isStale = true;
            clearTimeout(timer);
        };
    }, [hasEndpoint, requestKey, baseUrl, apiKey, dialect, extraHeaders, onModelChange]);

    const reload = useCallback(() => {
        setReloadCount((count) => count + 1);
    }, []);

    const selectModel = useCallback(
        (model: string) => {
            saveSelectedModel(dialect, model);
            onModelChange(model);
        },
        [dialect, onModelChange],
    );

    // A result only counts for the request that produced it, so a stale list never shows under a new mode or key.
    const current = resultForRequest(result, requestKey);
    return {
        models: current?.models ?? [],
        isLoading: hasEndpoint && current === null,
        errorMessage: current?.errorMessage ?? null,
        reload,
        selectModel,
    };
}
