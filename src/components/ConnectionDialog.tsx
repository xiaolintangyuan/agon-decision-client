import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Eye, EyeOff, PlugZap, Save, X } from "lucide-react";
import type { ConnectionSettings, ConnState } from "../lib/types";
import { normalizeBaseUrl, prettyEndpoint } from "../lib/api";
import { connectionLabel, findConnectionById, presetForURL, useSavedConnections } from "../lib/connections";
import { Label } from "./Primitives";
import EndpointCombobox from "./EndpointCombobox";

export interface ConnectionDialogProps {
    open: boolean;
    onClose: () => void;
    settings: ConnectionSettings;
    onChange: (patch: Partial<ConnectionSettings>) => void;
    conn: ConnState;
    connNote: string;
    onTest: () => void;
}

type DialogViewProps = Omit<ConnectionDialogProps, "open">;

type SectionProps = Pick<ConnectionDialogProps, "settings" | "onChange">;

const inputClassName =
    "w-full rounded-lg border border-ink-700 bg-ink-950/70 px-3 py-2.5 font-mono text-[12px] text-mute-100 outline-none transition placeholder:text-mute-500 focus:border-brass-600 focus:ring-1 focus:ring-brass-600/30";

const secondaryButtonClassName =
    "inline-flex items-center justify-center gap-2 rounded-lg border border-ink-700 bg-ink-800 px-3.5 py-2 text-[12px] font-medium text-mute-100 transition hover:border-brass-700 hover:text-brass-400 disabled:cursor-not-allowed disabled:opacity-50";

const STATUS_DOT_CLASS_NAMES: Record<ConnState, string> = {
    unknown: "bg-mute-500",
    testing: "animate-pulse bg-brass-500",
    ok: "bg-jade-500",
    error: "bg-coral-500",
};

const SAVED_FEEDBACK_MILLISECONDS = 1600;

function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
    return (
        <section className="space-y-3 border-b border-ink-750 py-5 last:border-b-0">
            <Label right={hint}>{title}</Label>
            {children}
        </section>
    );
}

function NormalizedURLHint({ baseUrl }: { baseUrl: string }) {
    const normalizedURL = normalizeBaseUrl(baseUrl);
    if (normalizedURL === "" || normalizedURL === baseUrl.trim()) {
        return null;
    }
    return <span className="min-w-0 truncate font-mono text-[10px] text-mute-500">→ {normalizedURL}</span>;
}

function NameSection({ settings, onChange }: SectionProps) {
    const defaultName = connectionLabel(settings.baseUrl);
    return (
        <Section title="Name">
            <input
                className={inputClassName}
                aria-label="Connection name"
                placeholder={defaultName === "" ? "My connection" : defaultName}
                value={settings.name}
                onChange={(event) => onChange({ name: event.target.value })}
                spellCheck={false}
                autoComplete="off"
            />
        </Section>
    );
}

function EndpointSection({ settings, onChange }: SectionProps) {
    const hasEndpoint = normalizeBaseUrl(settings.baseUrl) !== "";
    return (
        <Section title="Endpoint" hint={<NormalizedURLHint baseUrl={settings.baseUrl} />}>
            <EndpointCombobox
                value={settings.baseUrl}
                onChange={onChange}
                inputClassName={inputClassName}
            />
            {hasEndpoint && (
                <p className="break-all font-mono text-[10px] leading-relaxed text-mute-500">
                    POST {prettyEndpoint(settings.baseUrl, settings.dialect)}
                </p>
            )}
            <p className="text-[11px] leading-snug text-mute-500">
                Base URL of any OpenAI-compatible or SystemOne gateway. Paths are appended automatically (
                <span className="font-mono text-mute-400">/v1/…</span>), so pasting the full endpoint also works.
            </p>
        </Section>
    );
}

