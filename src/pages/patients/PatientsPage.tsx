import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { searchPatients, getPatientHistory } from "@/lib/queries/patients";
import { listDoctors } from "@/lib/queries/doctors";
import { Search, UserPlus, X } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Combobox } from "@/components/common/Combobox";
import type { PatientWithStatus, PatientStatus } from "@/types";

const STATUS_OPTIONS: { value: PatientStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "registered", label: "Registered" },
  { value: "results_pending", label: "Results pending" },
  { value: "approved", label: "Approved" },
  { value: "delivered", label: "Delivered" },
];

const STATUS_CHIP: Record<string, string> = {
  registered: "chip-gray",
  results_pending: "chip-amber",
  approved: "chip-green",
  delivered: "chip-blue",
};

const STATUS_LABEL: Record<string, string> = {
  registered: "Registered",
  results_pending: "Results pending",
  approved: "Approved",
  delivered: "Delivered",
};

/** Open destination for a patient: result entry while pending, else the report. */
function openPath(p: PatientWithStatus): string {
  const pending = p.status === "registered" || p.status === "results_pending";
  return pending ? `/result-entry/${p.id}` : `/report/${p.id}`;
}

function StatusChip({ status }: { status?: PatientStatus }) {
  const s = status ?? "registered";
  return (
    <span className={cn("chip whitespace-nowrap", STATUS_CHIP[s] ?? "chip-gray")}>
      {STATUS_LABEL[s] ?? s.replace(/_/g, " ")}
    </span>
  );
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function PatientsPage() {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [doctorId, setDoctorId] = useState<string>("all");
  const [status, setStatus] = useState<PatientStatus | "all">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [history, setHistory] = useState<PatientWithStatus | null>(null);

  const debouncedQuery = useDebounced(query, 150);

  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors", "active"],
    queryFn: () => listDoctors(true),
  });

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ["patients-search", debouncedQuery],
    queryFn: () => searchPatients(debouncedQuery || "", 5000),
  });

  // Client-side filtering over the search result (search already matches name/test_no/phone).
  const filtered = useMemo(() => {
    return patients.filter((p) => {
      if (doctorId !== "all") {
        if (String(p.doctor_id ?? "") !== doctorId) return false;
      }
      if (status !== "all" && (p.status ?? "registered") !== status) {
        return false;
      }
      if (fromDate || toDate) {
        const d = (p.registered_at ?? "").slice(0, 10);
        if (!d) return false;
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;
      }
      return true;
    });
  }, [patients, doctorId, status, fromDate, toDate]);

  return (
    <div className="pt-4 space-y-4 animate-fade-up">
      {/* Header row: muted count left, primary action right */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[#8a857d]">
          {isLoading
            ? "Searching…"
            : `${filtered.length} patient${filtered.length === 1 ? "" : "s"}`}
        </p>
        <button
          onClick={() => navigate("/new-patient")}
          className="btn btn-primary"
        >
          <UserPlus size={15} strokeWidth={1.8} /> New Patient
        </button>
      </div>

      {/* Filter bar */}
      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search
              size={15}
              strokeWidth={1.8}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a857d] pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search by name, test number, or phone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="field w-full pl-9"
              autoFocus
            />
          </div>

          <Combobox
            className="w-44"
            value={doctorId === "all" ? null : Number(doctorId)}
            onChange={(v) => setDoctorId(v == null ? "all" : String(v))}
            options={doctors.map((d) => ({ value: d.id, label: d.name }))}
            placeholder="All doctors"
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as PatientStatus | "all")}
            aria-label="Filter by status"
            className="field w-40"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label="From date"
            title="From date"
            className="field w-36"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            aria-label="To date"
            title="To date"
            className="field w-36"
          />
        </div>
      </div>

      {/* Results */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState
            query={debouncedQuery}
            onNew={() => navigate("/new-patient")}
          />
        ) : (
          <ResultsTable
            rows={filtered}
            onOpen={(p) => navigate(openPath(p))}
            onReprint={(p) => navigate(`/report/${p.id}`)}
            onResend={(p) => navigate(`/report/${p.id}`)}
            onName={(p) => setHistory(p)}
          />
        )}
      </div>

      {history && (
        <HistorySheet patient={history} onClose={() => setHistory(null)} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Results table (virtualized)                                                */
/* -------------------------------------------------------------------------- */

const COLS =
  "grid grid-cols-[110px_90px_minmax(160px,1fr)_90px_minmax(120px,1fr)_minmax(140px,1fr)_110px_130px_150px] items-center gap-3 px-5";

function HeaderRow() {
  return (
    <div className={cn(COLS, "py-3 border-b border-[#f1efec]")}>
      <div className="table-head">Date</div>
      <div className="table-head">Test No</div>
      <div className="table-head">Name</div>
      <div className="table-head">Age/Sex</div>
      <div className="table-head">Doctor</div>
      <div className="table-head">Tests / Amount</div>
      <div className="table-head text-right">Balance</div>
      <div className="table-head">Status</div>
      <div className="table-head text-right">Actions</div>
    </div>
  );
}

function ResultsTable({
  rows,
  onOpen,
  onReprint,
  onResend,
  onName,
}: {
  rows: PatientWithStatus[];
  onOpen: (p: PatientWithStatus) => void;
  onReprint: (p: PatientWithStatus) => void;
  onResend: (p: PatientWithStatus) => void;
  onName: (p: PatientWithStatus) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 12,
  });

  return (
    <div>
      <HeaderRow />

      {/* Virtualized body */}
      <div ref={parentRef} className="max-h-[60vh] overflow-auto">
        <div
          style={{ height: virtualizer.getTotalSize(), position: "relative" }}
        >
          {virtualizer.getVirtualItems().map((vi) => {
            const p = rows[vi.index];
            return (
              <div
                key={p.id}
                ref={virtualizer.measureElement}
                data-index={vi.index}
                className={cn(
                  COLS,
                  "group absolute top-0 left-0 w-full border-b border-[#f6f5f3] last:border-0 hover:bg-[#faf9f7] text-[13.5px] transition-colors"
                )}
                style={{
                  transform: `translateY(${vi.start}px)`,
                }}
              >
                <div className="text-[12px] font-mono tabular-nums text-[#8a857d]">
                  {formatDate(p.registered_at)}
                </div>
                <div className="text-[12px] font-mono tabular-nums text-[#8a857d]">
                  {p.test_no}
                </div>
                <div className="min-w-0">
                  <button
                    onClick={() => onName(p)}
                    className="block w-full truncate text-left font-medium text-[#1a1a1e] hover:text-maroon-700 hover:underline transition-colors"
                    title="View visit history"
                  >
                    {p.title ? `${p.title} ` : ""}
                    {p.name}
                  </button>
                  {p.phone && (
                    <div className="truncate text-[12px] text-[#8a857d]">
                      {p.phone}
                    </div>
                  )}
                </div>
                <div className="whitespace-nowrap text-[12.5px] text-[#5d5953]">
                  {p.age} {p.age_unit} /{" "}
                  {p.sex === "MALE" ? "M" : p.sex === "FEMALE" ? "F" : "O"}
                </div>
                <div className="truncate text-[12.5px] text-[#8a857d]">
                  {p.doctor_name ?? "—"}
                </div>
                <div className="text-[#5d5953]">
                  <span className="tabular-nums">{p.test_count ?? 0}</span>{" "}
                  <span className="text-[#8a857d]">tests</span>
                  <div className="text-[12px] tabular-nums text-[#8a857d]">
                    {formatCurrency(p.bill?.total ?? 0)}
                  </div>
                </div>
                <div
                  className={cn(
                    "text-right tabular-nums",
                    (p.bill?.balance ?? 0) > 0
                      ? "font-semibold text-[#b91c1c]"
                      : "text-[#8a857d]"
                  )}
                >
                  {formatCurrency(p.bill?.balance ?? 0)}
                </div>
                <div>
                  <StatusChip status={p.status} />
                </div>
                <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <RowAction label="Open" onClick={() => onOpen(p)} />
                  <RowAction label="Re-print" onClick={() => onReprint(p)} />
                  <RowAction label="Re-send" onClick={() => onResend(p)} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RowAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="btn btn-ghost px-2 py-1 text-[12px] font-medium"
    >
      {label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Visit history Sheet                                                        */
/* -------------------------------------------------------------------------- */

function HistorySheet({
  patient,
  onClose,
}: {
  patient: PatientWithStatus;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ["patient-history", patient.name, patient.phone],
    queryFn: () => getPatientHistory(patient.name, patient.phone ?? ""),
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-[#1a1208]/40 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-label="Visit history"
        className="relative flex h-full w-[420px] max-w-full flex-col bg-white shadow-[var(--shadow-pop)] animate-fade-up"
      >
        <div className="flex items-start justify-between border-b border-[#f1efec] p-5">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-[#1a1a1e]">
              {patient.title ? `${patient.title} ` : ""}
              {patient.name}
            </div>
            <div className="text-[12.5px] text-[#8a857d]">
              {patient.phone || "No phone"} · Visit history
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="btn btn-ghost -mr-1 -mt-1 p-1.5"
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-auto bg-[#f8f7f5] p-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-lg bg-[#efedea]"
                />
              ))}
            </div>
          ) : visits.length === 0 ? (
            <div className="py-14 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#f1efec] text-[#8a857d]">
                <Search size={17} strokeWidth={1.8} />
              </div>
              <p className="text-[13.5px] text-[#8a857d]">
                No previous visits found.
              </p>
            </div>
          ) : (
            visits.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  onClose();
                  navigate(openPath(v));
                }}
                className="card card-hover block w-full p-3 text-left"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] font-medium text-[#1a1a1e]">
                    {formatDate(v.registered_at)}
                  </span>
                  <StatusChip status={v.status} />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[12px] text-[#8a857d]">
                  <span className="font-mono tabular-nums">
                    Test #{v.test_no}
                  </span>
                  <span className="tabular-nums">
                    {v.test_count ?? 0} tests ·{" "}
                    {formatCurrency(v.bill?.total ?? 0)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* States                                                                     */
/* -------------------------------------------------------------------------- */

function EmptyState({ query, onNew }: { query: string; onNew: () => void }) {
  return (
    <div className="py-14 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#f1efec] text-[#8a857d]">
        <Search size={17} strokeWidth={1.8} />
      </div>
      <p className="text-[13.5px] text-[#8a857d]">
        {query ? "No patients match your filters." : "No patients yet."}
      </p>
      <button onClick={onNew} className="btn btn-secondary mt-4">
        <UserPlus size={15} strokeWidth={1.8} /> New Patient
      </button>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div>
      <HeaderRow />
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className={cn(COLS, "border-b border-[#f6f5f3] last:border-0 py-4")}
        >
          {Array.from({ length: 9 }).map((_, j) => (
            <div
              key={j}
              className="h-4 animate-pulse rounded-lg bg-[#efedea]"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
