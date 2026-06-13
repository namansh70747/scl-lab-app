import { useEffect, useRef, useState } from "react";

/**
 * In-app replacements for window.prompt()/window.confirm(), which silently return
 * null/false in the macOS WKWebView (Tauri) and break every feature that used them.
 * Promise-based: `const v = await promptDialog({...})`.
 */

type PromptCfg = {
  kind: "prompt";
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  password?: boolean;
  resolve: (v: string | null) => void;
};
type ConfirmCfg = {
  kind: "confirm";
  title: string;
  message?: string;
  confirmText?: string;
  danger?: boolean;
  resolve: (v: boolean) => void;
};
type Cfg = PromptCfg | ConfirmCfg;

let opener: ((cfg: Cfg) => void) | null = null;

export function promptDialog(opts: Omit<PromptCfg, "kind" | "resolve">): Promise<string | null> {
  return new Promise((resolve) => {
    if (!opener) { resolve(null); return; }
    opener({ kind: "prompt", ...opts, resolve });
  });
}

export function confirmDialog(opts: Omit<ConfirmCfg, "kind" | "resolve">): Promise<boolean> {
  return new Promise((resolve) => {
    if (!opener) { resolve(false); return; }
    opener({ kind: "confirm", ...opts, resolve });
  });
}

export function DialogHost() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    opener = (c) => {
      setValue(c.kind === "prompt" ? (c.defaultValue ?? "") : "");
      setCfg(c);
    };
    return () => { opener = null; };
  }, []);

  useEffect(() => {
    if (cfg?.kind === "prompt") setTimeout(() => inputRef.current?.focus(), 30);
  }, [cfg]);

  if (!cfg) return null;

  const close = (result: string | null | boolean) => {
    (cfg.resolve as (v: string | null | boolean) => void)(result);
    setCfg(null);
  };
  const onCancel = () => close(cfg.kind === "prompt" ? null : false);
  const onConfirm = () => close(cfg.kind === "prompt" ? value : true);

  return (
    <div
      className="fixed inset-0 z-[100] bg-[#1a1208]/40 backdrop-blur-[2px] animate-fade-in flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm p-6 animate-scale-in shadow-[var(--shadow-pop)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3 className="text-[16px] font-semibold text-[#1a1a1e]">{cfg.title}</h3>
        {cfg.message && <p className="text-[13px] text-[#5d5953] mt-1.5 leading-relaxed">{cfg.message}</p>}
        {cfg.kind === "prompt" && (
          <input
            ref={inputRef}
            type={cfg.password ? "password" : "text"}
            value={value}
            placeholder={cfg.placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onConfirm(); if (e.key === "Escape") onCancel(); }}
            className="field w-full mt-3"
          />
        )}
        <div className="flex gap-2.5 justify-end mt-5">
          <button onClick={onCancel} className="btn btn-secondary">Cancel</button>
          <button
            onClick={onConfirm}
            className={cfg.kind === "confirm" && cfg.danger ? "btn btn-primary !bg-[#b91c1c] hover:!bg-[#a31616]" : "btn btn-primary"}
          >
            {cfg.confirmText ?? (cfg.kind === "confirm" ? "Confirm" : "OK")}
          </button>
        </div>
      </div>
    </div>
  );
}
