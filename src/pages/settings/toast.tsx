import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export interface ToastMsg {
  id: number;
  kind: "success" | "error";
  text: string;
}

interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((kind: ToastMsg["kind"], text: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, kind, text }]);
  }, []);

  const api: ToastApi = {
    success: (text) => push("success", text),
    error: (text) => push("error", text),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 items-end">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} dismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
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
      onClick={() => dismiss(toast.id)}
      className="flex items-center gap-2.5 bg-[#14151c] text-white text-[13px] rounded-xl px-4 py-3 shadow-[var(--shadow-pop)] animate-fade-up max-w-sm cursor-pointer"
    >
      {toast.kind === "error" && <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] shrink-0" aria-hidden />}
      <span className="flex-1 whitespace-pre-wrap break-words">{toast.text}</span>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

/** Turn any thrown value into a human-readable string for a toast. */
export function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Something went wrong.";
}
