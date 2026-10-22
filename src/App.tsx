import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Eraser, FlaskConical, Menu, Settings2, Sparkles, X } from "lucide-react";
import type { ConversationAction } from "./components/ConversationActions";
import ConnectionDialog from "./components/ConnectionDialog";
import Composer from "./components/Composer";
import ChatComposer from "./components/ChatComposer";
import ModelPicker, { type ModelPickerProps } from "./components/ModelPicker";
import ResizablePanel from "./components/ResizablePanel";
import { AssistantTurn, ChatUserTurn, PendingTurn, UserTurn } from "./components/TurnView";
import ManageDialog, { type ManageDialogRequest } from "./components/ManageDialog";
import SidebarContent from "./components/SidebarContent";
import {
    ApiError,
    fetchModels,
    normalizeBaseUrl,
    runChat,
    runChatDemo,
    runDecision,
    runDemo,
} from "./lib/api";
import type { CallResult } from "./lib/api";
import { findConnectionById, findFirstConnectionByURL, getSavedConnections } from "./lib/connections";
import { exportFileName, toExportedConversation } from "./lib/conversationExport";
import { downloadJson } from "./lib/downloadJson";
import { newQuestion, uid } from "./lib/questions";
import * as store from "./lib/storage";
import { turnsBefore } from "./lib/turnEditing";
import { useConversations } from "./lib/useConversations";
import { useModelCatalog } from "./lib/useModelCatalog";
import { useRequestLogs } from "./lib/useRequestLogs";
import type {
    ConnectionSettings,
    ConnState,
    Dialect,
    InterfaceMode,
    Question,
    SavedConnection,
    Turn,
} from "./lib/types";

