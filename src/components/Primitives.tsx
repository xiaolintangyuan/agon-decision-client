import { useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { useDialogBehavior } from "../lib/useDialogBehavior";
import { dangerButtonClassName, secondaryButtonClassName } from "../lib/dialogStyles";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-[11px] font-medium text-mute-300 transition hover:border-ink-600 hover:text-mute-100"
    >
      {done ? <Check size={12} className="text-jade-500" /> : <Copy size={12} />}
      {done ? "Copied" : label}
    </button>
  );
}

export function Label({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <span className="label-xs text-mute-500">{children}</span>
      {right}
    </div>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-ink-700 bg-ink-850/70 backdrop-blur-[2px] ${className}`}
    >
      {children}
    </div>
  );
}

export function Bar({
  p,
  tone = "brass",
  height = "h-1.5",
}: {
  p: number;
  tone?: "brass" | "jade" | "azure" | "coral" | "violet";
  height?: string;
}) {
  const tones: Record<string, string> = {
    brass: "bg-brass-500",
    jade: "bg-jade-500",
    azure: "bg-azure-500",
    coral: "bg-coral-500",
    violet: "bg-violet-500",
  };
  return (
    <div className={`w-full overflow-hidden rounded-full bg-ink-700 ${height}`}>
      <div
        className={`h-full rounded-full ${tones[tone]} transition-[width] duration-500 ease-out`}
        style={{ width: `${Math.min(100, Math.max(0, p * 100))}%` }}
      />
    </div>
  );
}

export function JsonBlock({
  value,
  maxHeight = 240,
}: {
  value: unknown;
  maxHeight?: number;
}) {
  let text: string;
  try {
    text = JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    text = String(value);
  }
  return (
    <div className="relative">
      <pre
        className="overflow-auto rounded-lg border border-ink-700 bg-ink-950/70 p-3 font-mono text-[11px] leading-relaxed text-mute-300"
        style={{ maxHeight }}
      >
        {text}
      </pre>
      <div className="absolute right-2 top-2">
        <CopyButton text={text} />
      </div>
    </div>
  );
}

export function Chip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "brass" | "jade" | "coral" | "azure" | "violet";
}) {
  const tones: Record<string, string> = {
    neutral: "border-ink-600 bg-ink-800 text-mute-300",
    brass: "border-brass-700/60 bg-brass-700/15 text-brass-400",
    jade: "border-jade-500/40 bg-jade-500/10 text-jade-400",
    coral: "border-coral-500/40 bg-coral-500/10 text-coral-400",
    azure: "border-azure-500/40 bg-azure-500/10 text-azure-400",
    violet: "border-violet-500/40 bg-violet-500/10 text-violet-500",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

interface ModalShellProps {
    onClose: () => void;
    maxWidthClassName: string;
    labelledBy?: string;
    label?: string;
    children: ReactNode;
}

/** Backdrop and panel for a dialog. Mount it inside AnimatePresence so that it fades and scales out. */
export function ModalShell({ onClose, maxWidthClassName, labelledBy, label, children }: ModalShellProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    useDialogBehavior(panelRef, onClose);

    return (
        <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <motion.div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledBy}
                aria-label={label}
                tabIndex={-1}
                initial={{ opacity: 0, scale: 0.97, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className={`flex max-h-[90vh] w-full flex-col rounded-xl border border-ink-700 bg-ink-850 shadow-2xl shadow-black/60 outline-none ${maxWidthClassName}`}
            >
                {children}
            </motion.div>
        </motion.div>
    );
}

interface ConfirmStyle {
    container: string;
    confirm: string;
    cancel: string;
}

const CONFIRM_STYLES: Record<"text" | "button", ConfirmStyle> = {
    text: {
        container: "flex items-center gap-2 text-[11px]",
        confirm: "font-medium text-coral-400 hover:text-coral-500",
        cancel: "text-mute-400 transition hover:text-mute-100",
    },
    button: {
        container: "flex items-center gap-2",
        confirm: dangerButtonClassName,
        cancel: secondaryButtonClassName,
    },
};

interface ConfirmButtonProps {
    label: string;
    confirmLabel: string;
    triggerClassName: string;
    onConfirm: () => void;
    disabled?: boolean;
    /** "button" gives the confirm step the size of the dialog buttons around it. */
    variant?: "text" | "button";
}

/** A destructive action that asks "confirm or cancel" in place before it runs. */
export function ConfirmButton({
    label,
    confirmLabel,
    triggerClassName,
    onConfirm,
    disabled,
    variant = "text",
}: ConfirmButtonProps) {
    const [isConfirming, setIsConfirming] = useState(false);
    const style = CONFIRM_STYLES[variant];

    if (!isConfirming) {
        return (
            <button
                type="button"
                onClick={() => setIsConfirming(true)}
                disabled={disabled}
                className={triggerClassName}
            >
                {label}
            </button>
        );
    }
    return (
        <span className={style.container}>
            <button
                type="button"
                onClick={() => {
                    setIsConfirming(false);
                    onConfirm();
                }}
                className={style.confirm}
            >
                {confirmLabel}
            </button>
            <button type="button" onClick={() => setIsConfirming(false)} className={style.cancel}>
                Cancel
            </button>
        </span>
    );
}

export function EmptyNote({ children }: { children: ReactNode }) {
    return <p className="text-[11px] text-mute-500">{children}</p>;
}

interface SelectCellProps {
    label: string;
    isChecked: boolean;
    onToggle: () => void;
}

/** The checkbox cell of a table row. Clicks stop here so that they do not reach a clickable row. */
export function SelectCell({ label, isChecked, onToggle }: SelectCellProps) {
    return (
        <td className="w-9 px-2.5 py-2" onClick={(event) => event.stopPropagation()}>
            <input
                type="checkbox"
                checked={isChecked}
                onChange={onToggle}
                aria-label={label}
                className="h-3.5 w-3.5 accent-[#e0a63c]"
            />
        </td>
    );
}
