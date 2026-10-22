import type {
    ConnectionSettings,
    Dialect,
    LogEntry,
    NormalizedAnswer,
    QType,
    Question,
    Turn,
} from "./types";

/* ------------------------------------------------------------------ */
/* URL handling                                                        */
/* ------------------------------------------------------------------ */

/** Accepts anything the user is likely to paste:
 *  http://localhost:8000  |  http://host/v1  |  http://host/v1/systemone
 *  host:8000               |  https://gw.example.com/gateway/
 * and returns a clean origin+path root. */
export function normalizeBaseUrl(raw: string): string {
    let s = (raw || "").trim();
    if (!s) return "";
    if (!/^https?:\/\//i.test(s)) s = "http://" + s;
    s = s.replace(/\s+/g, "");
    s = s.replace(/\/+$/, "");
    s = s.replace(/\/v1\/(systemone|decisions|chat\/completions|messages|models|responses)\/?$/i, "");
    s = s.replace(/\/v1\/?$/i, "");
    s = s.replace(/\/+$/, "");
    return s;
}

export function apiUrl(base: string, path: string): string {
    const b = normalizeBaseUrl(base);
    return `${b}/v1/${path.replace(/^\//, "")}`;
}

export function prettyEndpoint(base: string, dialect: Dialect): string {
    const path = dialect === "systemone" ? "systemone" : "chat/completions";
    return apiUrl(base, path);
}

/** Lowercased hostname of a base URL, or "" when it is empty or not parseable (the user may be mid-typing). */
function hostnameOf(baseUrl: string): string {
    const normalizedURL = normalizeBaseUrl(baseUrl);
    if (normalizedURL === "") {
        return "";
    }
    try {
        return new URL(normalizedURL).hostname.toLowerCase();
    } catch {
        return "";
    }
}

interface ModelFilter {
    parameter: string;
    valueByDialect: Record<Dialect, string>;
}

const OUTPUT_MODALITIES_FILTER: ModelFilter = {
    parameter: "output_modalities",
    valueByDialect: {
        systemone: "decisions",
        chat: "text",
    },
};

/** Hostname -> the query parameter that narrows the /models list for that provider, and its value per dialect.
 *  Providers missing here (Together AI, OpenCode, local servers) have no such filter and list every model. */
const MODEL_FILTER_BY_DOMAIN: Record<string, ModelFilter> = {
    "openrouter.ai": OUTPUT_MODALITIES_FILTER,
    "api.vultrinference.com": OUTPUT_MODALITIES_FILTER,
};

/** Hostname -> extra headers sent only to that provider (e.g. app attribution). Add an entry to cover another one. */
const HEADERS_BY_DOMAIN: Record<string, Record<string, string>> = {
    "openrouter.ai": {
        "HTTP-Referer": "https://xiaolintangyuan.github.io/agon-decision-client",
        "X-OpenRouter-Title": "Agon Community Edition",
        "X-OpenRouter-Categories": "personal-agent",
    },
};

function endpointHeaders(baseUrl: string): Record<string, string> {
    return HEADERS_BY_DOMAIN[hostnameOf(baseUrl)] ?? {};
}

/** The settings a /models request depends on, so callers can watch just these fields. */
export type ModelRequestSettings = Pick<ConnectionSettings, "baseUrl" | "apiKey" | "dialect" | "extraHeaders">;

function authHeaders(s: Pick<ConnectionSettings, "baseUrl" | "apiKey" | "extraHeaders">): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json", ...endpointHeaders(s.baseUrl) };
    const key = (s.apiKey || "").trim();
    if (key) {
        h.Authorization = `Bearer ${key}`;
        h["x-api-key"] = key;
    }
    if (s.extraHeaders && s.extraHeaders.trim()) {
        try {
            const parsed = JSON.parse(s.extraHeaders);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                Object.assign(h, parsed as Record<string, string>);
            }
        } catch {
            /* ignore malformed extra headers */
        }
    }
    return h;
}

export class ApiError extends Error {
    status: number | "network";
    body?: string;
    constructor(message: string, status: number | "network", body?: string) {
        super(message);
        this.status = status;
        this.body = body;
    }
}