const DEFAULT_SETTINGS: ConnectionSettings = {
    connectionId: "",
    name: "",
    baseUrl: "http://localhost:8000",
    apiKey: "",
    model: "",
    dialect: "systemone",
    temperature: 0,
    maxTokens: 1024,
    topP: 1,
    includeHistory: true,
    extraHeaders: "",
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

type Example = (typeof EXAMPLES)[number];

const CONN_DOT_CLASS: Record<ConnState, string> = {
    ok: "bg-jade-500 pulse-ring",
    error: "bg-coral-500",
    testing: "bg-ink-500",
    unknown: "bg-ink-500",
};

const DIALECT_OPTIONS: { value: Dialect; label: string; shortLabel: string }[] = [
    { value: "systemone", label: "SystemOne", shortLabel: "Sys" },
    { value: "chat", label: "Chat", shortLabel: "Chat" },
];

// The greeting is never stored: it is what an empty conversation shows.
const DECISION_GREETING: Turn = {
    id: "greeting-decision",
    role: "assistant",
    createdAt: 0,
    text:
        "Agon Community Edition is ready. To begin, create a new connection from a list of preset endpoints or enter your own, followed by the API key. Important Note: Your connection profiles on your own browser and is never sent to us. Then use either Decision or Chat mode to begin.",
};

const CHAT_GREETING: Turn = {
    id: "greeting-chat",
    role: "assistant",
    createdAt: 0,
    text:
        "This is a plain chat with the configured model. Switch the dialect to SystemOne in the header to get typed decisions (noul, choice and score) instead.",
};

function modeForDialect(dialect: Dialect): InterfaceMode {
    if (dialect === "systemone") {
        return "decision";
    }
    return "chat";
}

function dialectForMode(mode: InterfaceMode): Dialect {
    if (mode === "decision") {
        return "systemone";
    }
    return "chat";
}

/**
 * Old versions persisted the key next to the settings; keys now live only in the saved-connections list.
 * The model is not restored either: each session starts from the provider's list (see useModelCatalog).
 */
function withoutLegacyFields(stored: Partial<ConnectionSettings>): Partial<ConnectionSettings> {
    const cleaned: Record<string, unknown> = { ...stored };
    delete cleaned.apiKey;
    delete cleaned.rememberKey;
    delete cleaned.model;
    return cleaned as Partial<ConnectionSettings>;
}

function findStoredConnection(
    stored: Partial<ConnectionSettings> | undefined,
    restored: ConnectionSettings,
): SavedConnection | undefined {
    const connections = getSavedConnections();
    const savedById = findConnectionById(connections, restored.connectionId);
    if (savedById !== undefined) {
        return savedById;
    }
    // Settings stored before connections had a uuid only know the endpoint.
    const predatesUUIDs = stored !== undefined && stored.connectionId === undefined;
    if (predatesUUIDs) {
        return findFirstConnectionByURL(connections, restored.baseUrl);
    }
    return undefined;
}

function restoreSettings(stored: Partial<ConnectionSettings> | undefined): ConnectionSettings {
    const restored: ConnectionSettings = { ...DEFAULT_SETTINGS, ...withoutLegacyFields(stored ?? {}) };
    // The Messages dialect no longer exists, so a stored "messages" value falls back to Chat.
    const dialect: Dialect = restored.dialect === "systemone" ? "systemone" : "chat";
    const savedConnection = findStoredConnection(stored, restored);
    if (savedConnection === undefined) {
        return { ...restored, dialect, connectionId: "", apiKey: "" };
    }
    return {
        ...restored,
        dialect,
        connectionId: savedConnection.uuid,
        name: savedConnection.name,
        baseUrl: savedConnection.baseUrl,
        apiKey: savedConnection.apiKey,
    };
}

const IDENTITY_FIELDS: string[] = ["connectionId", "name"];

function hasSendableDecision(questions: Question[], stateText: string): boolean {
    if (questions.length === 0) {
        return false;
    }
    const hasTypedQuestion = questions.some((question) => question.type !== "text");
    if (hasTypedQuestion) {
        return stateText.length > 0;
    }
    return questions[0].instructions.trim().length > 0;
}

/** Greetings carry no status and failed requests carry "error", so only real exchanges are replayed to the model. */
function chatHistory(turns: Turn[]): Turn[] {
    return turns.filter((turn) => turn.role === "user" || turn.status === "ok");
}

async function requestDecision(
    settings: ConnectionSettings,
    questions: Question[],
    stateText: string,
    history: Turn[],
    useDemo: boolean,
): Promise<CallResult> {
    if (useDemo) {
        return runDemo(settings, questions, stateText);
    }
    return runDecision(settings, questions, stateText, history);
}

async function requestChat(
    settings: ConnectionSettings,
    message: string,
    history: Turn[],
    useDemo: boolean,
): Promise<CallResult> {
    if (useDemo) {
        return runChatDemo(settings, message);
    }
    return runChat(settings, message, history);
}

interface ConversationActionConfig {
    exportDisabled: boolean;
    clearDisabled: boolean;
    onExport: () => void;
    onClear: () => void;
}

/** One entry per action, rendered in order, so a new conversation action is one new entry here. */
function buildConversationActions(config: ConversationActionConfig): ConversationAction[] {
    return [
        {
            id: "export",
            label: "Export conversation",
            icon: Download,
            handler: config.onExport,
            disabled: config.exportDisabled,
        },
        {
            id: "clear",
            label: "Clear conversation",
            icon: Eraser,
            handler: config.onClear,
            disabled: config.clearDisabled,
        },
    ];
}

function DialectSwitch({
    dialect,
    onChange,
}: {
    dialect: Dialect;
    onChange: (dialect: Dialect) => void;
}) {
    return (
        <div
            role="radiogroup"
            aria-label="API dialect"
            className="flex shrink-0 rounded-lg border border-ink-700 bg-ink-850 p-0.5"
        >
            {DIALECT_OPTIONS.map((option) => {
                const selected = dialect === option.value;
                const stateClass = selected
                    ? "bg-brass-700/20 text-brass-400"
                    : "text-mute-400 hover:text-mute-100";
                return (
                    <button
                        key={option.value}
                        role="radio"
                        aria-checked={selected}
                        title={option.label}
                        onClick={() => onChange(option.value)}
                        className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${stateClass}`}
                    >
                        <span className="sm:hidden">{option.shortLabel}</span>
                        <span className="hidden sm:inline">{option.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

interface AppHeaderProps {
    dialect: Dialect;
    modelPicker: ModelPickerProps;
    onDialectChange: (dialect: Dialect) => void;
    onOpenMenu: () => void;
    onOpenSettings: () => void;
}

function AppHeader({
    dialect,
    modelPicker,
    onDialectChange,
    onOpenMenu,
    onOpenSettings,
}: AppHeaderProps) {
    return (
        <header className="flex shrink-0 items-center gap-2 border-b border-ink-700 bg-ink-900/70 px-4 py-2.5 backdrop-blur-xl sm:gap-3">
            <button
                onClick={onOpenMenu}
                className="rounded-lg border border-ink-700 bg-ink-850 p-1.5 text-mute-300 lg:hidden"
            >
                <Menu size={15} />
            </button>

            <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brass-500 to-brass-700">
                    <span className="font-mono text-[13px] font-bold text-ink-950">AG</span>
                </div>
                <div className="hidden leading-tight sm:block">
                    <div className="text-[13.5px] font-semibold tracking-tight text-mute-100">
                        Agon Community Edition
                    </div>
                    <div className="font-mono text-[10px]">AI assistant on your browser</div>
                </div>
            </div>

            <div className="ml-auto">
                <DialectSwitch dialect={dialect} onChange={onDialectChange} />
            </div>

            <ModelPicker {...modelPicker} />

            <button
                onClick={onOpenSettings}
                title="Connection settings"
                aria-label="Connection settings"
                className="flex items-center rounded-lg border border-ink-700 bg-ink-850 p-1.5 text-mute-300 transition hover:border-ink-600"
            >
                <Settings2 size={14} />
            </button>
        </header>
    );
}

interface StatusStripProps {
    demo: boolean;
    conn: ConnState;
    connNote: string;
    baseUrl: string;
    model: string;
    onToggleDemo: () => void;
}

function StatusStrip({ demo, conn, connNote, baseUrl, model, onToggleDemo }: StatusStripProps) {
    const dotClass = demo ? "bg-azure-500" : CONN_DOT_CLASS[conn];
    return (
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink-800 bg-ink-900/40 px-4 py-1.5 font-mono text-[10px] text-mute-600">
            <span className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                {normalizeBaseUrl(baseUrl) || "no endpoint"}
            </span>
            <span className="hidden sm:inline">model: {model || "-"}</span>
            {connNote !== "" && (
                <span className={conn === "error" ? "text-coral-400" : "text-mute-400"}>{connNote}</span>
            )}
            <button
                onClick={onToggleDemo}
                className="ml-auto inline-flex items-center gap-1 rounded border border-ink-700 px-1.5 py-0.5 text-mute-500 transition hover:border-azure-500/60 hover:text-azure-400"
                title="Toggle simulated responses when no endpoint is configured"
            >
                <FlaskConical size={10} />
                demo {demo ? "on" : "off"}
            </button>
        </div>
    );
}

function TemplatePicker({ onPick }: { onPick: (example: Example) => void }) {
    return (
        <div className="rounded-2xl border border-dashed border-ink-700 p-5">
            <div className="mb-3 flex items-center gap-2">
                <Sparkles size={13} className="text-brass-500" />
                <h3 className="text-[13px] font-semibold text-mute-100">Start from a template</h3>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
                {EXAMPLES.map((example) => (
                    <button
                        key={example.label}
                        onClick={() => onPick(example)}
                        className="group rounded-xl border border-ink-750 bg-ink-850/60 p-3 text-left transition hover:border-brass-700 hover:bg-ink-850"
                    >
                        <div className="text-[12.5px] font-medium text-mute-100 group-hover:text-brass-400">
                            {example.label}
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] text-mute-600">{example.hint}</div>
                    </button>
                ))}
            </div>
            <p className="mt-4 text-[11.5px] leading-relaxed text-mute-500">
                Tip: several typed questions in one turn are answered together in a single forward
                pass — that is the Decision API&rsquo;s main advantage over prompting an LLM one
                question at a time.
            </p>
        </div>
    );
}

interface RowActions {
    actionsDisabled: boolean;
    onReplay: (turn: Turn) => void;
    onRewind: (turn: Turn) => void;
}

function DecisionRow({ turn, actionsDisabled, onReplay, onRewind }: RowActions & { turn: Turn }) {
    if (turn.role === "user") {
        return (
            <UserTurn
                turn={turn}
                actionsDisabled={actionsDisabled}
                onReplay={() => onReplay(turn)}
                onRewind={() => onRewind(turn)}
            />
        );
    }
    return <AssistantTurn turn={turn} />;
}

function DecisionTranscript({
    turns,
    pendingAfterTurnId,
    onPickExample,
    ...actions
}: RowActions & {
    turns: Turn[];
    pendingAfterTurnId: string | null;
    onPickExample: (example: Example) => void;
}) {
    return (
        <>
            {turns.length === 0 && <TemplatePicker onPick={onPickExample} />}
            {turns.length === 0 && <AssistantTurn turn={DECISION_GREETING} />}
            {turns.map((turn) => (
                <Fragment key={turn.id}>
                    <DecisionRow turn={turn} {...actions} />
                    {pendingAfterTurnId === turn.id && <PendingTurn />}
                </Fragment>
            ))}
        </>
    );
}

function ChatEmptyState({
    model,
    endpoint,
    simulated,
}: {
    model: string;
    endpoint: string;
    simulated: boolean;
}) {
    return (
        <div className="rounded-2xl border border-dashed border-ink-700 p-5">
            <h3 className="text-[13px] font-semibold text-mute-100">Chatting with {model}</h3>
            <p className="mt-1 font-mono text-[11px] text-mute-500">{endpoint}</p>
            {simulated && (
                <p className="mt-3 text-[11.5px] leading-relaxed text-mute-500">
                    Replies are simulated until you connect an endpoint and turn demo off.
                </p>
            )}
        </div>
    );
}

function ChatRow({ turn, actionsDisabled, onReplay, onRewind }: RowActions & { turn: Turn }) {
    if (turn.role === "user") {
        return (
            <ChatUserTurn
                turn={turn}
                actionsDisabled={actionsDisabled}
                onReplay={() => onReplay(turn)}
                onRewind={() => onRewind(turn)}
            />
        );
    }
    return <AssistantTurn turn={turn} />;
}

function ChatTranscript({
    turns,
    pendingAfterTurnId,
    model,
    endpoint,
    simulated,
    ...actions
}: RowActions & {
    turns: Turn[];
    pendingAfterTurnId: string | null;
    model: string;
    endpoint: string;
    simulated: boolean;
}) {
    return (
        <>
            {turns.length === 0 && <ChatEmptyState model={model} endpoint={endpoint} simulated={simulated} />}
            {turns.length === 0 && <AssistantTurn turn={CHAT_GREETING} />}
            {turns.map((turn) => (
                <Fragment key={turn.id}>
                    <ChatRow turn={turn} {...actions} />
                    {pendingAfterTurnId === turn.id && <PendingTurn />}
                </Fragment>
            ))}
        </>
    );
}

export default function App() {
    const persisted = useMemo(() => store.load(), []);
    const [settings, setSettings] = useState<ConnectionSettings>(() => restoreSettings(persisted.settings));
    const [conn, setConn] = useState<ConnState>("unknown");
    const [connNote, setConnNote] = useState("");
    const [demo, setDemo] = useState(!persisted.settings?.baseUrl);
    const [sidebar, setSidebar] = useState(false);
    const [manageRequest, setManageRequest] = useState<ManageDialogRequest | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [questions, setQuestions] = useState<Question[]>(() => [newQuestion("noul")]);
    const [state, setState] = useState("");
    const [chatDraft, setChatDraft] = useState("");
    const [composerHeight, setComposerHeight] = useState<number | null>(
        persisted.composerHeight ?? null,
    );
    const scrollRef = useRef<HTMLDivElement>(null);

    // The screen follows the open conversation, so what is shown always matches the conversation's own mode.
    const conversationState = useConversations(modeForDialect(settings.dialect), alignDialectWithMode);
    const requestLogs = useRequestLogs();
    const interfaceMode = conversationState.mode;
    const busy = conversationState.isPending;

    useEffect(() => {
        store.save({
            // Keys persist only through the saved-connections list, never with the settings blob.
            // The model lives in sessionStorage (see modelSelection.ts).
            settings: { ...settings, apiKey: "", model: "" },
            composerHeight,
        });
    }, [settings, composerHeight]);

    useEffect(() => {
        const scrollElement = scrollRef.current;
        if (scrollElement) {
            scrollElement.scrollTop = scrollElement.scrollHeight;
        }
    }, [conversationState.turns, conversationState.pendingAfterTurnId, interfaceMode]);

    const patch = useCallback((p: Partial<ConnectionSettings>) => {
        setSettings((s) => ({ ...s, ...p }));
        // Naming or saving a connection does not change how it connects, so a tested status stays valid.
        const changesOnlyIdentity = Object.keys(p).every((field) => IDENTITY_FIELDS.includes(field));
        if (changesOnlyIdentity) {
            return;
        }
        setConn("unknown");
        setConnNote("");
    }, []);

    const setModel = useCallback((model: string) => {
        setSettings((current) => {
            if (current.model === model) {
                return current;
            }
            return { ...current, model };
        });
    }, []);

    const modelCatalog = useModelCatalog(settings, setModel);

    const endpointReady = normalizeBaseUrl(settings.baseUrl).length > 0;

    const modelPicker: ModelPickerProps = {
        model: settings.model,
        models: modelCatalog.models,
        isLoading: modelCatalog.isLoading,
        errorMessage: modelCatalog.errorMessage,
        hasEndpoint: endpointReady,
        onSelect: modelCatalog.selectModel,
        onReload: modelCatalog.reload,
    };

    /** Opening a stored conversation of the other mode switches the dialect; it never starts a new draft. */
    function alignDialectWithMode(mode: InterfaceMode) {
        if (modeForDialect(settings.dialect) !== mode) {
            patch({ dialect: dialectForMode(mode) });
        }
    }

    function changeDialect(dialect: Dialect) {
        if (dialect === settings.dialect) {
            return;
        }
        patch({ dialect });
        conversationState.startDraft(modeForDialect(dialect));
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
            setConn("ok");
            setConnNote(`${list.length} model${list.length === 1 ? "" : "s"} reachable · ${ms}ms`);
            setDemo(false);
        } catch (e) {
            const err = e as ApiError;
            setConn("error");
            setConnNote(err.message);
        }
    }

    function recordSuccess(uuid: string, userTurnId: string, turn: Turn, useDemo: boolean) {
        if (!useDemo) {
            setConn("ok");
        }
        conversationState.insertReply(uuid, userTurnId, { ...turn, id: uid() });
    }

    function recordFailure(uuid: string, userTurnId: string, error: ApiError) {
        if (error.status === "network") {
            setConn("error");
        }
        conversationState.insertReply(uuid, userTurnId, {
            id: uid(),
            role: "assistant",
            createdAt: Date.now(),
            status: "error",
            error: error.message,
            endpoint: String(error.status),
        });
    }

    /** The reply is filed under the conversation that sent it, so switching conversations while waiting cannot misplace it. */
    async function runExchange(
        uuid: string,
        userTurnId: string,
        useDemo: boolean,
        call: () => Promise<CallResult>,
    ): Promise<boolean> {
        conversationState.beginExchange(uuid, userTurnId);
        try {
            const { turn } = await call();
            recordSuccess(uuid, userTurnId, turn, useDemo);
            return true;
        } catch (caught) {
            recordFailure(uuid, userTurnId, caught as ApiError);
            return false;
        } finally {
            conversationState.endExchange(uuid);
        }
    }

    async function sendDecision() {
        const stateText = state.trim();
        if (busy || !hasSendableDecision(questions, stateText)) {
            return;
        }
        const uuid = conversationState.openUUID;
        const useDemo = demo || !endpointReady;
        const history = conversationState.turns.filter(
            (turn) => turn.role === "assistant" && (turn.answers?.length ?? 0) > 0,
        );
        const userTurn: Turn = { id: uid(), role: "user", createdAt: Date.now(), questions, state: stateText };

        conversationState.appendTurn(uuid, userTurn);
        setState("");

        const succeeded = await runExchange(uuid, userTurn.id, useDemo, () =>
            requestDecision(settings, questions, stateText, history, useDemo),
        );
        // The composer belongs to whatever is open now; wiping it would discard text typed for another conversation.
        if (succeeded && conversationState.isOpen(uuid)) {
            setQuestions([newQuestion(questions[0].type)]);
        }
    }

    async function sendChat() {
        const message = chatDraft.trim();
        if (busy || message.length === 0) {
            return;
        }
        const uuid = conversationState.openUUID;
        const useDemo = demo || !endpointReady;
        const history = chatHistory(conversationState.turns);
        const userTurn: Turn = { id: uid(), role: "user", createdAt: Date.now(), state: message };

        conversationState.appendTurn(uuid, userTurn);
        setChatDraft("");

        await runExchange(uuid, userTurn.id, useDemo, () => requestChat(settings, message, history, useDemo));
    }

    /** Chat Replay: the message is answered again from the turns before it; later messages stay as they are. */
    async function resendChat(userTurn: Turn) {
        if (busy) {
            return;
        }
        const uuid = conversationState.openUUID;
        const useDemo = demo || !endpointReady;
        const history = chatHistory(turnsBefore(conversationState.turns, userTurn.id));
        const message = userTurn.state ?? "";

        conversationState.removeReply(uuid, userTurn.id);
        await runExchange(uuid, userTurn.id, useDemo, () => requestChat(settings, message, history, useDemo));
    }

    function loadIntoForm(userTurn: Turn) {
        const replayedQuestions = userTurn.questions ?? [];
        if (replayedQuestions.length === 0) {
            return;
        }
        setQuestions(replayedQuestions);
        setState(userTurn.state ?? "");
    }

    function rewindDecision(userTurn: Turn) {
        conversationState.rewindDecisionTurn(userTurn.id);
        loadIntoForm(userTurn);
    }

    function rewindChat(userTurn: Turn) {
        conversationState.rewindChatTurn(userTurn.id);
        setChatDraft(userTurn.state ?? "");
    }

    function pickExample(example: Example) {
        setQuestions(example.questions);
        setState(example.state);
    }

    /** Clear is for the Conversations action row; it is disabled while the open conversation waits for a reply. */
    function clear() {
        if (busy) {
            return;
        }
        conversationState.clear();
        setQuestions([newQuestion("noul")]);
        setState("");
        setChatDraft("");
    }

    /** Export is for the Conversations action row; it is disabled while the open conversation has no turns. */
    function exportOpenConversation() {
        const openConversation = conversationState.openConversation;
        if (openConversation.content.length === 0) {
            return;
        }
        downloadJson(exportFileName("conversations"), [toExportedConversation(openConversation)]);
    }

    function openManageDialog(request: ManageDialogRequest) {
        setSidebar(false);
        setManageRequest(request);
    }

    function startNewConversation() {
        setSidebar(false);
        conversationState.startDraft(interfaceMode);
    }

    function openConversation(uuid: string) {
        setSidebar(false);
        void conversationState.open(uuid);
    }

    function openSettings() {
        setSidebar(false);
        setSettingsOpen(true);
    }

    function startNewConnection() {
        patch({ connectionId: "", name: "", baseUrl: "", apiKey: "" });
        openSettings();
    }

    function toggleDemo() {
        setDemo((current) => !current);
        setConnNote("");
    }

    function sendActive() {
        if (interfaceMode === "decision") {
            void sendDecision();
        } else {
            void sendChat();
        }
    }

    const canSend =
        state.trim().length > 0 ||
        (questions.length === 1 &&
            questions[0].type === "text" &&
            questions[0].instructions.trim().length > 0);
    const canSendChat = chatDraft.trim().length > 0;
    const canSendActive = interfaceMode === "decision" ? canSend : canSendChat;

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                if (canSendActive && !busy) {
                    sendActive();
                }
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    const conversationActions = buildConversationActions({
        exportDisabled: conversationState.turns.length === 0,
        clearDisabled: busy,
        onExport: exportOpenConversation,
        onClear: clear,
    });

    // The desktop aside and the mobile drawer show the same content.
    const sidebarContent = (
        <SidebarContent
            connection={{
                settings,
                onChange: patch,
                conn,
                onTest: testConnection,
                onOpenSettings: openSettings,
                onNewConnection: startNewConnection,
            }}
            conversations={{
                conversations: conversationState.conversations,
                openConversationUUID: conversationState.openUUID,
                actions: conversationActions,
                onNewConversation: startNewConversation,
                onOpenConversation: openConversation,
            }}
            requestLogs={requestLogs.logs}
            onOpenManageDialog={openManageDialog}
        />
    );

    return (
        <div className="relative z-10 flex h-full min-h-screen bg-ink-950">
            <aside className="hidden w-[320px] shrink-0 border-r border-ink-700 bg-ink-900/60 lg:flex lg:flex-col">
                {sidebarContent}
            </aside>

            {sidebar && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-ink-950/80" onClick={() => setSidebar(false)} />
                    <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-[340px] flex-col border-r border-ink-700 bg-ink-900">
                        <div className="flex justify-end border-b border-ink-700 px-4 py-3">
                            <button
                                type="button"
                                onClick={() => setSidebar(false)}
                                aria-label="Close menu"
                                className="text-mute-400"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        {sidebarContent}
                    </div>
                </div>
            )}

            <main className="flex min-w-0 flex-1 flex-col">
                <AppHeader
                    dialect={settings.dialect}
                    modelPicker={modelPicker}
                    onDialectChange={changeDialect}
                    onOpenMenu={() => setSidebar(true)}
                    onOpenSettings={openSettings}
                />

                <StatusStrip
                    demo={demo}
                    conn={conn}
                    connNote={connNote}
                    baseUrl={settings.baseUrl}
                    model={settings.model}
                    onToggleDemo={toggleDemo}
                />

                <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
                    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6">
                        {interfaceMode === "decision" && (
                            <DecisionTranscript
                                turns={conversationState.turns}
                                pendingAfterTurnId={conversationState.pendingAfterTurnId}
                                actionsDisabled={busy}
                                onReplay={loadIntoForm}
                                onRewind={rewindDecision}
                                onPickExample={pickExample}
                            />
                        )}
                        {interfaceMode === "chat" && (
                            <ChatTranscript
                                turns={conversationState.turns}
                                pendingAfterTurnId={conversationState.pendingAfterTurnId}
                                actionsDisabled={busy}
                                onReplay={(userTurn) => void resendChat(userTurn)}
                                onRewind={rewindChat}
                                model={settings.model.trim() || "default"}
                                endpoint={normalizeBaseUrl(settings.baseUrl) || "no endpoint"}
                                simulated={demo || !endpointReady}
                            />
                        )}
                    </div>
                </div>

                {interfaceMode === "decision" && (
                    <ResizablePanel height={composerHeight} onHeightChange={setComposerHeight}>
                        <Composer
                            questions={questions}
                            setQuestions={setQuestions}
                            state={state}
                            setState={setState}
                            onSend={() => void sendDecision()}
                            busy={busy}
                            canSend={canSend}
                        />
                    </ResizablePanel>
                )}
                {interfaceMode === "chat" && (
                    <ChatComposer
                        value={chatDraft}
                        onValueChange={setChatDraft}
                        onSend={() => void sendChat()}
                        busy={busy}
                        canSend={canSendChat}
                    />
                )}
            </main>

            <ConnectionDialog
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                settings={settings}
                onChange={patch}
                conn={conn}
                connNote={connNote}
                onTest={testConnection}
            />

            <ManageDialog
                request={manageRequest}
                onClose={() => setManageRequest(null)}
                conversations={conversationState.conversations}
                openConversationUUID={conversationState.openUUID}
                onOpenConversation={openConversation}
                onDeleteConversations={conversationState.deleteSelected}
                onDeleteAllConversations={conversationState.deleteAll}
                requestLogs={requestLogs.logs}
                onDeleteRequestLogs={requestLogs.deleteSelected}
                onDeleteAllRequestLogs={requestLogs.deleteAll}
            />
        </div>
    );
}
