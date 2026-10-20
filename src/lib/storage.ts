import type { ConnectionSettings, LogEntry, Turn } from "./types";

const KEY = "decision-console.v1";

export interface Persisted {
  settings: ConnectionSettings;
  history: Turn[];
  logs: LogEntry[];
    composerHeight: number | null;
}

export function load(): Partial<Persisted> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<Persisted>;
  } catch {
    return {};
  }
}

export function save(data: Partial<Persisted>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* quota / private mode — non fatal */
  }
}

export function clearAll() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}