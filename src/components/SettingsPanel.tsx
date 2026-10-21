import type { ReactNode } from "react";
import { Bookmark, Check, KeyRound, PlugZap, Plus, Settings, Trash2 } from "lucide-react";
import type { ConnectionSettings, ConnState, SavedConnection } from "../lib/types";
import { normalizeBaseUrl } from "../lib/api";
import { connectionLabel, maskKey, useSavedConnections } from "../lib/connections";
import { ConfirmButton } from "./Primitives";

export interface SettingsPanelProps {
    settings: ConnectionSettings;
    onChange: (patch: Partial<ConnectionSettings>) => void;
    conn: ConnState;
    onTest: () => void;
    onOpenSettings: () => void;
    onNewConnection: () => void;
}

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
}: Pick<SettingsPanelProps, "settings" | "onChange" | "onNewConnection">) {
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
                    {connections.length > 0 && (
                        <ConfirmButton
                            label="Clear all"
                            confirmLabel="Delete all"
                            triggerClassName="text-[11px] text-mute-500 transition hover:text-coral-400"
                            onConfirm={clearConnections}
                        />
                    )}
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

export default function SettingsPanel({
    settings,
    onChange,
    conn,
    onTest,
    onOpenSettings,
    onNewConnection,
}: SettingsPanelProps) {
    return (
        <div className="flex flex-col gap-6">
            <ActiveConnectionCard settings={settings} conn={conn} onTest={onTest} onOpenSettings={onOpenSettings} />
            <SavedConnectionsSection settings={settings} onChange={onChange} onNewConnection={onNewConnection} />
        </div>
    );
}
