import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Card container per design system — uses the global .card primitive. */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("card p-6 max-w-[640px]", className)}>{children}</div>;
}

export function TabHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-1">
      <h2 className="text-[15px] font-semibold text-[#14151c]">{title}</h2>
      {subtitle && <p className="text-[12.5px] text-[#8a8b97] mt-0.5">{subtitle}</p>}
    </div>
  );
}

/** Section label per design system, for grouping inside cards. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a8b97] mb-3">
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="block text-[12.5px] font-medium text-[#54555f] mb-1.5">{children}</span>;
}

function Hint({ children }: { children: ReactNode }) {
  return <span className="block text-[12px] text-[#a3a5b3] mt-1">{children}</span>;
}

export function TextField({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  placeholder,
  multiline,
  rows = 3,
  hint,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          rows={rows}
          placeholder={placeholder}
          disabled={disabled}
          className="field w-full resize-y"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          className="field w-full"
        />
      )}
      {hint && <Hint>{hint}</Hint>}
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  hint?: ReactNode;
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field w-full">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <Hint>{hint}</Hint>}
    </label>
  );
}

export function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn("btn btn-primary", className)}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  type = "button",
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn("btn btn-secondary", className)}
    >
      {children}
    </button>
  );
}

/** Quiet destructive action — red ghost button. */
export function DangerGhostButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "btn btn-ghost text-[#b91c1c] hover:bg-[#fbe5e5] hover:text-[#a31e1e]",
        className
      )}
    >
      {children}
    </button>
  );
}

/** Subtle informational note (replaces loud amber boxes). */
export function NoteBox({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warn" | "success" }) {
  return (
    <div
      className={cn(
        "rounded-xl px-4 py-3 text-[12px] leading-relaxed",
        tone === "warn" && "bg-[#fdf0d7]/60 text-[#92600a]",
        tone === "success" && "bg-[#def5e6]/60 text-[#14743a]",
        tone === "neutral" && "bg-[#f6f5f2] text-[#54555f]"
      )}
    >
      {children}
    </div>
  );
}
