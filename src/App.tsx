import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Eraser,
  FlaskConical,
  Menu,
  PanelRightClose,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import SettingsPanel from "./components/SettingsPanel";
import Composer, { newQuestion } from "./components/Composer";
import ResizablePanel from "./components/ResizablePanel";
import { AssistantTurn, PendingTurn, UserTurn } from "./components/TurnView";
import { Chip } from "./components/Primitives";
import { ApiError, fetchModels, normalizeBaseUrl, runDecision, runDemo } from "./lib/api";
import * as store from "./lib/storage";
import type { ConnectionSettings, ConnState, LogEntry, Question, Turn } from "./lib/types";

const uid = () => Math.random().toString(36).slice(2, 10);

const DEFAULT_SETTINGS: ConnectionSettings = {
  baseUrl: "http://localhost:8000",
  apiKey: "",
  model: "laya",
  dialect: "systemone",
  temperature: 0,
  maxTokens: 1024,
  topP: 1,
  includeHistory: true,
  extraHeaders: "",
  rememberKey: false,
};

const EXAMPLES: { label: string; hint: string; state: string; questions: Question[] }[] = [
  {
    label: "Triage a support ticket",
    hint: "choice + noul + score in one pass",
    state:
      "Hi — I was charged twice for invoice #4411 and need the duplicate refunded today. This is the second time.",
    questions: [
      {
        ...newQuestion("choice", "route", "Which queue should own this ticket?"),
        options: [
          { id: "a", key: "billing", label: "invoices, payments, refunds" },
          { id: "b", key: "technical", label: "bugs, outages, integrations" },
          { id: "c", key: "sales", label: "pricing and plan changes" },
        ],
      },
      newQuestion("noul", "refund_requested", "Does the customer explicitly ask for a refund?"),
      newQuestion("score", "urgency", "How urgent is this?"),
    ],
  },
  {
    label: "Escalation check",
    hint: "noul",
    state:
      "Checkout has been returning 502s since 06:00 UTC. Revenue is at ~40k/day and customers are filing tickets.",
    questions: [
      newQuestion(
        "noul",
        "sev1",
        "Does this describe an active outage blocking revenue-critical purchases?",
      ),
    ],
  },
  {
    label: "Risk classification",
    hint: "score",
    state:
      "New beneficiary added mid-session, then a 48k transfer to a new payee in a different country. IP geolocation differs from account origin.",
    questions: [
      newQuestion("score", "fraud_risk", "How likely is this transaction to be fraudulent?"),
    ],
  },
  {
    label: "Intent routing",
    hint: "choice",
    state:
      "Can we push the go-live to next quarter? Engineering still has 40 open blockers.",
    questions: [
      {
        ...newQuestion("choice", "decision", "What is the call on the launch date?"),
        options: [
          { id: "a", key: "ship_now", label: "ship on the original date, accept risk" },
          { id: "b", key: "delay", label: "delay and clear the blockers" },
          { id: "c", key: "partial", label: "ship a reduced scope to a pilot" },
        ],
      },
    ],
  },
];

function greeting(): Turn {
  return {
    id: uid(),
    role: "assistant",
    createdAt: Date.now(),
    text:
      "Agon Decision Client is ready. Paste your gateway endpoint and an API key in the panel, then describe what you want decided. You can ask several typed questions at once — the model scores them all in a single forward pass.",
  };
}

