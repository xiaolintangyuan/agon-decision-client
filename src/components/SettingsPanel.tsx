import { useState, type ReactNode } from "react";
import { Activity, Bookmark, Check, KeyRound, PlugZap, Plus, Settings, Trash2 } from "lucide-react";
import type { ConnectionSettings, ConnState, LogEntry, SavedConnection } from "../lib/types";
import { normalizeBaseUrl } from "../lib/api";
import { connectionLabel, maskKey, useSavedConnections } from "../lib/connections";

interface Props {
    settings: ConnectionSettings;
    onChange: (patch: Partial<ConnectionSettings>) => void;
    conn: ConnState;
    onTest: () => void;
    onOpenSettings: () => void;
    onNewConnection: () => void;
    logs: LogEntry[];
    onClearLogs: () => void;
}

const VISIBLE_LOG_ENTRIES = 40;

/** An unsaved draft may have no name yet, so the preset or host stands in for it. */
function displayName(name: string, baseUrl: string): string {
    if (name !== "") {
        return name;
    }
    return connectionLabel(baseUrl);
}

function SectionTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
    return (
        <div className="flex items-center gap-2">
            {icon}
            <h2 className="label-xs text-mute-400">{children}</h2>
        </div>
    );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="grid grid-cols-[3.5rem_1fr] items-baseline gap-2">
            <dt className="label-xs text-mute-500">{label}</dt>
            <dd className="min-w-0 truncate font-mono text-[11px] text-mute-300">{children}</dd>
        </div>
    );
}

interface ActiveConnectionCardProps {
    settings: ConnectionSettings;
    conn: ConnState;
    onTest: () => void;
    onOpenSettings: () => void;
}

function ActiveConnectionCard({ settings, conn, onTest, onOpenSettings }: ActiveConnectionCardProps) {
    const normalizedURL = normalizeBaseUrl(settings.baseUrl);
    const hasEndpoint = normalizedURL !== "";
    const model = settings.model.trim();
    const name = settings.name.trim();
    return (
        <section className="space-y-4 rounded-xl border border-ink-700 bg-ink-850/70 p-4">
            <div className="flex items-center justify-between gap-2">
                <h2 className="label-xs text-mute-400">Active connection</h2>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={onTest}
                        disabled={conn === "testing"}
                        className="inline-flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-[11px] font-medium text-mute-100 transition hover:border-brass-700 hover:text-brass-400 disabled:opacity-60"
                    >
                        <PlugZap size={12} />
                        {conn === "testing" ? "Testing…" : "Test"}
                    </button>
                    <button
                        type="button"
                        onClick={onOpenSettings}
                        aria-label="Connection settings"
                        title="Connection settings"
                        className="rounded-md border border-ink-700 bg-ink-800 p-1.5 text-mute-300 transition hover:border-brass-700 hover:text-brass-400"
                    >
                        <Settings size={13} />
                    </button>
                </div>
            </div>

            <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-mute-100">
                    {hasEndpoint ? displayName(name, settings.baseUrl) : "No endpoint set"}
                </p>
                <p className="mt-0.5 truncate font-mono text-[10px] text-mute-500" title={normalizedURL}>
                    {hasEndpoint ? normalizedURL : "Open settings to choose one"}
                </p>
            </div>

            <dl className="space-y-2 border-t border-ink-750 pt-3">
                <DetailRow label="Key">
                    <span className="inline-flex items-center gap-1.5">
                        <KeyRound size={11} className="text-mute-500" />
                        {maskKey(settings.apiKey)}
                    </span>
                </DetailRow>
                <DetailRow label="Model">{model === "" ? "not set" : model}</DetailRow>
            </dl>
        </section>
    );
}

function ClearAllControl({ onConfirm }: { onConfirm: () => void }) {
    const [isConfirming, setIsConfirming] = useState(false);

    if (!isConfirming) {
        return (
            <button
                type="button"
                onClick={() => setIsConfirming(true)}
                className="text-[11px] text-mute-500 transition hover:text-coral-400"
            >
                Clear all
            </button>
        );
    }
    return (
        <span className="flex items-center gap-2 text-[11px]">
            <button type="button" onClick={onConfirm} className="font-medium text-coral-400 hover:text-coral-500">
                Delete all
            </button>
            <button
                type="button"
                onClick={() => setIsConfirming(false)}
                className="text-mute-400 transition hover:text-mute-100"
            >
                Cancel
            </button>
        </span>
    );
}

interface SavedConnectionRowProps {
    connection: SavedConnection;
    isActive: boolean;
    onSelect: () => void;
    onRemove: () => void;
}