function ApiKeySection({ settings, onChange }: SectionProps) {
    const [isKeyVisible, setIsKeyVisible] = useState(false);
    const keyPlaceholder = presetForURL(settings.baseUrl)?.keyPlaceholder ?? "sk-…";
    return (
        <Section title="API key">
            <div className="relative">
                <input
                    className={`${inputClassName} pr-10`}
                    type={isKeyVisible ? "text" : "password"}
                    aria-label="API key"
                    placeholder={keyPlaceholder}
                    value={settings.apiKey}
                    onChange={(event) => onChange({ apiKey: event.target.value })}
                    spellCheck={false}
                    autoComplete="off"
                />
                <button
                    type="button"
                    onClick={() => setIsKeyVisible((visible) => !visible)}
                    aria-label={isKeyVisible ? "Hide key" : "Show key"}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-mute-500 transition hover:bg-ink-700 hover:text-mute-100"
                >
                    {isKeyVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
            </div>
        </Section>
    );
}

interface NumberFieldProps {
    label: string;
    value: number;
    step: number;
    onValueChange: (value: number) => void;
}

function NumberField({ label, value, step, onValueChange }: NumberFieldProps) {
    return (
        <div>
            <Label>{label}</Label>
            <input
                className={inputClassName}
                type="number"
                step={step}
                min={0}
                value={value}
                onChange={(event) => onValueChange(Number(event.target.value))}
            />
        </div>
    );
}

function GenerationSection({ settings, onChange }: SectionProps) {
    return (
        <Section title="Generation">
            <div className="grid grid-cols-3 gap-3">
                <NumberField
                    label="Temp"
                    value={settings.temperature}
                    step={0.05}
                    onValueChange={(temperature) => onChange({ temperature })}
                />
                <NumberField
                    label="Top-p"
                    value={settings.topP}
                    step={0.05}
                    onValueChange={(topP) => onChange({ topP })}
                />
                <NumberField
                    label="Max tok"
                    value={settings.maxTokens}
                    step={64}
                    onValueChange={(maxTokens) => onChange({ maxTokens })}
                />
            </div>
            <label className="flex cursor-pointer items-start gap-2.5 pt-1 text-[12px] leading-snug text-mute-400">
                <input
                    type="checkbox"
                    checked={settings.includeHistory}
                    onChange={(event) => onChange({ includeHistory: event.target.checked })}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#e0a63c]"
                />
                <span>
                    Fold prior turns into the <span className="font-mono text-mute-300">state</span> so follow-ups
                    keep context
                </span>
            </label>
        </Section>
    );
}

function HeadersSection({ settings, onChange }: SectionProps) {
    return (
        <Section title="Extra headers (JSON)">
            <textarea
                className={`${inputClassName} h-20 resize-none`}
                aria-label="Extra headers (JSON)"
                placeholder='{"x-team":"risk"}'
                value={settings.extraHeaders}
                onChange={(event) => onChange({ extraHeaders: event.target.value })}
                spellCheck={false}
            />
        </Section>
    );
}

function saveButtonLabel(justSaved: boolean, hasSavedEntry: boolean): string {
    if (justSaved) {
        return "Saved";
    }
    if (hasSavedEntry) {
        return "Update saved";
    }
    return "Save connection";
}

function SaveConnectionButton({ settings, onChange }: SectionProps) {
    const { connections, saveConnection } = useSavedConnections();
    const [justSaved, setJustSaved] = useState(false);
    const hasEndpoint = normalizeBaseUrl(settings.baseUrl) !== "";
    const hasSavedEntry = findConnectionById(connections, settings.connectionId) !== undefined;

    useEffect(() => {
        if (!justSaved) {
            return;
        }
        const timer = setTimeout(() => setJustSaved(false), SAVED_FEEDBACK_MILLISECONDS);
        return () => clearTimeout(timer);
    }, [justSaved]);

    function handleSave(): void {
        const saved = saveConnection({
            uuid: settings.connectionId,
            name: settings.name,
            baseUrl: settings.baseUrl,
            apiKey: settings.apiKey,
        });
        if (saved === undefined) {
            return;
        }
        // Shows the stored values, so a blank name now reads as the default it was saved under.
        onChange({ connectionId: saved.uuid, name: saved.name });
        setJustSaved(true);
    }

    return (
        <button type="button" onClick={handleSave} disabled={!hasEndpoint} className={secondaryButtonClassName}>
            {justSaved ? <Check size={13} className="text-jade-500" /> : <Save size={13} />}
            {saveButtonLabel(justSaved, hasSavedEntry)}
        </button>
    );
}

function ConnectionStatus({ conn, connNote }: { conn: ConnState; connNote: string }) {
    return (
        <p className="flex items-center gap-2 text-[11px] text-mute-400" role="status">
            <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_CLASS_NAMES[conn]}`} />
            <span className="min-w-0 break-words">{connNote}</span>
        </p>
    );
}

function DialogFooter({ settings, onChange, conn, connNote, onTest, onClose }: DialogViewProps) {
    return (
        <footer className="space-y-3 border-t border-ink-700 px-5 py-4 sm:px-6">
            <ConnectionStatus conn={conn} connNote={connNote} />
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={onTest}
                    disabled={conn === "testing"}
                    className={secondaryButtonClassName}
                >
                    <PlugZap size={13} />
                    {conn === "testing" ? "Testing…" : "Test connection"}
                </button>
                <SaveConnectionButton settings={settings} onChange={onChange} />
                <button
                    type="button"
                    onClick={onClose}
                    className="ml-auto rounded-lg bg-brass-600 px-4 py-2 text-[12px] font-semibold text-ink-950 transition hover:bg-brass-500"
                >
                    Done
                </button>
            </div>
            <p className="text-[10px] leading-relaxed text-mute-600">
                Saved keys are stored only in this browser's localStorage. Requests go straight from this page to
                the endpoint.
            </p>
        </footer>
    );
}

function DialogHeader({ titleId, onClose }: { titleId: string; onClose: () => void }) {
    return (
        <header className="flex items-center justify-between border-b border-ink-700 px-5 py-4 sm:px-6">
            <h2 id={titleId} className="text-[15px] font-semibold text-mute-100">
                Connection settings
            </h2>
            <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-md p-1.5 text-mute-400 transition hover:bg-ink-700 hover:text-mute-100"
            >
                <X size={16} />
            </button>
        </header>
    );
}

function useDialogBehavior(panelRef: RefObject<HTMLDivElement | null>, onClose: () => void): void {
    useEffect(() => {
        const previouslyFocused = document.activeElement;
        const panel = panelRef.current;
        if (panel !== null) {
            panel.focus();
        }
        return () => {
            if (previouslyFocused instanceof HTMLElement) {
                previouslyFocused.focus();
            }
        };
    }, [panelRef]);

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent): void {
            if (event.key === "Escape") {
                onClose();
            }
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose]);
}

function DialogView({ onClose, settings, onChange, conn, connNote, onTest }: DialogViewProps) {
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    useDialogBehavior(panelRef, onClose);

    return (
        <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <motion.div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                initial={{ opacity: 0, scale: 0.97, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="flex max-h-[90vh] w-full max-w-[560px] flex-col rounded-xl border border-ink-700 bg-ink-850 shadow-2xl shadow-black/60 outline-none"
            >
                <DialogHeader titleId={titleId} onClose={onClose} />
                <div className="min-h-0 flex-1 overflow-y-auto px-5 sm:px-6">
                    <NameSection settings={settings} onChange={onChange} />
                    <EndpointSection settings={settings} onChange={onChange} />
                    <ApiKeySection settings={settings} onChange={onChange} />
                    <GenerationSection settings={settings} onChange={onChange} />
                    <HeadersSection settings={settings} onChange={onChange} />
                </div>
                <DialogFooter
                    settings={settings}
                    onChange={onChange}
                    conn={conn}
                    connNote={connNote}
                    onTest={onTest}
                    onClose={onClose}
                />
            </motion.div>
        </motion.div>
    );
}

export default function ConnectionDialog({ open, ...viewProps }: ConnectionDialogProps) {
    return <AnimatePresence>{open && <DialogView key="connection-dialog" {...viewProps} />}</AnimatePresence>;
}