export interface RequestOptions {
    /** Records the call in the request log. Only conversation POSTs opt in. */
    logRequest?: boolean;
    /** The body object that was sent, kept as an object so the log shows it without re-parsing. */
    requestBody?: unknown;
}

export type RequestLogSink = (entry: LogEntry) => void | Promise<void>;

let requestLogSink: RequestLogSink | null = null;

/** Where finished logged requests go. Set once by the app; null stops logging. */
export function setRequestLogSink(sink: RequestLogSink | null): void {
    requestLogSink = sink;
}

/** Logging is a side channel: a failing sink is reported but never changes the outcome of the request. */
async function deliverLogEntry(entry: LogEntry): Promise<void> {
    if (requestLogSink === null) {
        return;
    }
    try {
        await requestLogSink(entry);
    } catch (error) {
        console.error("A request log entry could not be delivered.", error);
    }
}

type RequestRecord = Pick<LogEntry, "requestedAt" | "method" | "url" | "status" | "ms" | "ok" | "response">;

function recordRequest(options: RequestOptions, record: RequestRecord): void {
    if (options.logRequest !== true) {
        return;
    }
    void deliverLogEntry({ uuid: crypto.randomUUID(), request: options.requestBody, ...record });
}

function describeNetworkFailure(caught: unknown, url: string): ApiError {
    const error = caught as Error;
    const isCors =
        error?.name === "TypeError" ||
        /failed to fetch|networkerror|load failed/i.test(error?.message || "");
    if (isCors) {
        return new ApiError(
            `Network / CORS failure reaching ${new URL(url).origin}. The browser blocked the call. The server must allow CORS from this origin (or sit behind a gateway that does), and the URL must be reachable from this machine.`,
            "network",
        );
    }
    return new ApiError(error?.message || "Network request failed", "network");
}