function SavedConnectionRow({ connection, isActive, onSelect, onRemove }: SavedConnectionRowProps) {
    const label = connection.name;
    const rowTone = isActive
        ? "border-brass-600/60 bg-brass-700/10"
        : "border-ink-750 bg-ink-900/60 hover:border-ink-600";
    return (
        <li className="relative">
            <button
                type="button"
                onClick={onSelect}
                aria-current={isActive}
                className={`block w-full min-w-0 rounded-lg border py-2.5 pl-3 pr-10 text-left transition ${rowTone}`}
            >
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-mute-100">
                    <span className="truncate">{label}</span>
                    {isActive && <Check size={12} className="shrink-0 text-brass-500" />}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[10px] text-mute-400" title={connection.baseUrl}>
                    {connection.baseUrl}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[10px] text-mute-500">
                    {maskKey(connection.apiKey)}
                </span>
            </button>
            <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove saved connection ${label}`}
                title="Remove"
                className="absolute right-2 top-2 rounded-md p-1.5 text-mute-500 transition hover:bg-ink-700 hover:text-coral-400"
            >
                <Trash2 size={13} />
            </button>
        </li>
    );
}

function SavedConnectionsSection({
    settings,
    onChange,
    onNewConnection,
}: Pick<Props, "settings" | "onChange" | "onNewConnection">) {
    const { connections, removeConnection, clearConnections } = useSavedConnections();

    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <SectionTitle icon={<Bookmark size={13} className="text-brass-500" />}>
                    Saved connections ({connections.length})
                </SectionTitle>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onNewConnection}
                        title="Add a connection, e.g. the same endpoint with another API key"
                        className="inline-flex items-center gap-1 text-[11px] text-mute-400 transition hover:text-brass-400"
                    >
                        <Plus size={12} />
                        New
                    </button>
                    {connections.length > 0 && <ClearAllControl onConfirm={clearConnections} />}
                </div>
            </div>
            {connections.length === 0 && (
                <p className="rounded-lg border border-dashed border-ink-700 px-3 py-4 text-[11px] leading-relaxed text-mute-500">
                    <span className="block text-mute-400">No saved connections yet</span>
                    Open settings with the gear icon above and save one to see it here.
                </p>
            )}
            <ul className="space-y-2">
                {connections.map((connection) => (
                    <SavedConnectionRow
                        key={connection.uuid}
                        connection={connection}
                        isActive={connection.uuid === settings.connectionId}
                        onSelect={() =>
                            onChange({
                                connectionId: connection.uuid,
                                name: connection.name,
                                baseUrl: connection.baseUrl,
                                apiKey: connection.apiKey,
                            })
                        }
                        onRemove={() => removeConnection(connection.uuid)}
                    />
                ))}
            </ul>
        </section>
    );
}

function LogRow({ entry }: { entry: LogEntry }) {
    return (
        <li className="flex items-center gap-2 rounded-md border border-ink-750 bg-ink-900/60 px-2 py-1.5 font-mono text-[10px]">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${entry.ok ? "bg-jade-500" : "bg-coral-500"}`} />
            <span className="w-9 shrink-0 text-mute-400">{entry.method}</span>
            <span className="shrink-0 text-mute-300">{entry.status}</span>
            <span className="truncate text-mute-500">{entry.ms}ms</span>
            <span className="ml-auto shrink-0 text-mute-600">{new Date(entry.at).toLocaleTimeString()}</span>
        </li>
    );
}

function RequestLog({ logs, onClearLogs }: Pick<Props, "logs" | "onClearLogs">) {
    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between">
                <SectionTitle icon={<Activity size={13} className="text-mute-500" />}>Request log</SectionTitle>
                {logs.length > 0 && (
                    <button
                        type="button"
                        onClick={onClearLogs}
                        className="text-mute-500 transition hover:text-coral-400"
                        title="Clear log"
                        aria-label="Clear log"
                    >
                        <Trash2 size={13} />
                    </button>
                )}
            </div>
            {logs.length === 0 && (
                <p className="text-[11px] text-mute-500">No requests yet. Logs are stored locally only.</p>
            )}
            <ul className="space-y-1">
                {logs.slice(0, VISIBLE_LOG_ENTRIES).map((entry) => (
                    <LogRow key={entry.id} entry={entry} />
                ))}
            </ul>
        </section>
    );
}

export default function SettingsPanel({
    settings,
    onChange,
    conn,
    onTest,
    onOpenSettings,
    onNewConnection,
    logs,
    onClearLogs,
}: Props) {
    return (
        <div className="flex h-full flex-col gap-6 overflow-y-auto px-4 py-5">
            <ActiveConnectionCard settings={settings} conn={conn} onTest={onTest} onOpenSettings={onOpenSettings} />
            <SavedConnectionsSection settings={settings} onChange={onChange} onNewConnection={onNewConnection} />
            <RequestLog logs={logs} onClearLogs={onClearLogs} />
            <p className="pb-4 text-[10px] leading-relaxed text-mute-600">
                Everything runs in your browser. Requests go straight from this page to your endpoint, with no
                proxy and no telemetry. Saved keys stay in this browser's localStorage.
            </p>
        </div>
    );
}
