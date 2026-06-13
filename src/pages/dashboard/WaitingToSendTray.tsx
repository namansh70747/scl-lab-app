import { useNavigate } from "react-router-dom";
import { MessageCircle, Printer, CheckCircle2, Send } from "lucide-react";
import type { PendingDelivery } from "@/lib/queries/delivery";

type PendingRow = PendingDelivery;

export function WaitingToSendTray({
  rows,
  loading,
}: {
  rows: PendingRow[];
  loading: boolean;
}) {
  const navigate = useNavigate();

  // The report PDF can only be produced on the report page (it rasterises the rendered
  // report). So these actions open that patient's report and auto-run the send there.
  const openWhatsApp = (r: PendingRow) => navigate(`/report/${r.patient_id}?send=whatsapp`);
  const openPrint = (r: PendingRow) => navigate(`/report/${r.patient_id}?send=print`);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#eef0f4]">
        <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a8b97]">
          <Send size={15} strokeWidth={1.8} className="text-[#4f46e5]" />
          Waiting to Send
        </h2>
        {!loading && rows.length > 0 && (
          <span className="text-[12px] text-[#8a8b97] tabular-nums">{rows.length}</span>
        )}
      </div>

      {loading ? (
        <div>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 px-5 py-[15px] border-b border-[#f1f1f5] last:border-0"
            >
              <div className="min-w-0">
                <div className="skeleton h-3.5 w-32" />
                <div className="skeleton mt-2 h-3 w-24" />
              </div>
              <div className="flex shrink-0 gap-2">
                <div className="skeleton h-7 w-[88px]" />
                <div className="skeleton h-7 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="py-14 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef0f4] text-[#8a8b97]">
            <CheckCircle2 size={17} strokeWidth={1.8} />
          </div>
          <p className="text-[13.5px] text-[#8a8b97]">
            All caught up — no approved reports waiting to be sent.
          </p>
        </div>
      ) : (
        <div className="max-h-[640px] overflow-y-auto">
          {rows.map((r) => (
            <div
              key={r.patient_id}
              className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[#f1f1f5] last:border-0 transition-colors hover:bg-[#fafafe]"
            >
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-medium text-[#14151c]">
                  {r.patient_name}
                </p>
                <p className="mt-0.5 text-[12px] text-[#8a8b97] tabular-nums">
                  #{r.test_no} · {r.phone}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button onClick={() => openWhatsApp(r)} className="btn btn-success px-2.5 py-1.5 text-[12px]">
                  <MessageCircle size={15} strokeWidth={1.8} /> WhatsApp
                </button>
                <button onClick={() => openPrint(r)} className="btn btn-secondary px-2.5 py-1.5 text-[12px]">
                  <Printer size={15} strokeWidth={1.8} /> Print
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
