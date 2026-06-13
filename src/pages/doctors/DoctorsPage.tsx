import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listDoctorsWithCounts,
  upsertDoctor,
  updateDoctor,
  setDoctorActive,
  referralSummary,
  type DoctorWithCount,
} from "@/lib/queries/doctors";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Plus,
  Search,
  Stethoscope,
  Pencil,
  BarChart3,
  X,
  Check,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

function firstOfMonthISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/* -------------------------------------------------------------------------- */
/* toggle switch                                                              */
/* -------------------------------------------------------------------------- */

function ToggleSwitch({
  on,
  onChange,
  disabled,
}: {
  on: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={cn(
        "relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-maroon-500/40 focus-visible:ring-offset-1 disabled:opacity-50",
        on ? "bg-maroon-700" : "bg-[#dedad4]"
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-150",
          on ? "translate-x-[15px]" : "translate-x-[2px]"
        )}
      />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* modal shell                                                                */
/* -------------------------------------------------------------------------- */

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1208]/40 p-4 backdrop-blur-[2px] animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 animate-scale-in"
        style={{ boxShadow: "var(--shadow-pop)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <h2 className="text-[15px] font-semibold text-[#1a1a1e]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="btn btn-ghost -mr-2 -mt-1.5 p-1.5"
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* add / edit doctor dialog                                                   */
/* -------------------------------------------------------------------------- */

function DoctorDialog({
  doctor,
  onClose,
  onSaved,
}: {
  doctor: DoctorWithCount | null; // null = add mode
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(doctor?.name ?? "");
  const [degree, setDegree] = useState(doctor?.degree ?? "");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const save = useMutation({
    // Edit mode updates THIS doctor by id (so a rename renames, not duplicates);
    // add mode upserts by name.
    mutationFn: async () => {
      if (doctor) await updateDoctor(doctor.id, name.trim(), degree.trim() || undefined);
      else await upsertDoctor(name.trim(), degree.trim() || undefined);
    },
    onSuccess: () => onSaved(),
    onError: (e: unknown) => alert(e instanceof Error ? e.message : String(e)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || save.isPending) return;
    save.mutate();
  };

  return (
    <Modal title={doctor ? "Edit Doctor" : "Add Doctor"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-[#5d5953]">
            Name <span className="text-maroon-600">*</span>
          </label>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. DR RAKESH SHARMA"
            className="field w-full"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-[#5d5953]">
            Degree <span className="text-[#8a857d] font-normal">(optional)</span>
          </label>
          <input
            value={degree}
            onChange={(e) => setDegree(e.target.value)}
            placeholder="e.g. MBBS, MD"
            className="field w-full"
          />
        </div>
        <p className="text-[12px] text-[#8a857d]">
          {doctor
            ? "Updates this doctor — including a rename — keeping their referral history."
            : "New doctors are matched by name; an existing name just updates that doctor."}
        </p>
        {save.isError && (
          <p className="text-[12.5px] font-medium text-[#b91c1c]">
            Could not save doctor. Please try again.
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || save.isPending}
            className="btn btn-primary"
          >
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* referral summary dialog                                                    */
/* -------------------------------------------------------------------------- */

function SummaryDialog({
  doctor,
  onClose,
}: {
  doctor: DoctorWithCount;
  onClose: () => void;
}) {
  const [from, setFrom] = useState(firstOfMonthISO());
  const [to, setTo] = useState(todayISO());

  const { data, isLoading, isError } = useQuery({
    queryKey: ["doctor-summary", doctor.id, from, to],
    queryFn: () => referralSummary(doctor.id, from, to),
  });

  const stats = [
    { label: "Patients referred", value: data ? String(data.patients) : "—" },
    { label: "Total billed", value: data ? formatCurrency(data.total) : "—" },
    { label: "Received", value: data ? formatCurrency(data.received) : "—" },
    { label: "Balance", value: data ? formatCurrency(data.balance) : "—" },
  ];

  return (
    <Modal title={doctor.name} onClose={onClose}>
      <div className="space-y-4">
        {doctor.degree && (
          <p className="-mt-4 text-[12.5px] text-[#8a857d]">{doctor.degree}</p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#5d5953]">
              From
            </label>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="field w-full"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#5d5953]">
              To
            </label>
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="field w-full"
            />
          </div>
        </div>

        {isError ? (
          <p className="text-[12.5px] font-medium text-[#b91c1c]">
            Could not load summary.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-[#f1efec] bg-[#faf9f7] px-3.5 py-3"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a857d]">
                  {s.label}
                </div>
                <div className="mt-1 text-[18px] font-bold tabular-nums text-[#1a1a1e] transition-colors">
                  {isLoading ? (
                    <span className="inline-block h-5 w-16 animate-pulse rounded-lg bg-[#efedea]" />
                  ) : (
                    s.value
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-[12px] text-[#8a857d]">
          Showing referrals registered between {formatDate(from)} and{" "}
          {formatDate(to)}.
        </p>

        <div className="flex justify-end pt-1">
          <button type="button" onClick={onClose} className="btn btn-primary">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* inline degree editor                                                       */
/* -------------------------------------------------------------------------- */

function InlineDegree({
  doctor,
  onSaved,
}: {
  doctor: DoctorWithCount;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(doctor.degree ?? "");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const save = useMutation({
    mutationFn: () => upsertDoctor(doctor.name, value.trim() || undefined),
    onSuccess: () => {
      setEditing(false);
      onSaved();
    },
  });

  const commit = () => {
    if (save.isPending) return;
    if (value.trim() === (doctor.degree ?? "")) {
      setEditing(false);
      return;
    }
    save.mutate();
  };

  const cancel = () => {
    setValue(doctor.degree ?? "");
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        className="-mx-1 rounded-md px-1 py-0.5 text-[13px] text-[#8a857d] transition-colors hover:bg-[#f1efec] hover:text-[#5d5953]"
        title="Click to edit degree"
      >
        {doctor.degree?.trim() ? (
          doctor.degree
        ) : (
          <span className="text-[#c9c4bc]">—</span>
        )}
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        placeholder="Degree"
        className="w-40 border-0 border-b border-maroon-700/60 bg-transparent px-0 py-0.5 text-[13px] text-[#1a1a1e] placeholder:text-[#a8a29b] focus:border-maroon-700 focus:outline-none"
      />
      <button
        type="button"
        onClick={commit}
        disabled={save.isPending}
        aria-label="Save"
        className="btn btn-ghost p-1 text-[#14743a] disabled:opacity-50"
      >
        <Check size={15} strokeWidth={2.2} />
      </button>
      <button
        type="button"
        onClick={cancel}
        aria-label="Cancel"
        className="btn btn-ghost p-1"
      >
        <X size={15} strokeWidth={1.8} />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* loading skeleton                                                           */
/* -------------------------------------------------------------------------- */

function TableSkeleton() {
  return (
    <tbody>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b border-[#f6f5f3] last:border-0">
          {Array.from({ length: 5 }).map((__, j) => (
            <td key={j} className="px-5 py-4">
              <div className="h-4 w-full animate-pulse rounded-lg bg-[#efedea]" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

/* -------------------------------------------------------------------------- */
/* page                                                                       */
/* -------------------------------------------------------------------------- */

export function DoctorsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<
    | { kind: "add" }
    | { kind: "edit"; doctor: DoctorWithCount }
    | { kind: "summary"; doctor: DoctorWithCount }
    | null
  >(null);

  const {
    data: doctors = [],
    isLoading,
    isError,
  } = useQuery({
    // Distinct from ['doctors','active'] (the active-only list used by registration) —
    // sharing the bare ['doctors'] key served the wrong shape to whichever mounted first.
    queryKey: ["doctors", "with-counts"],
    queryFn: listDoctorsWithCounts,
  });

  // Prefix-invalidate so BOTH ['doctors','with-counts'] and ['doctors','active'] refresh.
  const invalidate = () => qc.invalidateQueries({ queryKey: ["doctors"] });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: number; active: number }) =>
      setDoctorActive(id, active),
    onSuccess: invalidate,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return doctors;
    return doctors.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.degree ?? "").toLowerCase().includes(q)
    );
  }, [doctors, search]);

  return (
    <div className="pt-4 space-y-4 animate-fade-up">
      {/* header */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[#8a857d]">
          {isLoading
            ? "Loading…"
            : `${filtered.length} doctor${filtered.length === 1 ? "" : "s"}`}
        </p>
        <button
          type="button"
          onClick={() => setDialog({ kind: "add" })}
          className="btn btn-primary"
        >
          <Plus size={15} strokeWidth={1.8} /> Add Doctor
        </button>
      </div>

      {/* search */}
      <div className="relative max-w-sm">
        <Search
          size={15}
          strokeWidth={1.8}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8a857d]"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search doctors…"
          className="field w-full pl-9"
        />
      </div>

      {/* table card */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#f1efec]">
              <th className="table-head px-5 py-3 text-left">Name</th>
              <th className="table-head px-5 py-3 text-left">Degree</th>
              <th className="table-head px-5 py-3 text-center">Referrals</th>
              <th className="table-head px-5 py-3 text-center">Active</th>
              <th className="table-head px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>

          {isLoading ? (
            <TableSkeleton />
          ) : (
            <tbody>
              {isError && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-[13.5px] font-medium text-[#b91c1c]"
                  >
                    Could not load doctors.
                  </td>
                </tr>
              )}

              {!isError && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-14">
                    <div className="text-center">
                      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#f1efec] text-[#8a857d]">
                        <Stethoscope size={17} strokeWidth={1.8} />
                      </div>
                      <p className="text-[13.5px] text-[#8a857d]">
                        {doctors.length === 0
                          ? "Add referring doctors to track their referrals and collections."
                          : "No doctors match your search."}
                      </p>
                      {doctors.length === 0 && (
                        <button
                          type="button"
                          onClick={() => setDialog({ kind: "add" })}
                          className="btn btn-secondary mt-4"
                        >
                          <Plus size={15} strokeWidth={1.8} /> Add Doctor
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {!isError &&
                filtered.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => setDialog({ kind: "summary", doctor: d })}
                    className="group cursor-pointer border-b border-[#f6f5f3] last:border-0 transition-colors hover:bg-[#faf9f7]"
                  >
                    <td className="px-5 py-3 text-[14px] font-semibold text-[#1a1a1e]">
                      {d.name}
                    </td>
                    <td className="px-5 py-3">
                      <InlineDegree doctor={d} onSaved={invalidate} />
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="chip chip-gray tabular-nums">
                        {d.referral_count}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-center">
                        <ToggleSwitch
                          on={d.active === 1}
                          disabled={toggle.isPending}
                          onChange={() =>
                            toggle.mutate({
                              id: d.id,
                              active: d.active ? 0 : 1,
                            })
                          }
                        />
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <button
                          type="button"
                          aria-label="Edit doctor"
                          title="Edit name & degree"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDialog({ kind: "edit", doctor: d });
                          }}
                          className="btn btn-ghost p-1.5"
                        >
                          <Pencil size={15} strokeWidth={1.8} />
                        </button>
                        <button
                          type="button"
                          aria-label="View referral summary"
                          title="Referral & collection summary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDialog({ kind: "summary", doctor: d });
                          }}
                          className="btn btn-ghost p-1.5"
                        >
                          <BarChart3 size={15} strokeWidth={1.8} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          )}
        </table>
      </div>

      {/* dialogs */}
      {dialog?.kind === "add" && (
        <DoctorDialog
          doctor={null}
          onClose={() => setDialog(null)}
          onSaved={() => {
            invalidate();
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === "edit" && (
        <DoctorDialog
          doctor={dialog.doctor}
          onClose={() => setDialog(null)}
          onSaved={() => {
            invalidate();
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === "summary" && (
        <SummaryDialog doctor={dialog.doctor} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
