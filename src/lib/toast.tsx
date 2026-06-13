import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

/**
 * Global, non-blocking toasts — a calmer replacement for window.alert(). Call imperatively
 * from anywhere: `toast.success("Saved")`, `toast.error(e)`, `toast.info("…")`.
 * Mount <ToastHost/> once at the app root.
 */
type Kind = "success" | "error" | "info";
interface ToastMsg { id: number; kind: Kind; text: string }

let nextId = 1;
let emit: ((t: ToastMsg) => void) | null = null;

function msgOf(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}

function push(kind: Kind, e: unknown) {
  const text = msgOf(e).replace(/^Error:\s*/, "");
  if (emit) emit({ id: nextId++, kind, text });
  else if (kind === "error") console.error(text);   // before mount / headless
}

export const toast = {
  success: (msg: string) => push("success", msg),
  error: (e: unknown) => push("error", e),
  info: (msg: string) => push("info", msg),
};

export function ToastHost() {
  const [items, setItems] = useState<ToastMsg[]>([]);

  useEffect(() => {
    emit = (t) => setItems(prev => [...prev, t]);
    return () => { emit = null; };
  }, []);

  const dismiss = (id: number) => setItems(prev => prev.filter(t => t.id !== id));

  return (
    <div className="fixed bottom-5 right-5 z-[120] flex flex-col gap-2.5 items-end pointer-events-none">
      {items.map(t => <Item key={t.id} t={t} onClose={() => dismiss(t.id)} />)}
    </div>
  );
}

function Item({ t, onClose }: { t: ToastMsg; onClose: () => void }) {
  useEffect(() => {
    const ms = t.kind === "error" ? 6000 : t.kind === "info" ? 5000 : 2800;
    const timer = setTimeout(onClose, ms);
    return () => clearTimeout(timer);
  }, [t.id]);   // eslint-disable-line react-hooks/exhaustive-deps

  const accent = t.kind === "success" ? "#16a34a" : t.kind === "error" ? "#dc2626" : "#4f46e5";
  const Icon = t.kind === "success" ? CheckCircle2 : t.kind === "error" ? AlertCircle : Info;

  return (
    <div
      role="status"
      onClick={onClose}
      className="pointer-events-auto group flex items-start gap-2.5 min-w-[220px] max-w-sm rounded-xl bg-[#14151c] text-white text-[13px] pl-3.5 pr-3 py-3 shadow-[var(--shadow-pop)] cursor-pointer animate-pop-in"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <Icon size={16} className="shrink-0 mt-px" style={{ color: accent }} />
      <span className="flex-1 whitespace-pre-wrap break-words leading-snug">{t.text}</span>
      <X size={14} className="shrink-0 mt-px text-white/40 group-hover:text-white/80 transition-colors" />
    </div>
  );
}