export default function App() {
  const persisted = useMemo(() => store.load(), []);
  const [settings, setSettings] = useState<ConnectionSettings>({
    ...DEFAULT_SETTINGS,
    ...persisted.settings,
    apiKey:
      persisted.settings?.rememberKey && persisted.settings?.apiKey
        ? persisted.settings.apiKey
        : "",
  });
  const [turns, setTurns] = useState<Turn[]>([greeting()]);
  const [logs, setLogs] = useState<LogEntry[]>(persisted.logs ?? []);
  const [conn, setConn] = useState<ConnState>("unknown");
  const [connNote, setConnNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(!persisted.settings?.baseUrl);
  const [sidebar, setSidebar] = useState(false);
  const [questions, setQuestions] = useState<Question[]>(() => [newQuestion("noul")]);
  const [state, setState] = useState("");
    const [composerHeight, setComposerHeight] = useState<number | null>(
        persisted.composerHeight ?? null,
    );
  const scrollRef = useRef<HTMLDivElement>(null);

  /* persist */
  useEffect(() => {
    store.save({
      settings: { ...settings, apiKey: settings.rememberKey ? settings.apiKey : "" },
      history: turns,
      logs: logs.slice(0, 60),
        composerHeight,
    });
  }, [settings, turns, logs, composerHeight]);

  /* autoscroll */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, busy]);

  const patch = useCallback((p: Partial<ConnectionSettings>) => {
    setSettings((s) => ({ ...s, ...p }));
    setConn("unknown");
    setConnNote("");
  }, []);

  const endpointReady = normalizeBaseUrl(settings.baseUrl).length > 0;

  function pushLog(l: Omit<LogEntry, "id" | "at">) {
    setLogs((prev) => [{ id: uid(), at: Date.now(), ...l }, ...prev].slice(0, 60));
  }

  async function testConnection() {
    if (!endpointReady) {
      setConn("error");
      setConnNote("Enter an endpoint first.");
      return;
    }
    setConn("testing");
    setConnNote("");
    const t0 = performance.now();
    try {
      const list = await fetchModels(settings);
      const ms = Math.round(performance.now() - t0);
      pushLog({ method: "GET", url: "models", status: 200, ms, ok: true });
      setConn("ok");
      setConnNote(`${list.length} model${list.length === 1 ? "" : "s"} reachable · ${ms}ms`);
      setDemo(false);
    } catch (e) {
      const ms = Math.round(performance.now() - t0);
      const err = e as ApiError;
      pushLog({
        method: "GET",
        url: "models",
        status: err.status === "network" ? "network" : (err.status as number),
        ms,
        ok: false,
      });
      setConn("error");
      setConnNote(err.message);
    }
  }

  async function send(customQs?: Question[], customState?: string) {
    const qs = customQs ?? questions;
    const st = (customState ?? state).trim();
    if (busy) return;
    const typed = qs.filter((q) => q.type !== "text");
    if (!qs.length) return;
    if (typed.length && !st) return;
    if (!typed.length && !qs[0].instructions.trim()) return;

    const useDemo = demo || !endpointReady;
    const history = turns.filter((t) => t.role === "assistant" && t.answers?.length);

    setBusy(true);
    setTurns((prev) => [
      ...prev,
      { id: uid(), role: "user", createdAt: Date.now(), questions: qs, state: st },
    ]);
    setState("");

    try {
      const { turn } = useDemo
        ? runDemo(settings, qs, st)
        : await runDecision(settings, qs, st, history);
      pushLog({
        method: "POST",
        url: turn.endpoint ?? "",
        status: 200,
        ms: turn.durationMs ?? 0,
        ok: true,
      });
      if (!useDemo) setConn("ok");
      setTurns((prev) => [...prev, { ...turn, id: uid() }]);
      setQuestions([newQuestion(qs[0].type)]);
    } catch (e) {
      const err = e as ApiError;
      pushLog({
        method: "POST",
        url: `${normalizeBaseUrl(settings.baseUrl)}/v1/...`,
        status: err.status === "network" ? "network" : (err.status as number),
        ms: 0,
        ok: false,
      });
      if (err.status === "network") setConn("error");
      setTurns((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          createdAt: Date.now(),
          status: "error",
          error: err.message,
          endpoint: String(err.status),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

    function replay(userTurn: Turn) {
        const replayedQuestions = userTurn.questions ?? [];
        if (replayedQuestions.length === 0) {
            return;
        }
        setQuestions(replayedQuestions);
        setState(userTurn.state ?? "");
    }

  function clear() {
    setTurns([greeting()]);
    setQuestions([newQuestion("noul")]);
    setState("");
    store.clearAll();
  }

  function exportJson() {
    const blob = new Blob(
      [
        JSON.stringify(
          { settings: { ...settings, apiKey: "[redacted]" }, turns },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `decision-console-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const canSend =
    state.trim().length > 0 ||
    (questions.length === 1 &&
      questions[0].type === "text" &&
      questions[0].instructions.trim().length > 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (canSend && !busy) void send();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const connTone =
    conn === "ok"
      ? "jade"
      : conn === "error"
        ? "coral"
        : conn === "testing"
          ? "brass"
          : "neutral";
  const connText =
    conn === "ok"
      ? "connected"
      : conn === "error"
        ? "unreachable"
        : conn === "testing"
          ? "testing"
          : "not tested";

  return (
    <div className="relative z-10 flex h-full min-h-screen bg-ink-950">
      {/* ------------------------------------------------ sidebar */}
      <aside className="hidden w-[320px] shrink-0 border-r border-ink-700 bg-ink-900/60 lg:flex lg:flex-col">
        <div className="flex items-center justify-between border-b border-ink-700 px-4 py-3">
          <h2 className="label-xs text-mute-400">Configuration</h2>
          <Chip tone={connTone}>{connText}</Chip>
        </div>
        <SettingsPanel
          settings={settings}
          onChange={patch}
          conn={conn}
          onTest={testConnection}
          logs={logs}
          onClearLogs={() => setLogs([])}
        />
      </aside>

      {/* mobile drawer */}
      {sidebar && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/80" onClick={() => setSidebar(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-[340px] flex-col border-r border-ink-700 bg-ink-900">
            <div className="flex items-center justify-between border-b border-ink-700 px-4 py-3">
              <h2 className="label-xs text-mute-400">Configuration</h2>
              <button onClick={() => setSidebar(false)} className="text-mute-400">
                <X size={16} />
              </button>
            </div>
            <SettingsPanel
              settings={settings}
              onChange={patch}
              conn={conn}
              onTest={testConnection}
              logs={logs}
              onClearLogs={() => setLogs([])}
            />
          </div>
        </div>
      )}

      {/* ------------------------------------------------ main */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-ink-700 bg-ink-900/70 px-4 py-2.5 backdrop-blur-xl">
          <button
            onClick={() => setSidebar(true)}
            className="rounded-lg border border-ink-700 bg-ink-850 p-1.5 text-mute-300 lg:hidden"
          >
            <Menu size={15} />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brass-500 to-brass-700">
              <span className="font-mono text-[13px] font-bold text-ink-950">&#916;</span>
            </div>
            <div className="leading-tight">
              <div className="text-[13.5px] font-semibold tracking-tight text-mute-100">
                Agon Decision Client
              </div>
              <div className="hidden font-mono text-[10px] text-mute-600 sm:block">
                a systemone client
              </div>
            </div>
          </div>

          <button
            onClick={() => setSidebar(true)}
            className="ml-auto hidden items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-1.5 text-[11px] text-mute-300 transition hover:border-ink-600 lg:flex"
          >
            <Settings2 size={13} />
            {settings.model || "laya"}
          </button>

          <button
            onClick={exportJson}
            title="Export transcript"
            className="rounded-lg border border-ink-700 bg-ink-850 p-1.5 text-mute-300 transition hover:border-ink-600 hover:text-mute-100"
          >
            <Download size={14} />
          </button>
          <button
            onClick={clear}
            title="Clear conversation"
            className="rounded-lg border border-ink-700 bg-ink-850 p-1.5 text-mute-300 transition hover:border-coral-500/60 hover:text-coral-400"
          >
            <Eraser size={14} />
          </button>
          <button
            onClick={() => setSidebar(false)}
            className="rounded-lg border border-ink-700 bg-ink-850 p-1.5 text-mute-300 lg:hidden"
          >
            <PanelRightClose size={14} />
          </button>
        </header>

        {/* status strip */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink-800 bg-ink-900/40 px-4 py-1.5 font-mono text-[10px] text-mute-600">
          <span className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                demo
                  ? "bg-azure-500"
                  : conn === "ok"
                    ? "bg-jade-500 pulse-ring"
                    : conn === "error"
                      ? "bg-coral-500"
                      : "bg-ink-500"
              }`}
            />
            {normalizeBaseUrl(settings.baseUrl) || "no endpoint"}
          </span>
          <span className="hidden sm:inline">model: {settings.model || "-"}</span>
          <span className="hidden md:inline">{settings.dialect}</span>
          {connNote && (
            <span className={conn === "error" ? "text-coral-400" : "text-mute-400"}>
              {connNote}
            </span>
          )}
          <button
            onClick={() => {
              setDemo((d) => !d);
              setConnNote("");
            }}
            className="ml-auto inline-flex items-center gap-1 rounded border border-ink-700 px-1.5 py-0.5 text-mute-500 transition hover:border-azure-500/60 hover:text-azure-400"
            title="Toggle simulated responses when no endpoint is configured"
          >
            <FlaskConical size={10} />
            demo {demo ? "on" : "off"}
          </button>
        </div>

        {/* stream */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6">
            {turns.length <= 1 && (
              <div className="rounded-2xl border border-dashed border-ink-700 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles size={13} className="text-brass-500" />
                  <h3 className="text-[13px] font-semibold text-mute-100">
                    Start from a template
                  </h3>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex.label}
                      onClick={() => {
                        setQuestions(ex.questions);
                        setState(ex.state);
                      }}
                      className="group rounded-xl border border-ink-750 bg-ink-850/60 p-3 text-left transition hover:border-brass-700 hover:bg-ink-850"
                    >
                      <div className="text-[12.5px] font-medium text-mute-100 group-hover:text-brass-400">
                        {ex.label}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-mute-600">{ex.hint}</div>
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-[11.5px] leading-relaxed text-mute-500">
                  Tip: several typed questions in one turn are answered together in a single forward
                  pass — that is the Decision API&rsquo;s main advantage over prompting an LLM one
                  question at a time.
                </p>
              </div>
            )}

            {turns.map((t) =>
              t.role === "user" ? (
                <UserTurn key={t.id} turn={t} onReplay={() => replay(t)} />
              ) : (
                <div key={t.id}>
                  <AssistantTurn turn={t} />
                </div>
              ),
            )}

            {busy && <PendingTurn />}
          </div>
        </div>

        <ResizablePanel height={composerHeight} onHeightChange={setComposerHeight}>
            <Composer
                questions={questions}
                setQuestions={setQuestions}
                state={state}
                setState={setState}
                onSend={() => void send()}
                busy={busy}
                canSend={canSend}
            />
        </ResizablePanel>
      </main>
    </div>
  );
}