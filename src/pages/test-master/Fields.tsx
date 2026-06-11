import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  hint?: string;
}) {
  const required = label.trim().endsWith("*");
  const text = required ? label.trim().replace(/\s*\*$/, "") : label;
  return (
    <div>
      <label className="block text-[12.5px] font-medium text-[#5d5953] mb-1.5">
        {text}
        {required && <span className="text-maroon-600"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[11.5px] text-[#a8a29b] mt-1">{hint}</p>}
      {error && <p className="text-[11.5px] text-[#b91c1c] mt-1">{error}</p>}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  error,
  type = "text",
  numeric,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: boolean;
  type?: string;
  numeric?: boolean;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "field",
        numeric && "tabular-nums",
        error && "border-[#d27979] hover:border-[#c96a6a]"
      )}
    />
  );
}

export function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="field">
      {children}
    </select>
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="field resize-y leading-relaxed"
    />
  );
}
