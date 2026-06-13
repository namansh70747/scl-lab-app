import { useNavigate } from "react-router-dom";
import { MessageCircle, Printer, CheckCircle2, AlertTriangle, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PendingDelivery } from "@/lib/queries/delivery";

type PendingRow = PendingDelivery;

type CardState = { kind: "idle" | "sending" | "sent" | "failed"; message?: string };

export function WaitingToSendTray({
  rows,
  loading,
}: {
  rows: PendingRow[];
  loading: boolean;
}) {
  const navigate = useNavigate();
  const states: Record<string, CardState> = {};
  const keyFor = (r: PendingRow) => String(r.test_no);

  // The report PDF can only be produced on the report page (it rasterises the rendered
  // report). So these actions open that patient's report and auto-run the send there.
  function handleWhatsApp(r: PendingRow) {
    navigate(`/report/${r.patient_id}?send=whatsapp`);
  }
  function handlePrint(r: PendingRow) {
    navigate(`/report/${r.patient_id}?send=print`);
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#eef0f4]">
        <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a8b97]">
          <Send size={15} strokeWidth={1.8} className="text-maroon-600" />
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
                <div className="h-3.5 w-32 animate-pulse rounded-lg bg-[#eef0f4]" />
                <div className="mt-2 h-3 w-24 animate-pulse rounded-lg bg-[#eef0f4]" />
              </div>
              <div className="flex shrink-0 gap-2">
                <div className="h-7 w-[88px] animate-pulse rounded-lg bg-[#eef0f4]" />
                <div className="h-7 w-16 animate-pulse rounded-lg bg-[#eef0f4]" />
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
          {rows.map((r) => {
            const st = states[keyFor(r)] ?? { kind: "idle" as const };
            return (
              <div
                key={keyFor(r)}
                className="px-5 py-3 border-b border-[#f1f1f5] last:border-0 transition-colors hover:bg-[#fafafe]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium text-[#14151c]">
                      {r.patient_name}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[#8a8b97] tabular-nums">
                      #{r.test_no}
                      {r.phone ? ` · ${r.phone}` : " · no phone"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => handleWhatsApp(r)}
                      disabled={st.kind === "sending"}
                      className="btn btn-success px-2.5 py-1.5 text-[12px]"
                    >
                      <MessageCircle size={15} strokeWidth={1.8} />
                      {st.kind === "sending" ? "Opening…" : "WhatsApp"}
                    </button>
                    <button
                      onClick={() => handlePrint(r)}
                      className="btn btn-secondary px-2.5 py-1.5 text-[12px]"
                    >
                      <Printer size={15} strokeWidth={1.8} /> Print
                    </button>
                  </div>
                </div>
                <StatusLine state={st} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusLine({ state }: { state: CardState }) {
  if (state.kind === "idle" || state.kind === "sending") return null;
  if (state.kind === "failed") {
    return (
      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-[#b91c1c]">
        <AlertTriangle size={12} strokeWidth={1.8} /> {state.message ?? "Failed"}
      </p>
    );
  }
  return (
    <p className={cn("mt-1.5 flex items-center gap-1 text-[11px] text-[#14743a]")}>
      <CheckCircle2 size={12} strokeWidth={1.8} /> {state.message ?? "Done"}
    </p>
  );
}
