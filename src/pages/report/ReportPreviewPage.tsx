import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getPatientById, getBill } from "@/lib/queries/patients";
import { getOrdersWithResults } from "@/lib/queries/results";
import { listPanels } from "@/lib/queries/tests";
import { getAllSettings } from "@/lib/queries/settings";
import { logDelivery } from "@/lib/queries/delivery";
import { computeCalculated } from "@/lib/calc";
import { computeFlag, patientAgeDays } from "@/lib/flags";
import { formatDate, formatDateTime } from "@/lib/format";
import { open } from "@tauri-apps/plugin-shell";
import { ChevronLeft, Printer, FileDown, MessageCircle, Mail, Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function ReportPreviewPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const pid = parseInt(patientId ?? '0');
  const navigate = useNavigate();
  const [sent, setSent] = useState<Record<string, boolean>>({});

  const { data: patient } = useQuery({ queryKey: ['patient', pid], queryFn: () => getPatientById(pid) });
  const { data: orders = [] } = useQuery({ queryKey: ['orders', pid], queryFn: () => getOrdersWithResults(pid) });
  const { data: panels = [] } = useQuery({ queryKey: ['panels'], queryFn: listPanels });
  const { data: settings = {} } = useQuery({ queryKey: ['settings'], queryFn: getAllSettings });
  const { data: bill } = useQuery({ queryKey: ['bill', pid], queryFn: () => getBill(pid) });

  const isApproved = orders.length > 0 && orders.every(o => o.order.not_done || o.result?.approved_at);

  // Compute values
  const valuesMap: Record<string, number | null> = {};
  for (const o of orders) {
    if (o.result?.value) {
      const n = parseFloat(o.result.value);
      if (!isNaN(n)) valuesMap[o.test.code] = n;
    }
  }

  // Group by panel
  const panelMap: Record<string, { panel: typeof panels[0]; orders: typeof orders }> = {};
  for (const o of orders) {
    if (o.order.not_done) continue;
    const panelCode = o.test.panel_code ?? 'MISC';
    if (!panelMap[panelCode]) {
      const p = panels.find(p => p.code === panelCode);
      panelMap[panelCode] = { panel: p!, orders: [] };
    }
    panelMap[panelCode].orders.push(o);
  }
  const sortedPanels = Object.values(panelMap).filter(p => p.panel).sort((a, b) => a.panel.sort_order - b.panel.sort_order);

  function getResultValue(o: typeof orders[0]): string {
    if (o.test.result_type === 'calculated' && o.test.formula) {
      const calc = computeCalculated(o.test.code, o.test.formula, valuesMap);
      return calc != null ? calc.toFixed(o.test.decimals) : '';
    }
    return o.result?.value ?? '';
  }

  function getFlag(o: typeof orders[0]): string {
    if (!patient) return '';
    const value = getResultValue(o);
    if (!value) return '';
    const ageDays = patientAgeDays(patient.age, patient.age_unit);
    return computeFlag(o.test.result_type, value, o.ranges, patient.sex, ageDays);
  }

  function handlePrint() {
    window.print();
    logDelivery(pid, 'print', 'Printer', 'sent');
    setSent(s => ({ ...s, print: true }));
  }

  async function handleWhatsApp() {
    if (!patient?.phone) return;
    const tests = orders.map(o => o.test.name).join(', ');
    const msg = encodeURIComponent(
      `Dear ${patient.title} ${patient.name},\n\nYour report (${tests.substring(0, 80)}...) from SHARMA CLINICAL LABORATORY, Nangal Bhur is ready.\n\n— ${settings.technician_name ?? 'Lab Technician'}, ${settings.technician_qual ?? 'DMLT'}`
    );
    const url = `https://wa.me/91${patient.phone}?text=${msg}`;
    await open(url);
    await logDelivery(pid, 'whatsapp_semi', `91${patient.phone}`, 'sent');
    setSent(s => ({ ...s, whatsapp: true }));
  }

  if (!patient) return <div className="p-8 text-center text-gray-400">Loading…</div>;

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between print:hidden">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm">
          <ChevronLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-3">
          {!isApproved && (
            <span className="text-sm text-amber-600 flex items-center gap-1">
              <span className="w-2 h-2 bg-amber-400 rounded-full" /> Not yet approved
            </span>
          )}
          <button onClick={handlePrint} disabled={!isApproved}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40">
            <Printer size={15} /> {sent.print && <Check size={12} className="text-green-500" />} Print
          </button>
          <button onClick={handleWhatsApp} disabled={!isApproved || !patient.phone}
            className="flex items-center gap-2 bg-green-500 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-40">
            <MessageCircle size={15} /> {sent.whatsapp && <Check size={12} />} WhatsApp
          </button>
        </div>
      </div>

      {/* Report */}
      <div id="report-print-area" className="bg-white rounded-xl border border-gray-200 overflow-hidden max-w-[210mm] mx-auto print:border-none print:rounded-none" style={{ fontFamily: 'Georgia, serif' }}>
        {/* Header */}
        <div className="border-b-2 border-gray-800 p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-[#1e4fa3] flex items-center justify-center text-white font-bold text-lg">SCL</div>
              <div>
                <h1 className="text-2xl font-bold text-[#7b1b1b]" style={{ fontFamily: 'Georgia, serif' }}>
                  SHARMA CLINICAL LABORATORY
                </h1>
                <div className="border border-gray-600 px-2 py-0.5 mt-1 text-xs font-bold text-gray-700">
                  FULLY COMPUTERISED HI-TECH LAB.
                </div>
              </div>
            </div>
            <div className="text-right text-xs text-gray-700">
              <p className="font-bold">G.T. ROAD, VILLAGE NANGAL BHUR,</p>
              <p className="font-bold">TEH. & DISTT. PATHANKOT</p>
            </div>
          </div>
          <div className="flex justify-between items-end mt-3 text-xs text-gray-700">
            <div>
              <p><strong className="text-[#1e4fa3]">Mob: {settings.phones ?? '9646778583 / 9464148746'}</strong></p>
              <p className="mt-0.5">{settings.timings ?? 'Summer: 7:30 am to 9:00 pm | Winter: 8:15 am to 7:30 pm'}</p>
            </div>
            <div className="text-right italic">
              <p className="font-semibold">{settings.technician_name ?? 'Rajesh Kumar (Vicky)'}</p>
              <p>{settings.technician_qual ?? 'DMLT (PTU)'}</p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-300 text-xs text-gray-600">
            <strong>Equipped With</strong> {settings.equipment_line ?? 'ERBA H360 Blood Cell Counter, ERBA CHEM-5 PLUS Vz, EBRA Semi Auto Analyser, CHEM-7 & STAR 21 Semi Auto Analyser, Uri-plus 200 Urine Chemistry Analyser, Qua-lab Hba1c Analyser.'}
          </div>
        </div>

        {/* Patient block */}
        <div className="border-b border-gray-400 p-4 grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <p><strong>Name :</strong> {patient.title} {patient.name}</p>
            <p><strong>Age/Gender :</strong> {patient.age} {patient.age_unit} / {patient.sex === 'MALE' ? 'Male' : 'Female'}</p>
            <p><strong>Collected AT :</strong> {patient.collected_at}</p>
            <p><strong>Referred By :</strong> {patient.doctor_name ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <p><strong>Test Request ID :</strong> {patient.test_no}</p>
            <p><strong>Sample Collected ON :</strong> {formatDate(patient.sample_time)}</p>
            <p><strong>Sample Received ON :</strong> {formatDate(patient.sample_time)}</p>
            <p><strong>Report DATE :</strong> {formatDate(patient.report_time)}</p>
          </div>
        </div>

        {/* Results */}
        <div className="p-4 space-y-4">
          {sortedPanels.map(({ panel, orders: panelOrders }) => (
            <div key={panel.code}>
              <div className="text-center font-bold text-sm underline mb-2 text-gray-900 uppercase">{panel.report_heading}</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-400">
                    <th className="text-left py-1 pr-4 font-bold text-gray-800">Test Name</th>
                    <th className="text-left py-1 px-4 font-bold text-gray-800">Results</th>
                    <th className="text-left py-1 px-4 font-bold text-gray-800">Units</th>
                    <th className="text-left py-1 pl-4 font-bold text-gray-800">Normal Ranges</th>
                  </tr>
                </thead>
                <tbody>
                  {panelOrders.map(o => {
                    const value = getResultValue(o);
                    const flag = getFlag(o);
                    const range = o.ranges[0];
                    return (
                      <tr key={o.order.id} className="border-b border-gray-100">
                        <td className="py-1 pr-4 text-gray-900">{o.test.name}</td>
                        <td className={cn("py-1 px-4 tabular-nums font-mono", flag && "font-bold")}>{value || '—'}</td>
                        <td className="py-1 px-4 text-gray-700">{o.test.unit}</td>
                        <td className="py-1 pl-4 text-gray-700 text-xs">{range?.band_text ?? range?.range_text ?? ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Interpretation note for first test in panel */}
              {panelOrders[0]?.test.interpretation_note && (
                <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700 italic leading-relaxed">
                  {panelOrders[0].test.interpretation_note}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-400 p-4">
          <div className="flex justify-end mb-3">
            <div className="text-center">
              <div className="w-24 h-12 border border-gray-300 rounded flex items-center justify-center text-xs text-gray-400 mb-1">
                [Signature]
              </div>
              <p className="text-xs font-bold">Lab Technician</p>
            </div>
          </div>
          <div className="text-center text-sm font-bold mb-1">*** End Of Report ***</div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>NOT FOR MEDICO LEGAL PURPOSE</span>
            <span>ALL TEST ARE AVAILABLE HERE</span>
          </div>
          <div className="mt-2 text-center text-xs text-gray-500">
            {settings.footer_tests_line ?? 'T3, T4, TSH (THYROID), LH, FSH, PROLACTIN, TESTOSTERONE, ESTRADIOL, LFT, LIPID PROFILE, KIDNEY FUNCTION TEST\'S CULTURES, MALARIA ANTIGEN, TYPHOID ANTIBODIES TESTS AVAILABLES'}
          </div>
        </div>
      </div>
    </div>
  );
}
