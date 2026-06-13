import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { searchPatients } from "@/lib/queries/patients";
import {
  Search, UserPlus, Users, FlaskConical, Stethoscope,
  BarChart3, Settings, LayoutDashboard, CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PAGES = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "New Patient", to: "/new-patient", icon: UserPlus },
  { label: "Patients", to: "/patients", icon: Users },
  { label: "Test Master", to: "/test-master", icon: FlaskConical },
  { label: "Doctors", to: "/doctors", icon: Stethoscope },
  { label: "Reports", to: "/reports", icon: BarChart3 },
  { label: "Settings", to: "/settings", icon: Settings },
];

const STATUS_CHIP: Record<string, string> = {
  registered: "chip-gray",
  results_pending: "chip-amber",
  approved: "chip-green",
  delivered: "chip-blue",
};

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setQ(""); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);

  const { data: patients = [], isFetching } = useQuery({
    queryKey: ["palette-search", q],
    queryFn: () => searchPatients(q.trim(), 8),
    enabled: open && q.trim().length >= 1,
  });

  const ql = q.toLowerCase();
  const pages = PAGES.filter(p => !q || p.label.toLowerCase().includes(ql));

  function go(to: string) { onClose(); navigate(to); }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1a1208]/45 backdrop-blur-[2px] animate-fade-in flex items-start justify-center pt-[14vh]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-[560px] mx-4 overflow-hidden animate-scale-in"
        style={{ boxShadow: "var(--shadow-pop)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4.5 px-5 border-b border-[#f1efec]">
          <Search size={17} className="text-[#a8a29b] shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search patients by name, receipt no. or phone — or jump to a screen…"
            className="flex-1 py-4 text-[14px] outline-none placeholder:text-[#b5afa7] bg-transparent"
            onKeyDown={e => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter") {
                // Don't act on results that are still loading for the current query.
                if (q.trim() && isFetching) return;
                const first = patients[0];
                if (first) go(first.status === "approved" ? `/report/${first.id}` : `/result-entry/${first.id}`);
                else if (pages[0]) go(pages[0].to);
              }
            }}
          />
          <kbd className="text-[10px] font-semibold text-[#8a857d] bg-[#f1efec] rounded-md px-1.5 py-1">esc</kbd>
        </div>

        <div className="max-h-[340px] overflow-y-auto py-2">
          {patients.length > 0 && (
            <Section title="Patients">
              {patients.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => go(p.status === "approved" ? `/report/${p.id}` : `/result-entry/${p.id}`)}
                  className={cn(
                    "w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-[#faf6f4]",
                    i === 0 && "bg-[#faf6f4]"
                  )}
                >
                  <span className="font-mono text-[11px] text-[#a8a29b] w-12 shrink-0">#{p.test_no}</span>
                  <span className="text-[13.5px] font-medium text-[#1a1a1e] truncate">{p.title} {p.name}</span>
                  <span className="text-[12px] text-[#a8a29b]">{p.age} {p.age_unit}</span>
                  <span className={cn("chip ml-auto", STATUS_CHIP[p.status ?? "registered"])}>
                    {(p.status ?? "registered").replace("_", " ")}
                  </span>
                  {i === 0 && <CornerDownLeft size={13} className="text-[#c9c4bc]" />}
                </button>
              ))}
            </Section>
          )}

          {pages.length > 0 && (
            <Section title="Go to">
              {pages.map(p => (
                <button
                  key={p.to}
                  onClick={() => go(p.to)}
                  className="w-full flex items-center gap-3 px-5 py-2.5 text-left text-[13.5px] text-[#3c3a36] transition-colors hover:bg-[#faf6f4]"
                >
                  <span className="w-7 h-7 rounded-lg bg-[#f1efec] text-[#8a857d] flex items-center justify-center">
                    <p.icon size={14.5} />
                  </span>
                  {p.label}
                </button>
              ))}
            </Section>
          )}

          {q && patients.length === 0 && pages.length === 0 && (
            <p className="px-5 py-10 text-center text-[13px] text-[#a8a29b]">
              Nothing matches “{q}”
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <p className="px-5 pt-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[#b5afa7]">{title}</p>
      {children}
    </div>
  );
}
