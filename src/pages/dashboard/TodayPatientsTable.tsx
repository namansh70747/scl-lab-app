import { useNavigate } from "react-router-dom";
import { UserPlus, FileText, ClipboardEdit } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PatientWithStatus, PatientStatus } from "@/types";

const STATUS_CHIP: Record<PatientStatus, string> = {
  registered: "chip-gray",
  results_pending: "chip-amber",
  approved: "chip-green",
  delivered: "chip-blue",
};

const STATUS_LABEL: Record<PatientStatus, string> = {
  registered: "Registered",
  results_pending: "Results Pending",
  approved: "Approved",
  delivered: "Delivered",
};

export function TodayPatientsTable({
  patients,
  loading,
}: {
  patients: PatientWithStatus[];
  loading: boolean;
}) {
  const navigate = useNavigate();

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#eef0f4]">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a8b97]">
          Today's Patients
        </h2>
        {!loading && patients.length > 0 && (
          <span className="text-[12px] text-[#8a8b97] tabular-nums">{patients.length} total</span>
        )}
      </div>

      {loading ? (
        <div>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-5 py-[15px] border-b border-[#f1f1f5] last:border-0"
            >
              <div className="h-3.5 w-9 animate-pulse rounded-lg bg-[#eef0f4]" />
              <div className="h-3.5 w-40 animate-pulse rounded-lg bg-[#eef0f4]" />
              <div className="ml-auto h-3.5 w-16 animate-pulse rounded-lg bg-[#eef0f4]" />
              <div className="h-5 w-24 animate-pulse rounded-full bg-[#eef0f4]" />
            </div>
          ))}
        </div>
      ) : patients.length === 0 ? (
        <div className="py-14 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef0f4] text-[#8a8b97]">
            <UserPlus size={17} strokeWidth={1.8} />
          </div>
          <p className="text-[13.5px] text-[#8a8b97]">No patients registered today.</p>
          <button onClick={() => navigate("/new-patient")} className="btn btn-secondary mt-4">
            Register first patient
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-[#eef0f4]">
                <th className="px-5 py-3 text-left table-head">Test No</th>
                <th className="px-5 py-3 text-left table-head">Name</th>
                <th className="px-5 py-3 text-right table-head">Tests / Amount</th>
                <th className="px-5 py-3 text-right table-head">Balance</th>
                <th className="px-5 py-3 text-left table-head">Status</th>
                <th className="px-5 py-3 text-right table-head">Actions</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => {
                const status = (p.status ?? "registered") as PatientStatus;
                const balance = p.bill?.balance ?? 0;
                return (
                  <tr
                    key={p.id}
                    className="group cursor-pointer border-b border-[#f1f1f5] last:border-0 transition-colors hover:bg-[#fafafe]"
                    onClick={() => navigate(`/result-entry/${p.id}`)}
                  >
                    <td className="px-5 py-3 text-[13.5px] font-medium text-[#54555f] tabular-nums">
                      {p.test_no}
                    </td>
                    <td className="px-5 py-3 text-[13.5px] font-medium text-[#14151c]">
                      {p.title} {p.name}
                      {p.doctor_name && (
                        <span className="block text-[12px] font-normal text-[#8a8b97]">
                          Dr. {p.doctor_name}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-[13.5px] tabular-nums text-[#14151c]">
                        {formatCurrency(p.bill?.total ?? 0)}
                      </span>
                      <span className="block text-[12px] text-[#8a8b97] tabular-nums">
                        {p.test_count ?? 0} test{(p.test_count ?? 0) === 1 ? "" : "s"}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "px-5 py-3 text-right text-[13.5px] tabular-nums",
                        balance > 0 ? "text-[#b91c1c] font-semibold" : "text-[#8a8b97]"
                      )}
                    >
                      {balance > 0 ? formatCurrency(balance) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn("chip whitespace-nowrap", STATUS_CHIP[status])}>
                        {STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => navigate(`/result-entry/${p.id}`)}
                          title="Enter results"
                          className="btn btn-ghost px-2 py-1 text-[12px] font-medium"
                        >
                          <ClipboardEdit size={15} strokeWidth={1.8} /> Enter results
                        </button>
                        <button
                          onClick={() => navigate(`/report/${p.id}`)}
                          title="Open report"
                          className="btn btn-ghost px-2 py-1 text-[12px] font-medium"
                        >
                          <FileText size={15} strokeWidth={1.8} /> Report
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