function parseResponseBody(text: string): unknown {
    if (text === "") {
        return null;
    }
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

async function request(
    url: string,
    init: RequestInit,
    options: RequestOptions = {},
): Promise<{ json: unknown; ms: number; status: number }> {
    const method = init.method ?? "GET";
    const requestedAt = Date.now();
    const startedAt = performance.now();
    let response: Response;
    try {
        response = await fetch(url, init);
    } catch (caught) {
        const failure = describeNetworkFailure(caught, url);
        const failedMs = Math.round(performance.now() - startedAt);
        recordRequest(options, {
            url,
            method,
            requestedAt,
            status: "network",
            ms: failedMs,
            ok: false,
            response: failure.message,
        });
        throw failure;
    }
    const ms = Math.round(performance.now() - startedAt);
    const text = await response.text();
    const json = parseResponseBody(text);
    recordRequest(options, {
        url,
        method,
        requestedAt,
        status: response.status,
        ms,
        ok: response.ok,
        response: json,
    });
    if (!response.ok) {
        throw new ApiError(describeHttp(response.status, json), response.status, text.slice(0, 800));
    }
    return { json, ms, status: response.status };
}

function describeHttp(status: number, json: unknown): string {
    if (status === 401 || status === 403)
        return "401 Unauthorized — the API key was rejected. Check the API key in the connection settings.";
    if (status === 404)
        return "404 Not Found — this endpoint does not exist on the target. Try the endpoint without /v1/systemone, and confirm the server exposes this API.";
    if (status === 429) return "429 Rate limited by the gateway. Wait a moment and retry.";
    if (status >= 500) return `${status} Server error from the gateway/model host.`;
    if (json && typeof json === "object") {
        const j = json as Record<string, unknown>;
        const detail = (j.error as Record<string, unknown>)?.message ?? j.message ?? j.detail;
        if (detail) return `${status} — ${String(detail)}`;
    }
    return `${status} — unexpected response from the gateway.`;
}

/* ------------------------------------------------------------------ */
/* Models                                                              */
/* ------------------------------------------------------------------ */

function buildModelsUrl(s: ModelRequestSettings): string {
    const modelsUrl = apiUrl(s.baseUrl, "models");
    const modelFilter = MODEL_FILTER_BY_DOMAIN[hostnameOf(s.baseUrl)];
    if (modelFilter === undefined) {
        return modelsUrl;
    }
    const parsedUrl = new URL(modelsUrl);
    parsedUrl.searchParams.set(modelFilter.parameter, modelFilter.valueByDialect[s.dialect]);
    return parsedUrl.toString();
}

export async function fetchModels(s: ModelRequestSettings): Promise<string[]> {
    const { json } = await request(buildModelsUrl(s), {
        method: "GET",
        headers: authHeaders(s),
    });
    const data = (json as { data?: unknown })?.data;
    if (Array.isArray(data)) {
        return data
            .map((m) =>
                typeof m === "string" ? m : String((m as Record<string, unknown>)?.id ?? ""),
            )
            .filter(Boolean)
            .sort();
    }
    if (Array.isArray(json)) {
        return json
            .map((m) => (typeof m === "string" ? m : String((m as Record<string, unknown>)?.id ?? "")))
            .filter(Boolean)
            .sort();
    }
    return [];
}

/* ------------------------------------------------------------------ */
/* Payload building                                                    */
/* ------------------------------------------------------------------ */

export const slug = (s: string, fallback: string) => {
    const v = (s || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    return v || fallback;
};

/** The key a question travels under in the request and comes back under in the response. */
export function questionKey(question: Question, typedPosition: number): string {
    return slug(question.name, `q_${typedPosition + 1}`);
}

export function buildQuestions(qs: Question[]) {
    const out: Record<string, unknown> = {};
    const typedQuestions = qs.filter((question) => question.type !== "text");
    for (let index = 0; index < typedQuestions.length; index++) {
        const q = typedQuestions[index];
        const key = questionKey(q, index);
        const entry: Record<string, unknown> = { type: q.type };
        const ins = (q.instructions || "").trim();
        if (ins) entry.instructions = ins;
        if (q.type === "choice") {
            entry.criteria = Object.fromEntries(
                q.options
                    .filter((o) => o.key.trim())
                    .map((o) => [slug(o.key, "option"), (o.label || o.key).trim()]),
            );
        }
        if (q.type === "score") {
            entry.criteria = q.levels.map((l) => l.trim()).filter(Boolean);
        }
        out[key] = entry;
    }
    return out;
}

export function buildState(turn: Pick<Turn, "state" | "questions">, history: Turn[]): string {
    const base = (turn.state || "").trim();
    if (!history.length) return base;
    const lines: string[] = [];
    lines.push("Prior turns in this conversation:");
    for (const h of history.slice(-6)) {
        if (h.role !== "assistant") continue;
        const summary = (h.answers || [])
            .map((a) => `${a.name}=${describeAnswer(a)}`)
            .join("; ");
        if (summary) lines.push(`- ${summary}`);
    }
    if (!lines.length) return base;
    return `${base}\n\n${lines.join("\n")}`.trim();
}

export function buildSystemOneBody(
    s: ConnectionSettings,
    qs: Question[],
    state: string,
    history: Turn[],
) {
    return {
        model: s.model.trim() || "laya",
        state: s.includeHistory ? buildState({ state, questions: qs }, history) : state,
        questions: buildQuestions(qs),
    };
}

export function buildChatBody(
    s: ConnectionSettings,
    qs: Question[],
    state: string,
    history: Turn[],
) {
    const sys = [
        "You are a decision-modelling engine.",
        "Answer the operator's questions directly and concisely. Prefer structured JSON when a structured answer is requested.",
    ].join(" ");

    const typed = qs.filter((q) => q.type !== "text");
    const spec = typed.length
        ? `\n\nDecide these, and include an "answers" object in JSON with the keys below:\n` +
        typed
            .map((q) => {
                if (q.type === "choice")
                    return `- ${slug(q.name, "q")} (choice): ${q.options
                        .map((o) => o.key)
                        .join(" | ")}${q.instructions ? ` — ${q.instructions}` : ""}`;
                if (q.type === "score")
                    return `- ${slug(q.name, "q")} (score 0–${Math.max(
                        q.levels.length - 1,
                        0,
                    )}): ${q.levels.join(" | ")}${q.instructions ? ` — ${q.instructions}` : ""}`;
                return `- ${slug(q.name, "q")} (noul, probability of true)${q.instructions ? ` — ${q.instructions}` : ""
                    }`;
            })
            .join("\n")
        : "";

    // A plain chat must not be told it is a decision engine that prefers JSON.
    const messages: { role: string; content: string }[] = [];
    if (typed.length > 0) {
        messages.push({ role: "system", content: sys });
    }
    for (const h of history.slice(-8)) {
        if (h.role === "user") messages.push({ role: "user", content: h.state || "" });
        else if (h.text) messages.push({ role: "assistant", content: h.text });
    }
    messages.push({ role: "user", content: `${state}${spec}` });
    return {
        model: s.model.trim() || "default",
        messages,
        temperature: s.temperature,
        top_p: s.topP,
        max_tokens: s.maxTokens,
        stream: false,
    };
}

/* ------------------------------------------------------------------ */
/* Normalisation — tolerant of many server response shapes              */
/* ------------------------------------------------------------------ */

const num = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
    return null;
};

const asProb = (v: unknown): number | null => {
    const n = num(v);
    if (n === null) return null;
    const p = n > 1 ? n / 100 : n;
    return Math.min(1, Math.max(0, p));
};

function firstNum(o: Record<string, unknown>, keys: string[]): number | null {
    for (const k of keys) if (k in o && o[k] !== null) return num(o[k]);
    return null;
}

function parseProbMap(raw: unknown): { key: string; p: number }[] {
    if (!raw) return [];
    if (Array.isArray(raw)) {
        return raw
            .map((row) => {
                if (typeof row === "string") return { key: row, p: NaN };
                const o = row as Record<string, unknown>;
                const key = String(o.key ?? o.id ?? o.label ?? o.name ?? o.option ?? o.value ?? "?");
                const p = asProb(o.probability ?? o.prob ?? o.p ?? o.score ?? o.value ?? o.confidence);
                return { key, p: p ?? NaN };
            })
            .filter((r) => !Number.isNaN(r.p) && r.key !== "value");
    }
    if (typeof raw === "object") {
        return Object.entries(raw as Record<string, unknown>)
            .map(([k, v]) => ({ key: k, p: asProb(v) ?? NaN }))
            .filter((r) => !Number.isNaN(r.p));
    }
    return [];
}

export function normalizeAnswers(raw: unknown, qs: Question[]): NormalizedAnswer[] {
    let answers: Record<string, unknown> = {};
    if (raw && typeof raw === "object") {
        const r = raw as Record<string, unknown>;
        const cands = [r.answers, r.answer, r.output, r.result, r.decisions, r.data];
        for (const c of cands) {
            if (c && typeof c === "object" && !Array.isArray(c)) {
                answers = c as Record<string, unknown>;
                break;
            }
        }
    }

    const typed = qs.filter((q) => q.type !== "text");

    // Shape 1: keyed answers object (Decision API)
    if (Object.keys(answers).length && typed.some((q) => q.name.trim() || q.instructions.trim())) {
        const out: NormalizedAnswer[] = [];
        for (let index = 0; index < typed.length; index++) {
            const key = questionKey(typed[index], index);
            const hit = findAnswerFor(answers, key, index);
            out.push(parseOne(typed[index], hit));
        }
        if (out.length) return out;
    }

    // Shape 2: flat { type, answer, ... } object
    if (answers && (answers.type || answers.answer !== undefined) && typed.length === 1) {
        return [parseOne(typed[0], answers)];
    }

    // Shape 3: no usable structure — return empty, caller shows raw JSON
    return [];
}

function findAnswerFor(answers: Record<string, unknown>, key: string, position: number): unknown {
    const keyedAnswer = answers[key];
    if (keyedAnswer !== undefined && keyedAnswer !== null) {
        return keyedAnswer;
    }
    return Object.values(answers)[position];
}

function parseOne(q: Question, hit: unknown): NormalizedAnswer {
    const o =
        hit && typeof hit === "object"
            ? (hit as Record<string, unknown>)
            : { answer: hit } as Record<string, unknown>;

    const detectedType: QType =
        (String(o.type ?? o.kind ?? "") as QType) || q.type || "choice";

    const confidence = asProb(
        firstNum(o, ["confidence", "certainty", "reliability"]) ?? null,
    );

    if (detectedType === "noul" || q.type === "noul") {
        let p = asProb(
            firstNum(o, ["noul", "probability", "prob", "p", "yes", "true_probability", "confidence"]),
        );
        // Some servers answer with a hard boolean instead of a calibrated number.
        if (p === null && typeof o.answer === "boolean") p = o.answer ? 1 : 0;
        if (p === null && typeof o.result === "boolean") p = o.result ? 1 : 0;
        return {
            name: slug(q.name, "noul"),
            type: "noul",
            instructions: q.instructions,
            labels: {},
            noulProb: p,
            chosenKey: null,
            probs: [],
            score: null,
            scoreProbs: [],
            confidence: confidence ?? p,
            raw: hit,
        };
    }

    if (detectedType === "score" || q.type === "score") {
        const s = firstNum(o, ["answer", "score", "value", "level", "index", "rating"]);
        let probs = parseProbMap(
            o.probs ?? o.probabilities ?? o.distribution ?? o.levels ?? o.score_probs ?? o.scores,
        );
        // A bare numeric array maps positionally onto the declared levels.
        if (!probs.length) {
            const raw = o.probs ?? o.probabilities ?? o.distribution ?? o.levels ?? o.score_probs;
            if (Array.isArray(raw) && raw.every((v) => typeof v === "number")) {
                probs = (raw as number[]).map((v, i) => ({ key: q.levels[i] ?? String(i), p: asProb(v) ?? 0 }));
            }
        }
        return {
            name: slug(q.name, "score"),
            type: "score",
            instructions: q.instructions,
            labels: Object.fromEntries(q.levels.map((l, i) => [String(i), l])),
            noulProb: null,
            chosenKey: null,
            probs: [],
            score: s,
            scoreProbs: probs.map((r) => ({
                level: String(r.key),
                p: r.p,
            })),
            confidence,
            raw: hit,
        };
    }

    const chosen = o.answer ?? o.choice ?? o.selected ?? o.key ?? o.value ?? o.pick;
    const chosenKey =
        chosen !== null && chosen !== undefined
            ? typeof chosen === "object"
                ? String(
                    (chosen as Record<string, unknown>).key ??
                    (chosen as Record<string, unknown>).id ??
                    (chosen as Record<string, unknown>).label ??
                    "?",
                )
                : String(chosen)
            : null;

    let probs = parseProbMap(
        o.probs ?? o.probabilities ?? o.choices ?? o.scores ?? o.distribution ?? o.option_probs,
    );

    const labels: Record<string, string> = {};
    for (const opt of q.options) {
        const k = slug(opt.key, "option");
        labels[k] = opt.label || opt.key;
    }
    probs = probs.map((r) => ({ ...r, key: slug(r.key, "option") }));

    // Fall back to the declared options if the server returned only the pick.
    if (!probs.length && q.options.length) {
        probs = q.options.map((opt) => ({
            key: slug(opt.key, "option"),
            p: chosenKey && slug(opt.key, "") === slug(chosenKey, "") ? 1 : 0,
        }));
    }

    return {
        name: slug(q.name, "choice"),
        type: "choice",
        instructions: q.instructions,
        labels,
        noulProb: null,
        chosenKey: chosenKey ? slug(chosenKey, "choice") : null,
        probs,
        score: null,
        scoreProbs: [],
        confidence: confidence ?? (probs.length ? Math.max(...probs.map((p) => p.p)) : null),
        raw: hit,
    };
}

export function describeAnswer(a: NormalizedAnswer): string {
    if (a.type === "noul") return a.noulProb === null ? "n/a" : (a.noulProb >= 0.5 ? "true" : "false");
    if (a.type === "score") return a.score === null ? "n/a" : String(a.score);
    return a.chosenKey ?? "n/a";
}

export function pickText(raw: unknown): string | null {
    if (!raw || typeof raw !== "object") return typeof raw === "string" ? raw : null;
    const r = raw as Record<string, unknown>;
    const choice = Array.isArray(r.choices)
        ? (r.choices[0] as Record<string, unknown> | undefined)
        : undefined;
    if (choice) {
        const m = choice.message as Record<string, unknown> | undefined;
        const d = choice.delta as Record<string, unknown> | undefined;
        const c = m?.content ?? d?.content ?? choice.text;
        if (typeof c === "string") return c;
    }
    const content = r.content;
    if (Array.isArray(content)) {
        const t = content
            .map((c) => (typeof c === "string" ? c : ((c as Record<string, unknown>).text as string) ?? ""))
            .join("");
        if (t) return t;
    }
    if (typeof content === "string") return content;
    if (typeof r.output_text === "string") return r.output_text;
    if (Array.isArray(r.output)) {
        const t = r.output
            .map((o) => {
                const oo = o as Record<string, unknown>;
                return (
                    (Array.isArray(oo.content)
                        ? oo.content.map((c) => (c as Record<string, unknown>).text ?? "").join("")
                        : "") || ""
                );
            })
            .join("");
        if (t) return t;
    }
    return null;
}

/* ------------------------------------------------------------------ */
/* The single call used by the chat                                     */
/* ------------------------------------------------------------------ */

export interface CallResult {
    turn: Turn;
    requestUrl: string;
}

async function postChatCompletion(
    settings: ConnectionSettings,
    questions: Question[],
    state: string,
    history: Turn[],
    url: string,
): Promise<CallResult> {
    const body = buildChatBody(settings, questions, state, history);
    const { json, ms } = await request(
        url,
        {
            method: "POST",
            headers: authHeaders(settings),
            body: JSON.stringify(body),
        },
        { logRequest: true, requestBody: body },
    );
    return {
        requestUrl: url,
        turn: {
            id: "",
            role: "assistant",
            createdAt: Date.now(),
            text: pickText(json) ?? "(empty response)",
            answers: normalizeAnswers(json, questions),
            endpoint: url,
            rawRequest: body,
            rawResponse: json,
            model: body.model,
            durationMs: ms,
            status: "ok",
        },
    };
}

export async function runDecision(
    settings: ConnectionSettings,
    qs: Question[],
    state: string,
    history: Turn[],
): Promise<CallResult> {
    // A turn with only free-text questions can never be answered by the typed
    // Decision API, so it always travels down the chat-completions route.
    const dialect: Dialect = qs.some((q) => q.type !== "text")
        ? settings.dialect
        : "chat";
    const url = prettyEndpoint(settings.baseUrl, dialect);

    if (dialect === "systemone") {
        const body = buildSystemOneBody(settings, qs, state, history);
        const { json, ms } = await request(
            url,
            {
                method: "POST",
                headers: authHeaders(settings),
                body: JSON.stringify(body),
            },
            { logRequest: true, requestBody: body },
        );
        return {
            requestUrl: url,
            turn: {
                id: "",
                role: "assistant",
                createdAt: Date.now(),
                answers: normalizeAnswers(json, qs),
                rawRequest: body,
                rawResponse: json,
                endpoint: url,
                model: body.model,
                durationMs: ms,
                status: "ok",
            },
        };
    }

    return postChatCompletion(settings, qs, state, history, url);
}

export async function runChat(
    settings: ConnectionSettings,
    message: string,
    history: Turn[],
): Promise<CallResult> {
    const url = prettyEndpoint(settings.baseUrl, settings.dialect);
    return postChatCompletion(settings, [], message, history, url);
}

/* ------------------------------------------------------------------ */
/* Demo mode — deterministic offline simulation of the Decision API      */
/* ------------------------------------------------------------------ */

function hash(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
}

function hashNum(n: number): number {
    let h = Math.imul(n ^ 0x9e3779b9, 2654435761);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return Math.abs(h ^ (h >>> 16));
}

export function runDemo(settings: ConnectionSettings, qs: Question[], state: string): CallResult {
    const seed = hash(state + "::" + qs.map((q) => q.name + q.instructions).join("|"));
    const answers: NormalizedAnswer[] = qs
        .filter((q) => q.type !== "text")
        .map((q, i) => {
            const s = hashNum(seed + i * 7919);
            if (q.type === "noul") {
                const p = 0.08 + ((s % 849) / 1000);
                return {
                    name: slug(q.name, "noul"),
                    type: "noul" as QType,
                    instructions: q.instructions,
                    labels: {},
                    noulProb: p,
                    chosenKey: null,
                    probs: [],
                    score: null,
                    scoreProbs: [],
                    confidence: p,
                    raw: { demo: true },
                };
            }
            if (q.type === "score") {
                const probs = q.levels.map((_, k) => 0.5 - Math.abs(k - (s % q.levels.length || 1)) * 0.22);
                const sum = probs.reduce((a, b) => a + Math.max(0.05, b), 0);
                const norm = probs.map((p) => Math.max(0.05, p) / sum);
                const best = norm.indexOf(Math.max(...norm));
                return {
                    name: slug(q.name, "score"),
                    type: "score" as QType,
                    instructions: q.instructions,
                    labels: Object.fromEntries(q.levels.map((l, k) => [String(k), l])),
                    noulProb: null,
                    chosenKey: null,
                    probs: [],
                    score: best,
                    scoreProbs: q.levels.map((l, k) => ({ level: l, p: norm[k] })),
                    confidence: norm[best],
                    raw: { demo: true },
                };
            }
            const n = Math.max(1, q.options.length);
            const raw = q.options.map((_, k) => 0.5 + ((s >> (k * 3)) % 100) / 130 - k * 0.07);
            const sum = raw.reduce((a, b) => a + Math.max(0.05, b), 0);
            const norm = raw.map((p) => Math.max(0.05, p) / sum);
            const best = norm.indexOf(Math.max(...norm));
            return {
                name: slug(q.name, "choice"),
                type: "choice" as QType,
                instructions: q.instructions,
                labels: Object.fromEntries(
                    q.options.map((o) => [slug(o.key, "option"), o.label || o.key]),
                ),
                noulProb: null,
                chosenKey: slug(q.options[best]?.key ?? "option", "option"),
                probs: norm.map((p, k) => ({ key: slug(q.options[k].key, "option"), p })),
                score: null,
                scoreProbs: [],
                confidence: norm[best],
                raw: { demo: true, n },
            };
        });

    const body = buildSystemOneBody(settings, qs, state, []);
    return {
        requestUrl: prettyEndpoint(settings.baseUrl, "systemone"),
        turn: {
            id: "",
            role: "assistant",
            createdAt: Date.now(),
            answers,
            rawRequest: body,
            rawResponse: {
                model: body.model,
                answers: Object.fromEntries(answers.map((a) => [a.name, a.raw])),
                _note: "Simulated locally — no network request was made.",
            },
            endpoint: prettyEndpoint(settings.baseUrl, "systemone"),
            model: body.model,
            durationMs: 40 + (seed % 300),
            status: "ok",
            demo: true,
        },
    };
}

const CHAT_DEMO_REPLY =
    "This is a simulated reply, so no request was sent. To talk to a real model, open Connections, " +
    "enter a base URL (and an API key if the server needs one), then run Test connection. " +
    "A successful test turns demo mode off.";

export function runChatDemo(settings: ConnectionSettings, message: string): CallResult {
    const endpoint = prettyEndpoint(settings.baseUrl, settings.dialect);
    const body = buildChatBody(settings, [], message, []);
    return {
        requestUrl: endpoint,
        turn: {
            id: "",
            role: "assistant",
            createdAt: Date.now(),
            text: CHAT_DEMO_REPLY,
            answers: [],
            rawRequest: body,
            rawResponse: {
                model: body.model,
                text: CHAT_DEMO_REPLY,
                _note: "Simulated locally — no network request was made.",
            },
            endpoint,
            model: body.model,
            durationMs: 40 + (hash(message) % 300),
            status: "ok",
            demo: true,
        },
    };
}
