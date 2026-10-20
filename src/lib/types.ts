export type Dialect = "systemone" | "chat";

/** SystemOne drives the typed decision composer; the chat-style dialects drive a plain chat. */
export type InterfaceMode = "decision" | "chat";

export type QType = "noul" | "choice" | "score" | "text";

export interface ChoiceOption {
  id: string;
  key: string;
  label: string;
}

export interface Question {
  id: string;
  name: string;
  type: QType;
  instructions: string;
  options: ChoiceOption[];
  levels: string[];
}

export interface Turn {
  id: string;
  role: "user" | "assistant";
  createdAt: number;
  /* user turn */
  questions?: Question[];
  state?: string;
  /* assistant turn */
  answers?: NormalizedAnswer[];
  text?: string;
  rawRequest?: unknown;
  rawResponse?: unknown;
  endpoint?: string;
  model?: string;
  durationMs?: number;
  status?: "ok" | "error" | "pending";
  error?: string;
  demo?: boolean;
}

export interface NormalizedAnswer {
  name: string;
  type: QType;
  instructions: string;
  /** question key -> human label, so bars can show the option description */
  labels: Record<string, string>;
  /* noul */
  noulProb: number | null;
  /* choice */
  chosenKey: string | null;
  probs: { key: string; p: number }[];
  /* score */
  score: number | null;
  scoreProbs: { level: string; p: number }[];
  confidence: number | null;
  raw: unknown;
}

export interface ConnectionSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  dialect: Dialect;
  temperature: number;
  maxTokens: number;
  topP: number;
  includeHistory: boolean;
  extraHeaders: string;
}

/** A connection remembered in localStorage. `baseUrl` is normalized and unique across the list. */
export interface SavedConnection {
    baseUrl: string;
    apiKey: string;
    savedAt: number;
}

export interface LogEntry {
  id: string;
  at: number;
  method: string;
  url: string;
  status: number | "network";
  ms: number;
  ok: boolean;
}

export type ConnState = "unknown" | "testing" | "ok" | "error";