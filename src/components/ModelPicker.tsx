import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Cpu, RefreshCw, Search, TriangleAlert } from "lucide-react";
import { filterModels } from "../lib/modelSelection";
import { useDismissOnOutsideClick } from "../lib/useDismissOnOutsideClick";

export interface ModelPickerProps {
    model: string;
    models: string[];
    isLoading: boolean;
    errorMessage: string | null;
    hasEndpoint: boolean;
    onSelect: (model: string) => void;
    onReload: () => void;
}

interface ModelRowData {
    value: string;
    isCustom: boolean;
}

function buildRows(models: string[], query: string): ModelRowData[] {
    const matches = filterModels(models, query);
    if (matches.length > 0) {
        return matches.map((value) => ({ value, isCustom: false }));
    }
    // Nothing matches (or the endpoint lists nothing), so the typed text can be used as a model id as it is.
    const customValue = query.trim();
    if (customValue === "") {
        return [];
    }
    return [{ value: customValue, isCustom: true }];
}

function triggerLabel(model: string, hasEndpoint: boolean): string {
    if (!hasEndpoint) {
        return "No endpoint";
    }
    if (model === "") {
        return "Select model";
    }
    return model;
}

interface PickerStatusProps {
    isLoading: boolean;
    errorMessage: string | null;
    matchCount: number;
    totalCount: number;
}

function PickerStatus({ isLoading, errorMessage, matchCount, totalCount }: PickerStatusProps) {
    if (isLoading) {
        return <p className="px-1 font-mono text-[10px] text-mute-500">Loading models…</p>;
    }
    if (errorMessage !== null) {
        return (
            <p className="flex max-h-20 gap-1.5 overflow-y-auto px-1 text-[11px] leading-snug text-coral-400">
                <TriangleAlert size={12} className="mt-0.5 shrink-0" />
                {errorMessage}
            </p>
        );
    }
    return (
        <p className="px-1 font-mono text-[10px] text-mute-500">
            {matchCount} of {totalCount} models
        </p>
    );
}

interface ModelRowProps {
    row: ModelRowData;
    id: string;
    isActive: boolean;
    isCurrent: boolean;
    onHover: () => void;
    onSelect: () => void;
}

function ModelRow({ row, id, isActive, isCurrent, onHover, onSelect }: ModelRowProps) {
    const rowTone = isActive ? "bg-ink-700/70" : "";
    const textTone = isCurrent ? "text-brass-400" : "text-mute-300";
    return (
        <li
            id={id}
            role="option"
            aria-selected={isActive}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={onHover}
            onClick={onSelect}
            className={`flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 font-mono text-[11px] ${rowTone} ${textTone}`}
        >
            <span className="min-w-0 flex-1 truncate" title={row.value}>
                {row.isCustom ? `Use “${row.value}”` : row.value}
            </span>
            {isCurrent && <Check size={12} className="shrink-0 text-brass-500" />}
        </li>
    );
}

