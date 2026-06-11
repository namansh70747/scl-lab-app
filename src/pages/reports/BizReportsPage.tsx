import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileBarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  dayBook,
  monthly,
  doctorWise,
  testWise,
  pendingBalances,
  toCSV,
  type DayBookRow,
  type MonthlyRow,
  type DoctorWiseRow,
  type TestWiseRow,
  type PendingRow,
} from "@/lib/queries/reportsBiz";

type Tab = "daybook" | "monthly" | "doctorwise" | "testwise" | "pending";

const TABS: { id: Tab; label: string }[] = [
  { id: "daybook", label: "Day Book" },
  { id: "monthly", label: "Monthly" },
  { id: "doctorwise", label: "Doctor-wise" },
  { id: "testwise", label: "Test-wise" },
  { id: "pending", label: "Pending Balances" },
];

const today = () => new Date().toISOString().slice(0, 10);

function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  const csv = toCSV(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---- shared UI bits ------------------------------------------------------

function ExportButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="btn btn-secondary">
      <Download size={15} strokeWidth={1.8} />
      Export CSV
    </button>
  );
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[12.5px] font-medium text-[#8a857d]">{children}</span>;
}

function DateRangeBar({
  from,
  to,
  setFrom,
  setTo,
}: {
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <FilterLabel>From</FilterLabel>
      <input
        type="date"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="field w-auto"
      />
      <FilterLabel>To</FilterLabel>
      <input
        type="date"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="field w-auto"
      />
    </div>
  );
}

function TableCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden animate-fade-up">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function LoadingRows({ colSpan }: { colSpan: number }) {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <tr key={i} className="border-b border-[#f6f5f3] last:border-0">
          <td colSpan={colSpan} className="px-5 py-3">
            <div
              className="animate-pulse rounded-lg bg-[#efedea] h-4"
              style={{ width: `${78 - i * 9}%` }}
            />
          </td>
        </tr>
      ))}
    </>
  );
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-14 text-center">
        <div className="w-11 h-11 rounded-xl bg-[#f1efec] text-[#8a857d] flex items-center justify-center mx-auto mb-3">
          <FileBarChart2 size={17} strokeWidth={1.8} />
        </div>
        <div className="text-[13.5px] text-[#8a857d]">{message}</div>
      </td>
    </tr>
  );
}

const TH = "px-5 py-3 text-left table-head";
const THR = "px-5 py-3 text-right table-head";
const TD = "px-5 py-3 text-[13.5px] text-[#1a1a1e]";
const TDR = "px-5 py-3 text-[13.5px] text-right tabular-nums text-[#1a1a1e]";
const ROW = "border-b border-[#f6f5f3] last:border-0 transition-colors hover:bg-[#faf9f7]";
const TOTAL_ROW = "bg-[#faf9f7] font-semibold border-t border-[#e7e5e1]";

// ---- Day Book ------------------------------------------------------------

