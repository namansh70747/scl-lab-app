import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastMsg {
  id: number;
  kind: "success" | "error";
  text: string;
}

export function ToastStack({ toasts, dismiss }: { toasts: ToastMsg[]; dismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} dismiss={dismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, dismiss }: { toast: ToastMsg; dismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), 3500);
    return () => clearTimeout(timer);
  }, [toast.id, dismiss]);

  return (
    <div
      role="status"
      className="flex items-center gap-2.5 bg-[#14151c] text-white text-[13px] rounded-xl px-4 py-3 shadow-[var(--shadow-pop)] animate-fade-up max-w-sm"
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          toast.kind === "error" ? "bg-[#f87171]" : "bg-[#4ade80]"
        )}
      />
      <span className="flex-1 leading-snug">{toast.text}</span>
      <button
        onClick={() => dismiss(toast.id)}
        aria-label="Dismiss"
        className="shrink-0 text-white/40 hover:text-white/80 transition-colors"
      >
        <X size={13} strokeWidth={2.2} />
      </button>
    </div>
  );
}

/** Manages a stack of transient toasts. */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((kind: ToastMsg["kind"], text: string) => {
    setToasts((prev) => [...prev, { id: Date.now() + Math.random(), kind, text }]);
  }, []);

  const success = useCallback((text: string) => push("success", text), [push]);
  const error = useCallback((text: string) => push("error", text), [push]);

  return { toasts, dismiss, success, error };
}
