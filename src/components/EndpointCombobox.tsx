import { Fragment, useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import type { ConnectionSettings, SavedConnection } from "../lib/types";
import { ENDPOINT_PRESETS, maskKey, useSavedConnections } from "../lib/connections";
import { useDismissOnOutsideClick } from "../lib/useDismissOnOutsideClick";

interface Props {
    value: string;
    onChange: (patch: Partial<ConnectionSettings>) => void;
    inputClassName: string;
}

type OptionGroup = "saved" | "preset";

interface EndpointOption {
    id: string;
    group: OptionGroup;
    label: string;
    baseUrl: string;
    detail: string;
    /** The settings applied when the option is chosen. */
    selection: Partial<ConnectionSettings>;
}

const GROUP_TITLES: Record<OptionGroup, string> = {
    saved: "Saved",
    preset: "Presets",
};

function savedOptions(connections: SavedConnection[]): EndpointOption[] {
    return connections.map((connection) => ({
        id: `saved:${connection.uuid}`,
        group: "saved",
        label: connection.name,
        baseUrl: connection.baseUrl,
        detail: maskKey(connection.apiKey),
        selection: {
            connectionId: connection.uuid,
            name: connection.name,
            baseUrl: connection.baseUrl,
            apiKey: connection.apiKey,
        },
    }));
}

// A preset starts a new connection with no key: several keys can exist for one URL, and a key must never
// travel to a different provider.
function presetOptions(): EndpointOption[] {
    return ENDPOINT_PRESETS.map((preset) => ({
        id: `preset:${preset.id}`,
        group: "preset",
        label: preset.label,
        baseUrl: preset.baseUrl,
        detail: preset.description,
        selection: { connectionId: "", name: preset.label, baseUrl: preset.baseUrl, apiKey: "" },
    }));
}

function filterOptions(options: EndpointOption[], query: string): EndpointOption[] {
    const needle = query.trim().toLowerCase();
    if (needle === "") {
        return options;
    }
    return options.filter((option) => `${option.label} ${option.baseUrl}`.toLowerCase().includes(needle));
}

function GroupHeading({ group }: { group: OptionGroup }) {
    return (
        <li role="presentation" className="label-xs px-2.5 pb-1 pt-2 text-mute-500">
            {GROUP_TITLES[group]}
        </li>
    );
}

interface OptionRowProps {
    option: EndpointOption;
    id: string;
    isActive: boolean;
    onHover: () => void;
    onSelect: () => void;
}

function OptionRow({ option, id, isActive, onHover, onSelect }: OptionRowProps) {
    const detailClassName = option.group === "saved" ? "font-mono text-[11px]" : "text-[11px]";
    const rowTone = isActive ? "bg-ink-700/70" : "";
    return (
        <li
            id={id}
            role="option"
            aria-selected={isActive}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={onHover}
            onClick={onSelect}
            className={`cursor-pointer rounded-lg px-2.5 py-2 ${rowTone}`}
        >
            <div className="flex items-baseline justify-between gap-3">
                <span className="shrink-0 text-[12px] font-medium text-mute-100">{option.label}</span>
                <span className="truncate font-mono text-[10px] text-mute-400">{option.baseUrl}</span>
            </div>
            <p className={`mt-0.5 truncate text-mute-500 ${detailClassName}`}>{option.detail}</p>
        </li>
    );
}

export default function EndpointCombobox({ value, onChange, inputClassName }: Props) {
    const { connections } = useSavedConnections();
    const [isOpen, setIsOpen] = useState(false);
    const [isFiltering, setIsFiltering] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listId = useId();

    const allOptions = [...savedOptions(connections), ...presetOptions()];
    const visibleOptions = isFiltering ? filterOptions(allOptions, value) : allOptions;
    const activeOption = visibleOptions[activeIndex];
    const activeDescendant = isOpen && activeOption !== undefined ? `${listId}-${activeIndex}` : undefined;

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

    function openFullList(): void {
        setIsFiltering(false);
        setActiveIndex(0);
        setIsOpen(true);
    }

    function toggleList(): void {
        const input = inputRef.current;
        if (input !== null) {
            input.focus();
        }
        if (isOpen) {
            closeList();
            return;
        }
        openFullList();
    }

    function handleInputChange(nextValue: string): void {
        onChange({ baseUrl: nextValue });
        setIsFiltering(true);
        setActiveIndex(0);
        setIsOpen(true);
    }

    function selectOption(option: EndpointOption): void {
        onChange(option.selection);
        setIsFiltering(false);
        closeList();
    }

    function moveActive(step: number): void {
        if (!isOpen) {
            openFullList();
            return;
        }
        if (visibleOptions.length === 0) {
            return;
        }
        setActiveIndex((index) => (index + step + visibleOptions.length) % visibleOptions.length);
    }

    function handleEnter(event: KeyboardEvent<HTMLInputElement>): void {
        if (!isOpen || activeOption === undefined) {
            return;
        }
        event.preventDefault();
        selectOption(activeOption);
    }

    // Stopping propagation keeps the surrounding dialog from also closing on the same Escape press.
    function handleEscape(event: KeyboardEvent<HTMLInputElement>): void {
        if (!isOpen) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        closeList();
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
        <div ref={containerRef} className="relative">
            <input
                ref={inputRef}
                role="combobox"
                aria-label="Endpoint"
                aria-expanded={isOpen}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={activeDescendant}
                className={`${inputClassName} pr-10`}
                placeholder="https://openrouter.ai/api"
                value={value}
                onChange={(event) => handleInputChange(event.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                autoComplete="off"
            />
            <button
                type="button"
                onClick={toggleList}
                aria-label="Show endpoint list"
                aria-expanded={isOpen}
                aria-controls={listId}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-mute-500 transition hover:bg-ink-700 hover:text-mute-100"
            >
                <ChevronDown size={14} className={`transition ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
                <ul
                    ref={listRef}
                    id={listId}
                    role="listbox"
                    aria-label="Endpoints"
                    className="absolute left-0 right-0 z-20 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-ink-700 bg-ink-850 p-1.5 shadow-2xl shadow-black/60"
                >
                    {visibleOptions.length === 0 && (
                        <li role="presentation" className="px-2.5 py-3 text-[11px] text-mute-500">
                            No match. Keep typing to use a custom URL.
                        </li>
                    )}
                    {visibleOptions.map((option, index) => (
                        <Fragment key={option.id}>
                            {(index === 0 || visibleOptions[index - 1].group !== option.group) && (
                                <GroupHeading group={option.group} />
                            )}
                            <OptionRow
                                option={option}
                                id={`${listId}-${index}`}
                                isActive={index === activeIndex}
                                onHover={() => setActiveIndex(index)}
                                onSelect={() => selectOption(option)}
                            />
                        </Fragment>
                    ))}
                </ul>
            )}
        </div>
    );
}
