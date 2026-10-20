import { useState } from "react";
import {
  Activity,
  Eye,
  EyeOff,
  Plug,
  PlugZap,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import type { ConnectionSettings, ConnState, LogEntry } from "../lib/types";
import { apiUrl, fetchModels, normalizeBaseUrl, prettyEndpoint } from "../lib/api";
import { Label } from "./Primitives";

interface Props {
  settings: ConnectionSettings;
  onChange: (patch: Partial<ConnectionSettings>) => void;
  conn: ConnState;
  onTest: () => void;
  logs: LogEntry[];
  onClearLogs: () => void;
}

const inputCls =
  "w-full rounded-lg border border-ink-700 bg-ink-950/70 px-3 py-2 font-mono text-[12px] text-mute-100 outline-none transition placeholder:text-mute-500 focus:border-brass-600 focus:ring-1 focus:ring-brass-600/30";

export default function SettingsPanel({
  settings,
  onChange,
  conn,
  onTest,
  logs,
  onClearLogs,
}: Props) {
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelErr, setModelErr] = useState<string | null>(null);

  const normalised = normalizeBaseUrl(settings.baseUrl);

  async function discover() {
    setLoadingModels(true);
    setModelErr(null);
    try {
      const list = await fetchModels(settings);
      setModels(list);
      if (!list.length) setModelErr("Endpoint reachable but returned no model list.");
    } catch (e) {
      setModelErr((e as Error).message);
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto px-4 py-5">
      {/* ------------------------------------------------ connection */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Plug size={13} className="text-brass-500" />
          <h2 className="label-xs text-mute-400">API Gateway</h2>
        </div>

        <div className="space-y-3">
          <div>
            <Label
              right={
                normalised && normalised !== settings.baseUrl.trim() ? (
                  <span className="font-mono text-[10px] text-mute-500">→ {normalised}</span>
                ) : null
              }
            >
              Endpoint
            </Label>
            <input
              className={inputCls}
              placeholder="http://localhost:8000"
              value={settings.baseUrl}
              onChange={(e) => onChange({ baseUrl: e.target.value })}
              spellCheck={false}
            />
            <p className="mt-1 text-[11px] leading-snug text-mute-500">
              Base URL of your Unsloth / gateway host. Paths are appended automatically
              (<span className="font-mono text-mute-400">/v1/…</span>), so pasting the full
              endpoint also works.
            </p>
          </div>

          <div>
            <Label
              right={
                <button
                  onClick={() => setShowKey((s) => !s)}
                  className="text-mute-500 transition hover:text-mute-100"
                  aria-label={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              }
            >
              API Key
            </Label>
            <input
              className={inputCls}
              type={showKey ? "text" : "password"}
              placeholder="sk-unsloth-…"
              value={settings.apiKey}
              onChange={(e) => onChange({ apiKey: e.target.value })}
              spellCheck={false}
              autoComplete="off"
            />
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-mute-400">
              <input
                type="checkbox"
                checked={settings.rememberKey}
                onChange={(e) => onChange({ rememberKey: e.target.checked })}
                className="h-3 w-3 accent-[#e0a63c]"
              />
              Persist this key in this browser (localStorage)
            </label>
          </div>

          <div>
            <Label>Model</Label>
            <div className="flex gap-2">
              <input
                className={inputCls}
                placeholder="laya"
                value={settings.model}
                onChange={(e) => onChange({ model: e.target.value })}
                spellCheck={false}
              />
              <button
                onClick={discover}
                title="Fetch /v1/models"
                className="shrink-0 rounded-lg border border-ink-700 bg-ink-800 px-2.5 text-mute-300 transition hover:border-brass-700 hover:text-brass-400"
              >
                <RefreshCw size={14} className={loadingModels ? "animate-spin" : ""} />
              </button>
            </div>
            {models.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {models.map((m) => (
                  <button
                    key={m}
                    onClick={() => onChange({ model: m })}
                    className={`rounded-md border px-2 py-1 font-mono text-[10px] transition ${
                      settings.model === m
                        ? "border-brass-600 bg-brass-700/20 text-brass-400"
                        : "border-ink-700 bg-ink-800/60 text-mute-400 hover:border-ink-600 hover:text-mute-100"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
            {modelErr && (
              <p className="mt-2 flex gap-1.5 text-[11px] leading-snug text-coral-400">
                <TriangleAlert size={12} className="mt-0.5 shrink-0" />
                {modelErr}
              </p>
            )}
          </div>

          <div>
            <Label>API Dialect</Label>
            <div className="grid grid-cols-3 gap-1 rounded-lg border border-ink-700 bg-ink-950/70 p-1">
              {(
                [
                  ["systemone", "SystemOne"],
                  ["chat", "Chat"],
                  ["messages", "Messages"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => onChange({ dialect: v })}
                  className={`rounded-md px-2 py-1.5 font-mono text-[11px] transition ${
                    settings.dialect === v
                      ? "bg-brass-700/25 text-brass-400"
                      : "text-mute-400 hover:text-mute-100"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-mute-500">
              POST {prettyEndpoint(settings.baseUrl, settings.dialect)}
            </p>
          </div>

          <button
            onClick={onTest}
            disabled={conn === "testing"}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-ink-700 bg-ink-800 py-2 text-[12px] font-medium text-mute-100 transition hover:border-brass-700 hover:text-brass-400 disabled:opacity-60"
          >
            <PlugZap size={13} />
            {conn === "testing" ? "Testing…" : "Test connection"}
          </button>
        </div>
      </section>

      {/* ------------------------------------------------ generation */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Activity size={13} className="text-azure-500" />
          <h2 className="label-xs text-mute-400">Generation</h2>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["temperature", "Temp"],
              ["topP", "Top-p"],
              ["maxTokens", "Max tok"],
            ] as const
          ).map(([k, l]) => (
            <div key={k}>
              <Label>{l}</Label>
              <input
                className={inputCls}
                type="number"
                step={k === "maxTokens" ? 64 : 0.05}
                min={0}
                value={settings[k]}
                onChange={(e) => onChange({ [k]: Number(e.target.value) } as never)}
              />
            </div>
          ))}
        </div>
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-[11px] leading-snug text-mute-400">
          <input
            type="checkbox"
            checked={settings.includeHistory}
            onChange={(e) => onChange({ includeHistory: e.target.checked })}
            className="mt-0.5 h-3 w-3 accent-[#e0a63c]"
          />
          Fold prior turns into the <span className="font-mono text-mute-300">state</span> so
          follow-ups keep context
        </label>
        <div className="mt-3">
          <Label>Extra headers (JSON)</Label>
          <textarea
            className={`${inputCls} h-16 resize-none`}
            placeholder='{"x-team":"risk"}'
            value={settings.extraHeaders}
            onChange={(e) => onChange({ extraHeaders: e.target.value })}
            spellCheck={false}
          />
        </div>
      </section>

      {/* ------------------------------------------------ log */}
      <section className="pb-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={13} className="text-mute-500" />
            <h2 className="label-xs text-mute-400">Request log</h2>
          </div>
          {logs.length > 0 && (
            <button
              onClick={onClearLogs}
              className="text-mute-500 transition hover:text-coral-400"
              title="Clear log"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
        {logs.length === 0 ? (
          <p className="text-[11px] text-mute-500">
            No requests yet. Logs are stored locally only.
          </p>
        ) : (
          <ul className="space-y-1">
            {logs.slice(0, 40).map((l) => (
              <li
                key={l.id}
                className="flex items-center gap-2 rounded-md border border-ink-750 bg-ink-900/60 px-2 py-1.5 font-mono text-[10px]"
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    l.ok ? "bg-jade-500" : "bg-coral-500"
                  }`}
                />
                <span className="w-9 shrink-0 text-mute-400">GET</span>
                <span className="shrink-0 text-mute-300">{l.status}</span>
                <span className="truncate text-mute-500">{l.ms}ms</span>
                <span className="ml-auto shrink-0 text-mute-600">
                  {new Date(l.at).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="pb-4 text-[10px] leading-relaxed text-mute-600">
        Everything runs in your browser. Requests go straight from this page to your gateway —
        no proxy, no telemetry. Health check:{" "}
        <span className="font-mono text-mute-500">{apiUrl(settings.baseUrl, "models")}</span>
      </p>
    </div>
  );
}