function DayBookTab() {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());

  const { data = [], isLoading } = useQuery({
    queryKey: ["biz-daybook", from, to],
    queryFn: () => dayBook(from, to),
  });

  const totals = data.reduce(
    (a: { total: number; received: number; balance: number }, r: DayBookRow) => ({
      total: a.total + r.total,
      received: a.received + r.received,
      balance: a.balance + r.balance,
    }),
    { total: 0, received: 0, balance: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <ExportButton
          disabled={!data.length}
          onClick={() =>
            downloadCSV(`daybook-${from}-${to}.csv`, data as unknown as Record<string, unknown>[])
          }
        />
      </div>
      <TableCard>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#f1efec]">
              <th className={TH}>Test No</th>
              <th className={TH}>Name</th>
              <th className={TH}>Date</th>
              <th className={TH}>Doctor</th>
              <th className={TH}>Mode</th>
              <th className={THR}>Total</th>
              <th className={THR}>Received</th>
              <th className={THR}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <LoadingRows colSpan={8} />
            ) : data.length === 0 ? (
              <EmptyRow colSpan={8} message="No records for this range" />
            ) : (
              <>
                {data.map((r: DayBookRow) => (
                  <tr key={r.test_no} className={ROW}>
                    <td className={cn(TD, "font-mono text-[13px]")}>{r.test_no}</td>
                    <td className={TD}>{r.name}</td>
                    <td className="px-5 py-3 text-[12.5px] text-[#8a857d]">{formatDate(r.registered_at)}</td>
                    <td className={TD}>{r.doctor_name || "—"}</td>
                    <td className="px-5 py-3 text-[12.5px] text-[#8a857d]">{r.mode || "—"}</td>
                    <td className={TDR}>{formatCurrency(r.total)}</td>
                    <td className={cn(TDR, "text-[#14743a]")}>{formatCurrency(r.received)}</td>
                    <td className={cn(TDR, r.balance > 0 ? "text-[#b91c1c] font-semibold" : "text-[#a8a29b]")}>
                      {r.balance > 0 ? formatCurrency(r.balance) : "—"}
                    </td>
                  </tr>
                ))}
                <tr className={TOTAL_ROW}>
                  <td colSpan={5} className={TD}>
                    Total ({data.length} patients)
                  </td>
                  <td className={cn(TDR, "transition-colors")}>{formatCurrency(totals.total)}</td>
                  <td className={cn(TDR, "text-[#14743a] transition-colors")}>
                    {formatCurrency(totals.received)}
                  </td>
                  <td className={cn(TDR, "text-[#b91c1c] transition-colors")}>
                    {formatCurrency(totals.balance)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

// ---- Monthly -------------------------------------------------------------

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function monthLabel(month: string) {
  // month is "YYYY-MM"
  const m = parseInt(month.slice(5, 7), 10);
  return MONTH_NAMES[m - 1] ?? month;
}

function MonthlyChart({ data }: { data: MonthlyRow[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.received));
  const barW = 36;
  const gap = 18;
  const chartH = 140;
  const labelH = 24;
  const topPad = 16;
  const width = data.length * (barW + gap) + gap;
  const height = topPad + chartH + labelH;

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} role="img" aria-label="Monthly collection chart">
        {data.map((d, i) => {
          const h = Math.max(2, Math.round((d.received / max) * (chartH - 8)));
          const x = gap + i * (barW + gap);
          const y = topPad + chartH - h;
          const isHover = hovered === i;
          return (
            <g
              key={d.month}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* invisible hover hit-area covering the full column */}
              <rect x={x - gap / 2} y={0} width={barW + gap} height={height} fill="transparent" />
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={3}
                fill={isHover ? "#671616" : "#7b1b1b"}
                style={{ transition: "fill 0.15s ease" }}
              />
              {isHover && (
                <text
                  x={x + barW / 2}
                  y={y - 5}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={600}
                  fill="#5d5953"
                  className="tabular-nums"
                >
                  {formatCurrency(d.received)}
                </text>
              )}
              <text
                x={x + barW / 2}
                y={topPad + chartH + 16}
                textAnchor="middle"
                fontSize={10.5}
                fill="#8a857d"
              >
                {monthLabel(d.month)}
              </text>
            </g>
          );
        })}
        {/* hairline baseline */}
        <line
          x1={gap / 2}
          y1={topPad + chartH + 0.5}
          x2={width - gap / 2}
          y2={topPad + chartH + 0.5}
          stroke="#e7e5e1"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}

function MonthlyTab() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const years = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i);

  const { data = [], isLoading } = useQuery({
    queryKey: ["biz-monthly", year],
    queryFn: () => monthly(year),
  });

  const totals = data.reduce(
    (a: { patients: number; total: number; received: number; balance: number }, r: MonthlyRow) => ({
      patients: a.patients + r.patients,
      total: a.total + r.total,
      received: a.received + r.received,
      balance: a.balance + r.balance,
    }),
    { patients: 0, total: 0, received: 0, balance: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <FilterLabel>Year</FilterLabel>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="field w-auto"
          >
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <ExportButton
          disabled={!data.length}
          onClick={() =>
            downloadCSV(`monthly-${year}.csv`, data as unknown as Record<string, unknown>[])
          }
        />
      </div>

      {data.length > 0 && (
        <div className="card p-5 animate-fade-up">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a857d] mb-3">
            Monthly Collection (Received)
          </div>
          <MonthlyChart data={data} />
        </div>
      )}

      <TableCard>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#f1efec]">
              <th className={TH}>Month</th>
              <th className={THR}>Patients</th>
              <th className={THR}>Total</th>
              <th className={THR}>Received</th>
              <th className={THR}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <LoadingRows colSpan={5} />
            ) : data.length === 0 ? (
              <EmptyRow colSpan={5} message="No records for this range" />
            ) : (
              <>
                {data.map((r: MonthlyRow) => (
                  <tr key={r.month} className={ROW}>
                    <td className={TD}>{monthLabel(r.month)} {year}</td>
                    <td className={TDR}>{r.patients}</td>
                    <td className={TDR}>{formatCurrency(r.total)}</td>
                    <td className={cn(TDR, "text-[#14743a]")}>{formatCurrency(r.received)}</td>
                    <td className={cn(TDR, r.balance > 0 ? "text-[#b91c1c] font-semibold" : "text-[#a8a29b]")}>
                      {r.balance > 0 ? formatCurrency(r.balance) : "—"}
                    </td>
                  </tr>
                ))}
                <tr className={TOTAL_ROW}>
                  <td className={TD}>Total</td>
                  <td className={cn(TDR, "transition-colors")}>{totals.patients}</td>
                  <td className={cn(TDR, "transition-colors")}>{formatCurrency(totals.total)}</td>
                  <td className={cn(TDR, "text-[#14743a] transition-colors")}>
                    {formatCurrency(totals.received)}
                  </td>
                  <td className={cn(TDR, "text-[#b91c1c] transition-colors")}>
                    {formatCurrency(totals.balance)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

// ---- Doctor-wise ---------------------------------------------------------

function DoctorWiseTab() {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());

  const { data = [], isLoading } = useQuery({
    queryKey: ["biz-doctorwise", from, to],
    queryFn: () => doctorWise(from, to),
  });

  const totals = data.reduce(
    (a: { patients: number; total: number; received: number }, r: DoctorWiseRow) => ({
      patients: a.patients + r.patients,
      total: a.total + r.total,
      received: a.received + r.received,
    }),
    { patients: 0, total: 0, received: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <ExportButton
          disabled={!data.length}
          onClick={() =>
            downloadCSV(`doctorwise-${from}-${to}.csv`, data as unknown as Record<string, unknown>[])
          }
        />
      </div>
      <TableCard>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#f1efec]">
              <th className={TH}>Doctor</th>
              <th className={THR}>Patients</th>
              <th className={THR}>Total</th>
              <th className={THR}>Received</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <LoadingRows colSpan={4} />
            ) : data.length === 0 ? (
              <EmptyRow colSpan={4} message="No records for this range" />
            ) : (
              <>
                {data.map((r: DoctorWiseRow, i: number) => (
                  <tr key={`${r.doctor_name}-${i}`} className={ROW}>
                    <td className={TD}>{r.doctor_name}</td>
                    <td className={TDR}>{r.patients}</td>
                    <td className={TDR}>{formatCurrency(r.total)}</td>
                    <td className={cn(TDR, "text-[#14743a]")}>{formatCurrency(r.received)}</td>
                  </tr>
                ))}
                <tr className={TOTAL_ROW}>
                  <td className={TD}>
                    Total ({data.length} doctors)
                  </td>
                  <td className={cn(TDR, "transition-colors")}>{totals.patients}</td>
                  <td className={cn(TDR, "transition-colors")}>{formatCurrency(totals.total)}</td>
                  <td className={cn(TDR, "text-[#14743a] transition-colors")}>
                    {formatCurrency(totals.received)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

// ---- Test-wise -----------------------------------------------------------

function TestWiseTab() {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());

  const { data = [], isLoading } = useQuery({
    queryKey: ["biz-testwise", from, to],
    queryFn: () => testWise(from, to),
  });

  const totals = data.reduce(
    (a: { count: number; revenue: number }, r: TestWiseRow) => ({
      count: a.count + r.count,
      revenue: a.revenue + r.revenue,
    }),
    { count: 0, revenue: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <ExportButton
          disabled={!data.length}
          onClick={() =>
            downloadCSV(`testwise-${from}-${to}.csv`, data as unknown as Record<string, unknown>[])
          }
        />
      </div>
      <TableCard>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#f1efec]">
              <th className={TH}>Code</th>
              <th className={TH}>Test</th>
              <th className={THR}>Count</th>
              <th className={THR}>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <LoadingRows colSpan={4} />
            ) : data.length === 0 ? (
              <EmptyRow colSpan={4} message="No records for this range" />
            ) : (
              <>
                {data.map((r: TestWiseRow) => (
                  <tr key={r.code} className={ROW}>
                    <td className={cn(TD, "font-mono text-[13px]")}>{r.code}</td>
                    <td className={TD}>{r.name}</td>
                    <td className={TDR}>{r.count}</td>
                    <td className={TDR}>{formatCurrency(r.revenue)}</td>
                  </tr>
                ))}
                <tr className={TOTAL_ROW}>
                  <td colSpan={2} className={TD}>
                    Total ({data.length} tests)
                  </td>
                  <td className={cn(TDR, "transition-colors")}>{totals.count}</td>
                  <td className={cn(TDR, "transition-colors")}>{formatCurrency(totals.revenue)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

// ---- Pending Balances ----------------------------------------------------

function PendingTab() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["biz-pending"],
    queryFn: () => pendingBalances(),
  });

  const outstanding = data.reduce((a: number, r: PendingRow) => a + r.balance, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <ExportButton
          disabled={!data.length}
          onClick={() =>
            downloadCSV(`pending-balances.csv`, data as unknown as Record<string, unknown>[])
          }
        />
      </div>
      <TableCard>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#f1efec]">
              <th className={TH}>Test No</th>
              <th className={TH}>Name</th>
              <th className={TH}>Phone</th>
              <th className={TH}>Date</th>
              <th className={THR}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <LoadingRows colSpan={5} />
            ) : data.length === 0 ? (
              <EmptyRow colSpan={5} message="No pending balances" />
            ) : (
              <>
                {data.map((r: PendingRow) => (
                  <tr key={r.test_no} className={ROW}>
                    <td className={cn(TD, "font-mono text-[13px]")}>{r.test_no}</td>
                    <td className={TD}>{r.name}</td>
                    <td className="px-5 py-3 text-[13.5px] text-[#8a857d]">{r.phone || "—"}</td>
                    <td className="px-5 py-3 text-[12.5px] text-[#8a857d]">{formatDate(r.registered_at)}</td>
                    <td className={cn(TDR, "text-[#b91c1c] font-semibold")}>{formatCurrency(r.balance)}</td>
                  </tr>
                ))}
                <tr className={TOTAL_ROW}>
                  <td colSpan={4} className={TD}>
                    Total Outstanding ({data.length} patients)
                  </td>
                  <td className={cn(TDR, "text-[#b91c1c] transition-colors")}>
                    {formatCurrency(outstanding)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

// ---- Page ----------------------------------------------------------------

export function BizReportsPage() {
  const [tab, setTab] = useState<Tab>("daybook");

  return (
    <div className="pt-4 space-y-4">
      <div className="card p-1 inline-flex gap-0.5 animate-fade-up">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "px-3.5 py-1.5 rounded-[9px] text-[13px] font-medium transition-colors whitespace-nowrap",
              tab === t.id
                ? "bg-[#7b1b1b] text-white shadow-sm"
                : "text-[#5d5953] hover:bg-[#f1efec]"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "daybook" && <DayBookTab />}
      {tab === "monthly" && <MonthlyTab />}
      {tab === "doctorwise" && <DoctorWiseTab />}
      {tab === "testwise" && <TestWiseTab />}
      {tab === "pending" && <PendingTab />}
    </div>
  );
}
