import { Panel } from "@/types";
import { Modal } from "./Overlays";
import { Layers } from "lucide-react";

export function ManagePanelsDialog({ panels, onClose }: { panels: Panel[]; onClose: () => void }) {
  return (
    <Modal title="Manage Panels" onClose={onClose} width="max-w-xl">
      <p className="text-[13px] text-[#8a857d] leading-relaxed mb-4">
        Panels group tests on the report. A test&apos;s panel is set from its{" "}
        <span className="font-medium text-[#5d5953]">Details</span> tab in the Test Master sheet.
        Below are the configured panels and their report settings.
      </p>

      {panels.length === 0 ? (
        <div className="py-14 text-center">
          <div className="w-11 h-11 rounded-xl bg-[#f1efec] text-[#8a857d] flex items-center justify-center mx-auto mb-3">
            <Layers size={17} strokeWidth={1.8} />
          </div>
          <p className="text-[13.5px] text-[#8a857d]">No panels configured.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#f1efec] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#f1efec]">
                <th className="px-4 py-2.5 text-left table-head">Code</th>
                <th className="px-4 py-2.5 text-left table-head">Report Heading</th>
                <th className="px-4 py-2.5 text-right table-head">Order</th>
                <th className="px-4 py-2.5 text-center table-head">Page Break After</th>
              </tr>
            </thead>
            <tbody>
              {panels.map((p) => (
                <tr key={p.id} className="border-b border-[#f6f5f3] last:border-0 hover:bg-[#faf9f7]">
                  <td className="px-4 py-2.5 font-mono text-[12px] text-[#8a857d]">{p.code}</td>
                  <td className="px-4 py-2.5 text-[13.5px] text-[#1a1a1e]">
                    {p.report_heading || p.name}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[13px] text-[#5d5953]">
                    {p.sort_order}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {p.page_break_after ? (
                      <span className="chip chip-gray text-[10.5px]">Yes</span>
                    ) : (
                      <span className="text-[12px] text-[#a8a29b]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end mt-5">
        <button onClick={onClose} className="btn btn-secondary">
          Close
        </button>
      </div>
    </Modal>
  );
}
