import { useEffect, ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

function useEsc(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      aria-label="Close"
      className="w-7 h-7 shrink-0 inline-flex items-center justify-center rounded-lg text-[#8a8b97] hover:bg-[#eef0f4] hover:text-[#14151c] transition-colors"
    >
      <X size={16} strokeWidth={1.8} />
    </button>
  );
}

/** Centered modal dialog with blurred backdrop. ESC + backdrop close. */
export function Modal({
  title,
  onClose,
  children,
  width = "max-w-lg",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  useEsc(onClose);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0e0f16]/40 backdrop-blur-[2px] animate-fade-in flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "bg-white rounded-2xl shadow-[var(--shadow-pop)] w-full flex flex-col max-h-[88vh] animate-scale-in",
          width
        )}
      >
        <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-4 border-b border-[#eef0f4] shrink-0">
          <h2 className="text-[15px] font-semibold text-[#14151c]">{title}</h2>
          <CloseButton onClose={onClose} />
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/** Right-side slide-over sheet. ESC + backdrop close. */
export function Sheet({
  title,
  chip,
  subtitle,
  onClose,
  children,
  header,
}: {
  title: string;
  chip?: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  header?: ReactNode;
}) {
  useEsc(onClose);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0e0f16]/40 backdrop-blur-[2px] animate-fade-in flex justify-end"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-white w-[420px] max-w-full h-full shadow-[var(--shadow-pop)] animate-fade-up flex flex-col"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3.5 border-b border-[#eef0f4] shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-[15px] font-semibold text-[#14151c] truncate">{title}</h2>
              {chip && (
                <span className="chip chip-gray font-mono text-[10.5px] shrink-0">{chip}</span>
              )}
            </div>
            {subtitle && <p className="text-[12px] text-[#8a8b97] mt-0.5 truncate">{subtitle}</p>}
          </div>
          <CloseButton onClose={onClose} />
        </div>
        {header}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/** Small confirm dialog (destructive flavor). */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEsc(onCancel);

  return (
    <div
      className="fixed inset-0 z-[55] bg-[#0e0f16]/40 backdrop-blur-[2px] animate-fade-in flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        className="bg-white rounded-2xl shadow-[var(--shadow-pop)] w-full max-w-sm p-6 animate-scale-in"
      >
        <h3 className="text-[15px] font-semibold text-[#14151c]">{title}</h3>
        <p className="text-[13.5px] text-[#54555f] mt-2 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel} className="btn btn-ghost">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="btn text-white bg-gradient-to-b from-[#d23b3b] via-[#c22a2a] to-[#b12222] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2.5px_rgba(177,34,34,0.45)] hover:from-[#d94747] hover:via-[#c93434] hover:to-[#ba2929]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