export default function ModelPicker({
    model,
    models,
    isLoading,
    errorMessage,
    hasEndpoint,
    onSelect,
    onReload,
}: ModelPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const listId = useId();

    const rows = buildRows(models, query);
    const activeRow = rows[activeIndex];
    const activeDescendant = activeRow !== undefined ? `${listId}-${activeIndex}` : undefined;
    const matchCount = rows.filter((row) => !row.isCustom).length;

    // Stable identity so the document-level outside-click listener is attached once, not on every render.
    const closeList = useCallback(() => {
        setIsOpen(false);
    }, []);

    useDismissOnOutsideClick(containerRef, closeList);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        const activeElement = listRef.current?.querySelector('[aria-selected="true"]');
        if (activeElement !== null && activeElement !== undefined) {
            activeElement.scrollIntoView({ block: "nearest" });
        }
    }, [isOpen, activeIndex]);

    function openList(): void {
        setQuery("");
        setActiveIndex(Math.max(0, models.indexOf(model)));
        setIsOpen(true);
    }

    function toggleList(): void {
        if (isOpen) {
            closeList();
            return;
        }
        openList();
    }

    function handleQueryChange(nextQuery: string): void {
        setQuery(nextQuery);
        setActiveIndex(0);
    }

    function selectRow(row: ModelRowData): void {
        onSelect(row.value);
        closeList();
        triggerRef.current?.focus();
    }

    function moveActive(step: number): void {
        if (rows.length === 0) {
            return;
        }
        setActiveIndex((index) => (index + step + rows.length) % rows.length);
    }

    function handleEnter(event: KeyboardEvent<HTMLInputElement>): void {
        event.preventDefault();
        if (activeRow !== undefined) {
            selectRow(activeRow);
        }
    }

    function handleEscape(event: KeyboardEvent<HTMLInputElement>): void {
        event.preventDefault();
        closeList();
        triggerRef.current?.focus();
    }

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            moveActive(event.key === "ArrowDown" ? 1 : -1);
            return;
        }
        if (event.key === "Enter") {
            handleEnter(event);
            return;
        }
        if (event.key === "Escape") {
            handleEscape(event);
            return;
        }
        if (event.key === "Tab") {
            closeList();
        }
    }

    return (
        <div ref={containerRef} className="relative min-w-0">
            <button
                ref={triggerRef}
                type="button"
                onClick={toggleList}
                disabled={!hasEndpoint}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label="Model"
                title={model === "" ? "Select a model" : model}
                className="flex w-full min-w-0 items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-850 px-2 py-1.5 font-mono text-[11px] text-mute-300 transition hover:border-ink-600 hover:text-mute-100 disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-[16rem]"
            >
                <Cpu size={13} className="shrink-0 text-brass-500" />
                <span className="min-w-0 flex-1 truncate text-left">{triggerLabel(model, hasEndpoint)}</span>
                <ChevronDown size={13} className={`shrink-0 transition ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
                <div className="fixed inset-x-4 top-14 z-30 space-y-2 rounded-xl border border-ink-700 bg-ink-850 p-2 shadow-2xl shadow-black/60 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1.5 sm:w-96">
                    <div className="flex items-center gap-1.5">
                        <div className="relative min-w-0 flex-1">
                            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-mute-500" />
                            <input
                                autoFocus
                                role="combobox"
                                aria-label="Search models"
                                aria-expanded
                                aria-controls={listId}
                                aria-autocomplete="list"
                                aria-activedescendant={activeDescendant}
                                value={query}
                                onChange={(event) => handleQueryChange(event.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Search models, e.g. free"
                                spellCheck={false}
                                autoComplete="off"
                                className="w-full rounded-lg border border-ink-700 bg-ink-950/70 py-2 pl-8 pr-3 font-mono text-[11px] text-mute-100 outline-none transition placeholder:text-mute-500 focus:border-brass-600 focus:ring-1 focus:ring-brass-600/30"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={onReload}
                            disabled={isLoading}
                            aria-label="Reload models"
                            title="Reload models"
                            className="shrink-0 rounded-md border border-ink-700 bg-ink-800 p-2 text-mute-300 transition hover:border-brass-700 hover:text-brass-400 disabled:opacity-50"
                        >
                            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
                        </button>
                    </div>
                    <PickerStatus
                        isLoading={isLoading}
                        errorMessage={errorMessage}
                        matchCount={matchCount}
                        totalCount={models.length}
                    />
                    <ul
                        ref={listRef}
                        id={listId}
                        role="listbox"
                        aria-label="Models"
                        className="max-h-72 overflow-y-auto rounded-lg border border-ink-750 bg-ink-950/50 p-1"
                    >
                        {rows.length === 0 && (
                            <li role="presentation" className="px-2.5 py-3 text-[11px] text-mute-500">
                                {isLoading ? "Loading…" : "No models to show. Type a model id to use it."}
                            </li>
                        )}
                        {rows.map((row, index) => (
                            <ModelRow
                                key={row.value}
                                row={row}
                                id={`${listId}-${index}`}
                                isActive={index === activeIndex}
                                isCurrent={row.value === model}
                                onHover={() => setActiveIndex(index)}
                                onSelect={() => selectRow(row)}
                            />
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
