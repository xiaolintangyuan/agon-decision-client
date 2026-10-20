import { useState } from "react";
import {
  ChevronDown,
  CircleDot,
  Hash,
  ListChecks,
  Plus,
  Send,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { ChoiceOption, QType, Question } from "../lib/types";
import { slug } from "../lib/api";

export const uid = () => Math.random().toString(36).slice(2, 10);

export function newQuestion(type: QType = "noul", name = "", instructions = ""): Question {
  return {
    id: uid(),
    name,
    type,
    instructions,
    options:
      type === "choice"
        ? [
            { id: uid(), key: "", label: "" },
            { id: uid(), key: "", label: "" },
            { id: uid(), key: "", label: "" },
          ]
        : [],
    levels:
      type === "score"
        ? ["low", "medium", "high"]
        : [],
  };
}

const TYPES: { v: QType; label: string; icon: typeof CircleDot; hint: string }[] = [
  { v: "noul", label: "Noul", icon: CircleDot, hint: "Yes / no with a calibrated probability" },
  { v: "choice", label: "Choice", icon: ListChecks, hint: "Pick one option from criteria" },
  { v: "score", label: "Score", icon: Hash, hint: "Ordered levels, 0-based index" },
  { v: "text", label: "Text", icon: Sparkles, hint: "Free-text chat completion" },
];

const inputCls =
  "w-full rounded-lg border border-ink-700 bg-ink-950/70 px-2.5 py-1.5 font-mono text-[12px] text-mute-100 outline-none transition placeholder:text-mute-600 focus:border-brass-600 focus:ring-1 focus:ring-brass-600/30";

function OptionEditor({
  q,
  onChange,
}: {
  q: Question;
  onChange: (q: Question) => void;
}) {
  const setOpt = (id: string, patch: Partial<ChoiceOption>) =>
    onChange({
      ...q,
      options: q.options.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    });
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="label-xs text-mute-600">Criteria</span>
        <button
          onClick={() => onChange({ ...q, options: [...q.options, { id: uid(), key: "", label: "" }] })}
          className="inline-flex items-center gap-1 text-[10px] text-mute-400 transition hover:text-brass-400"
        >
          <Plus size={11} /> option
        </button>
      </div>
      {q.options.map((o, i) => (
        <div key={o.id} className="flex items-center gap-1.5">
          <span className="w-4 shrink-0 text-center font-mono text-[10px] text-mute-600">
            {i}
          </span>
          <input
            className={`${inputCls} w-[38%]`}
            placeholder="key"
            value={o.key}
            onChange={(e) => setOpt(o.id, { key: e.target.value })}
            spellCheck={false}
          />
          <input
            className={inputCls}
            placeholder="description the model matches against"
            value={o.label}
            onChange={(e) => setOpt(o.id, { label: e.target.value })}
            spellCheck={false}
          />
          <button
            onClick={() => onChange({ ...q, options: q.options.filter((x) => x.id !== o.id) })}
            className="shrink-0 rounded-md p-1 text-mute-600 transition hover:text-coral-400"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

function LevelEditor({ q, onChange }: { q: Question; onChange: (q: Question) => void }) {
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="label-xs text-mute-600">Ordered levels (index = position)</span>
        <button
          onClick={() => onChange({ ...q, levels: [...q.levels, ""] })}
          className="inline-flex items-center gap-1 text-[10px] text-mute-400 transition hover:text-brass-400"
        >
          <Plus size={11} /> level
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {q.levels.map((l, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="font-mono text-[10px] text-mute-600">{i}</span>
            <input
              className={`${inputCls} w-32`}
              value={l}
              placeholder={`level ${i}`}
              onChange={(e) =>
                onChange({
                  ...q,
                  levels: q.levels.map((x, k) => (k === i ? e.target.value : x)),
                })
              }
              spellCheck={false}
            />
            <button
              onClick={() => onChange({ ...q, levels: q.levels.filter((_, k) => k !== i) })}
              className="rounded-md p-1 text-mute-600 transition hover:text-coral-400"
            >
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function QuestionCard({
  q,
  index,
  onChange,
  onRemove,
  expandable,
}: {
  q: Question;
  index: number;
  onChange: (q: Question) => void;
  onRemove: () => void;
  expandable: boolean;
}) {
  const [open, setOpen] = useState(index === 0);
  const meta = TYPES.find((t) => t.v === q.type)!;
  const Icon = meta.icon;

  return (
    <div className="rounded-xl border border-ink-750 bg-ink-850/60">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-ink-750 font-mono text-[10px] text-mute-400">
          {index + 1}
        </span>
        <Icon size={13} className="shrink-0 text-brass-500" />
        <input
          className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-mute-100 outline-none placeholder:text-mute-600"
          placeholder={q.type === "text" ? "free-text (no key needed)" : "question_key"}
          value={q.name}
          onChange={(e) => onChange({ ...q, name: e.target.value })}
          spellCheck={false}
        />
        <span className="hidden shrink-0 rounded border border-ink-600 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-mute-500 sm:inline">
          {meta.label}
        </span>
        {expandable && (
          <button
            onClick={onRemove}
            className="shrink-0 rounded-md p-1 text-mute-600 transition hover:text-coral-400"
          >
            <Trash2 size={12} />
          </button>
        )}
        <button
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded-md p-1 text-mute-500 transition hover:text-mute-100"
        >
          <ChevronDown
            size={14}
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {open && (
        <div className="border-t border-ink-750 px-3 pb-3 pt-2.5">
          <input
            className={inputCls}
            placeholder={meta.hint}
            value={q.instructions}
            onChange={(e) => onChange({ ...q, instructions: e.target.value })}
            spellCheck={false}
          />
          {q.type === "choice" && <OptionEditor q={q} onChange={onChange} />}
          {q.type === "score" && <LevelEditor q={q} onChange={onChange} />}
        </div>
      )}
    </div>
  );
}

export default function Composer({
  questions,
  setQuestions,
  state,
  setState,
  onSend,
  busy,
  canSend,
}: {
  questions: Question[];
  setQuestions: (q: Question[]) => void;
  state: string;
  setState: (s: string) => void;
  onSend: () => void;
  busy: boolean;
  canSend: boolean;
}) {
  const active = questions[0];
  const meta = TYPES.find((t) => t.v === active.type)!;

  const switchType = (t: QType) => {
    setQuestions(
      questions.map((q, i) =>
        i === 0
          ? {
              ...newQuestion(t, q.name, q.instructions),
              options:
                t === "choice" && q.options.length
                  ? q.options
                  : newQuestion(t).options,
              levels: t === "score" && q.levels.length ? q.levels : newQuestion(t).levels,
            }
          : q,
      ),
    );
  };

  const preview = buildPreview(questions, state);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto border-t border-ink-700 bg-ink-900/85 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-4xl px-4 py-3">
        {/* response type selector */}
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <SlidersHorizontal size={12} className="mr-0.5 text-mute-600" />
          {TYPES.map((t) => (
            <button
              key={t.v}
              onClick={() => switchType(t.v)}
              title={t.hint}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                active.type === t.v
                  ? "border-brass-600 bg-brass-700/20 text-brass-400"
                  : "border-ink-700 bg-ink-850 text-mute-400 hover:border-ink-600 hover:text-mute-100"
              }`}
            >
              {t.label}
            </button>
          ))}
          <span className="ml-auto hidden font-mono text-[10px] text-mute-600 sm:block">
            {meta.hint}
          </span>
        </div>

        {/* question stack */}
        <div className="space-y-2">
          {questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              q={q}
              index={i}
              expandable={questions.length > 1}
              onRemove={() => setQuestions(questions.filter((x) => x.id !== q.id))}
              onChange={(nq) => setQuestions(questions.map((x) => (x.id === q.id ? nq : x)))}
            />
          ))}
        </div>

        {questions.length < 6 && (
          <button
            onClick={() => setQuestions([...questions, newQuestion("noul")])}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-ink-600 px-2.5 py-1.5 text-[11px] text-mute-400 transition hover:border-brass-700 hover:text-brass-400"
          >
            <Plus size={12} /> add another question to this turn
          </button>
        )}

        {/* state / context */}
        <div className="mt-2.5">
          <textarea
            className="w-full resize-y rounded-xl border border-ink-700 bg-ink-950/70 px-3 py-2.5 text-[13px] leading-relaxed text-mute-100 outline-none transition placeholder:text-mute-600 focus:border-brass-600 focus:ring-1 focus:ring-brass-600/30"
            rows={3}
            placeholder="State — the input being decided about. E.g. “Charged twice for invoice #4411, please refund today.”"
            value={state}
            onChange={(e) => setState(e.target.value)}
          />
        </div>

        {/* send bar */}
        <div className="mt-2 flex items-center gap-3">
          <pre className="min-w-0 flex-1 truncate font-mono text-[10px] text-mute-600">
            {preview}
          </pre>
          <span className="hidden shrink-0 font-mono text-[10px] text-mute-600 sm:block">
            ⌘↵
          </span>
          <button
            disabled={!canSend || busy}
            onClick={onSend}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-brass-600 px-4 py-2 text-[12px] font-semibold text-ink-950 transition hover:bg-brass-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={13} />
            {busy ? "Deciding…" : "Decide"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function buildPreview(questions: Question[], state: string) {
  const typed = questions.filter((q) => q.type !== "text");
  if (!typed.length) return `→ ${questions[0]?.instructions || state || "…"}`;
  return typed
    .map((q) => {
      if (q.type === "choice")
        return `${slug(q.name, "q")} ∈ {${q.options.map((o) => o.key).filter(Boolean).join(", ")}}`;
      if (q.type === "score") return `${slug(q.name, "q")} ∈ 0..${Math.max(0, q.levels.length - 1)}`;
      return `${slug(q.name, "q")} ∈ {true,false}`;
    })
    .join("   ");
}