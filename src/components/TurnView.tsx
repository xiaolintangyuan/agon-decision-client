import { useState } from "react";
import {
  Braces,
  ChevronDown,
  Clock,
  Cpu,
  Gauge,
  Info,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type { NormalizedAnswer, Question, Turn } from "../lib/types";
import { slug } from "../lib/api";
import { AssistantMessage } from "./AssistantMessage";
import { Bar, Chip, JsonBlock } from "./Primitives";
import { pct } from "../lib/format";
import TurnActions from "./TurnActions";

function toneFor(p: number | null): "jade" | "brass" | "coral" {
  if (p === null) return "brass";
  if (p >= 0.75) return "jade";
  if (p >= 0.45) return "brass";
  return "coral";
}

function NoulCard({ a }: { a: NormalizedAnswer }) {
  const p = a.noulProb;
  const yes = (p ?? 0) >= 0.5;
  return (
    <div className="rounded-xl border border-ink-750 bg-ink-850/60 p-3.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] font-medium text-mute-100">
              {a.name || "noul"}
            </span>
            <Chip tone="azure">noul</Chip>
          </div>
          {a.instructions && (
            <p className="mt-1 text-[12px] leading-snug text-mute-400">{a.instructions}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div
            className={`font-mono text-2xl font-semibold tabular-nums ${
              p === null
                ? "text-mute-500"
                : yes
                  ? "text-jade-400"
                  : "text-coral-400"
            }`}
          >
            {pct(p)}
          </div>
          <div className="label-xs mt-0.5 text-mute-600">P(yes)</div>
        </div>
      </div>

      <div className="relative h-2 w-full overflow-hidden rounded-full bg-ink-750">
        <div className="absolute inset-y-0 left-0 right-1/2 bg-ink-700" />
        <div
          className={`absolute inset-y-0 left-1/2 transition-[width] duration-700 ease-out ${
            p === null ? "bg-ink-600" : yes ? "bg-jade-500" : "bg-coral-500"
          }`}
          style={{ width: `${Math.min(50, Math.max(0, (p ?? 0) * 50))}%` }}
        />
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-ink-500" />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-mute-600">
        <span>false</span>
        <span className="text-mute-400">
          verdict: {p === null ? "—" : yes ? "true" : "false"}
        </span>
        <span>true</span>
      </div>
    </div>
  );
}

function ChoiceCard({ a }: { a: NormalizedAnswer }) {
  const sorted = [...a.probs].sort((x, y) => y.p - x.p);
  return (
    <div className="rounded-xl border border-ink-750 bg-ink-850/60 p-3.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] font-medium text-mute-100">
              {a.name || "choice"}
            </span>
            <Chip tone="brass">choice</Chip>
          </div>
          {a.instructions && (
            <p className="mt-1 text-[12px] leading-snug text-mute-400">{a.instructions}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-2xl font-semibold tabular-nums text-brass-400">
            {pct(a.confidence, 0)}
          </div>
          <div className="label-xs mt-0.5 text-mute-600">confidence</div>
        </div>
      </div>

      <div className="space-y-2">
        {sorted.map((row) => {
          const chosen = a.chosenKey && row.key === slug(a.chosenKey, "x");
          return (
            <div key={row.key} className="group">
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={`font-mono text-[11px] ${
                    chosen ? "font-semibold text-brass-400" : "text-mute-400"
                  }`}
                >
                  {a.labels[row.key] ?? row.key}
                </span>
                {chosen && <Chip tone="brass">selected</Chip>}
                <span className="ml-auto font-mono text-[11px] tabular-nums text-mute-300">
                  {pct(row.p)}
                </span>
              </div>
              <Bar p={row.p} tone={chosen ? "brass" : "azure"} />
            </div>
          );
        })}
        {!sorted.length && (
          <p className="font-mono text-[11px] text-mute-500">
            Server returned no per-option distribution.
          </p>
        )}
      </div>
    </div>
  );
}

function ScoreCard({ a }: { a: NormalizedAnswer }) {
  const idx = a.score === null ? 0 : Math.round(a.score);
  return (
    <div className="rounded-xl border border-ink-750 bg-ink-850/60 p-3.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] font-medium text-mute-100">
              {a.name || "score"}
            </span>
            <Chip tone="violet">score</Chip>
          </div>
          {a.instructions && (
            <p className="mt-1 text-[12px] leading-snug text-mute-400">{a.instructions}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-2xl font-semibold tabular-nums text-violet-500">
            {a.score === null ? "—" : Number(a.score).toFixed(2)}
          </div>
          <div className="label-xs mt-0.5 text-mute-600">level</div>
        </div>
      </div>

      <div className="space-y-1.5">
        {a.scoreProbs.length ? (
          a.scoreProbs.map((lv, i) => {
            const chosen = i === idx;
            return (
              <div key={`${lv.level}-${i}`} className="flex items-center gap-2">
                <span className="w-4 shrink-0 text-center font-mono text-[10px] text-mute-600">
                  {i}
                </span>
                <span
                  className={`w-32 shrink-0 truncate text-[11px] ${
                    chosen ? "font-semibold text-violet-500" : "text-mute-400"
                  }`}
                >
                  {lv.level}
                </span>
                <div className="min-w-0 flex-1">
                  <Bar p={lv.p} tone={chosen ? "violet" : "azure"} height="h-1" />
                </div>
                <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-mute-300">
                  {pct(lv.p, 0)}
                </span>
              </div>
            );
          })
        ) : (
          <p className="font-mono text-[11px] text-mute-500">
            Server returned a level without a per-level distribution.
          </p>
        )}
      </div>
    </div>
  );
}

export function AnswerCard({ a }: { a: NormalizedAnswer }) {
  if (a.type === "noul") return <NoulCard a={a} />;
  if (a.type === "score") return <ScoreCard a={a} />;
  return <ChoiceCard a={a} />;
}

export function SummaryStrip({ turn }: { turn: Turn }) {
  const a = turn.answers ?? [];
  if (!a.length) return null;
  const avg = a.reduce((s, x) => s + (x.confidence ?? 0), 0) / a.length;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-750 bg-ink-900/60 px-3 py-2">
      <Gauge size={12} className="text-mute-500" />
      <span className="label-xs text-mute-500">Mean confidence</span>
      <span className="font-mono text-[12px] font-semibold text-mute-100">
        {pct(avg, 0)}
      </span>
      <div className="w-24">
        <Bar p={avg} tone={toneFor(avg)} height="h-1" />
      </div>
      <span className="label-xs ml-2 text-mute-600">{a.length} decision(s)</span>
    </div>
  );
}

interface UserTurnProps {
    turn: Turn;
    actionsDisabled: boolean;
    onReplay: () => void;
    onRewind: () => void;
}

export function UserTurn({ turn, actionsDisabled, onReplay, onRewind }: UserTurnProps) {
  const qs = turn.questions ?? [];
  return (
    <div className="flex justify-end">
      <div className="max-w-[92%] sm:max-w-[75%]">
        <div className="rounded-2xl rounded-br-md border border-ink-700 bg-ink-850 px-4 py-3">
          {!!turn.state && (
            <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-mute-100">
              {turn.state}
            </p>
          )}
          {!!qs.length && (
            <div className="mt-2.5 space-y-2 border-t border-ink-750 pt-2.5">
              {qs.map((q: Question, i) => (
                <div key={q.id} className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-[10px] text-mute-600">
                    Q{i + 1}
                  </span>
                  {q.name && (
                    <span className="font-mono text-[11px] text-brass-400">{slug(q.name, "")}</span>
                  )}
                  <Chip tone={q.type === "noul" ? "azure" : q.type === "score" ? "violet" : q.type === "text" ? "jade" : "brass"}>
                    {q.type}
                  </Chip>
                  {q.instructions && (
                    <span className="text-[12.5px] leading-snug text-mute-300">
                      {q.instructions}
                    </span>
                  )}
                  {q.type === "choice" && (
                    <span className="font-mono text-[10px] text-mute-500">
                      {q.options.map((o) => o.key).filter(Boolean).join(" | ")}
                    </span>
                  )}
                  {q.type === "score" && (
                    <span className="font-mono text-[10px] text-mute-500">
                      {q.levels.filter(Boolean).join(" | ")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mt-1 flex justify-end">
            <TurnActions mode="decision" disabled={actionsDisabled} onReplay={onReplay} onRewind={onRewind} />
        </div>
      </div>
    </div>
  );
}

export function ChatUserTurn({ turn, actionsDisabled, onReplay, onRewind }: UserTurnProps) {
    return (
        <div className="flex justify-end">
            <div className="max-w-[92%] sm:max-w-[75%]">
                <div className="rounded-2xl rounded-br-md border border-ink-700 bg-ink-850 px-4 py-3">
                    <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-mute-100">
                        {turn.state}
                    </p>
                </div>
                <div className="mt-1 flex justify-end">
                    <TurnActions mode="chat" disabled={actionsDisabled} onReplay={onReplay} onRewind={onRewind} />
                </div>
            </div>
        </div>
    );
}

export function AssistantTurn({ turn }: { turn: Turn }) {
  const [showRaw, setShowRaw] = useState(false);
  const hasRaw = turn.rawResponse !== undefined && turn.rawResponse !== null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Cpu size={12} className="text-brass-500" />
        <span className="font-mono text-[11px] text-mute-300">{turn.model ?? "model"}</span>
        <span className="font-mono text-[10px] text-mute-600">
          {turn.endpoint?.replace(/^https?:\/\//, "")}
        </span>
        {turn.durationMs !== undefined && (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-mute-600">
            <Clock size={10} />
            {turn.durationMs}ms
          </span>
        )}
        {turn.demo && <Chip tone="azure">demo · no request sent</Chip>}
      </div>

      {turn.status === "error" && (
        <div className="rounded-xl border border-coral-500/40 bg-coral-500/10 p-3.5">
          <div className="mb-1.5 flex items-center gap-2">
            <TriangleAlert size={14} className="text-coral-400" />
            <span className="text-[12px] font-semibold text-coral-400">Request failed</span>
          </div>
          <p className="text-[12.5px] leading-relaxed text-mute-300">{turn.error}</p>
          {turn.rawRequest !== undefined && (
            <div className="mt-3">
              <JsonBlock value={turn.rawRequest} maxHeight={180} />
            </div>
          )}
        </div>
      )}

      {!!turn.text && <AssistantMessage text={turn.text} />}

      {!!turn.answers?.length && (
        <div className="space-y-2.5">
          {turn.answers.map((a, i) => (
            <AnswerCard key={`${a.name}-${i}`} a={a} />
          ))}
        </div>
      )}

      {!turn.text && !turn.answers?.length && turn.status === "ok" && (
        <div className="flex items-start gap-2 rounded-xl border border-ink-750 bg-ink-850/60 px-3.5 py-3 text-[12.5px] text-mute-400">
          <Info size={14} className="mt-0.5 shrink-0 text-mute-600" />
          <span>
            The response did not match a known decision shape. Open the raw payload below to
            inspect what the gateway returned.
          </span>
        </div>
      )}

      <SummaryStrip turn={turn} />

      {hasRaw && (
        <div className="mt-2">
          <button
            onClick={() => setShowRaw((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[11px] text-mute-500 transition hover:text-mute-100"
          >
            <Braces size={12} />
            {showRaw ? "Hide" : "Show"} raw payload
            <ChevronDown
              size={12}
              className={`transition-transform ${showRaw ? "rotate-180" : ""}`}
            />
          </button>
          {showRaw && (
            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              <div>
                <div className="label-xs mb-1 text-mute-600">Request</div>
                <JsonBlock value={turn.rawRequest} />
              </div>
              <div>
                <div className="label-xs mb-1 text-mute-600">Response</div>
                <JsonBlock value={turn.rawResponse} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PendingTurn() {
  return (
    <div className="space-y-2.5">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="shimmer relative overflow-hidden rounded-xl border border-ink-750 bg-ink-850/60 p-3.5"
        >
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={12} className="text-brass-500" />
            <div className="h-2.5 w-24 rounded-full bg-ink-700" />
          </div>
          <div className="h-2 w-full rounded-full bg-ink-750" />
        </div>
      ))}
    </div>
  );
}