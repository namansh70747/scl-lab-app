import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPatientById, getBill } from "@/lib/queries/patients";
import { getOrdersWithResults, saveResult, approvePatient, markNotDone } from "@/lib/queries/results";
import { listPanels } from "@/lib/queries/tests";
import { useSession } from "@/lib/session";
import { OrderWithResult, Panel } from "@/types";
import { computeCalculated } from "@/lib/calc";
import { computeFlag, patientAgeDays } from "@/lib/flags";
import { cn } from "@/lib/utils";
import { CheckCircle, ChevronLeft, ChevronRight, FileText, AlertTriangle } from "lucide-react";

export function ResultEntryPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const pid = parseInt(patientId ?? '0');
  const navigate = useNavigate();
  const user = useSession(s => s.user);
  const qc = useQueryClient();
  const [showApprove, setShowApprove] = useState(false);
  const [comment, setComment] = useState('');
  const [localValues, setLocalValues] = useState<Record<number, string>>({});

  const { data: patient } = useQuery({ queryKey: ['patient', pid], queryFn: () => getPatientById(pid) });
  const { data: orders = [] } = useQuery({ queryKey: ['orders', pid], queryFn: () => getOrdersWithResults(pid) });
  const { data: panels = [] } = useQuery({ queryKey: ['panels'], queryFn: listPanels });

  // Init local values from saved results
  useEffect(() => {
    const init: Record<number, string> = {};
    for (const o of orders) {
      if (o.result?.value) init[o.order.id] = o.result.value;
      else if (o.test.default_value) init[o.order.id] = o.test.default_value;
    }
    setLocalValues(init);
  }, [orders]);

  const isApproved = orders.length > 0 && orders.every(o => o.order.not_done || o.result?.approved_at);

  // Group orders by panel
  const panelMap: Record<string, { panel: Panel; orders: OrderWithResult[] }> = {};
  for (const o of orders) {
    const panelCode = o.test.panel_code ?? 'MISC';
    if (!panelMap[panelCode]) {
      const p = panels.find(p => p.code === panelCode);
      panelMap[panelCode] = { panel: p ?? { id: 0, code: panelCode, name: panelCode, report_heading: panelCode, sort_order: 99, page_break_after: 0 }, orders: [] };
    }
    panelMap[panelCode].orders.push(o);
  }
  const sortedPanels = Object.values(panelMap).sort((a, b) => a.panel.sort_order - b.panel.sort_order);

  // Compute values map for calculated fields
  const valuesMap: Record<string, number | null> = {};
  for (const o of orders) {
    const v = localValues[o.order.id] ?? '';
    const n = parseFloat(v);
    if (!isNaN(n)) valuesMap[o.test.code] = n;
  }

  const getDisplayValue = (o: OrderWithResult): string => {
    if (o.test.result_type === 'calculated' && o.test.formula) {
      const calc = computeCalculated(o.test.code, o.test.formula, valuesMap);
      return calc != null ? calc.toFixed(o.test.decimals) : '';
    }
    return localValues[o.order.id] ?? '';
  };

  const getFlag = (o: OrderWithResult): string => {
    if (!patient) return '';
    const value = getDisplayValue(o);
    if (!value) return '';
    const ageDays = patientAgeDays(patient.age, patient.age_unit);
    return computeFlag(o.test.result_type, value, o.ranges, patient.sex, ageDays);
  };

  const saveMut = useMutation({
    mutationFn: ({ orderId, value, flag }: { orderId: number; value: string; flag: string }) =>
      saveResult(orderId, value, flag, user!.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders', pid] }),
  });

  const approveMut = useMutation({
    mutationFn: () => approvePatient(pid, user!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders', pid] });
      qc.invalidateQueries({ queryKey: ['patient', pid] });
      setShowApprove(false);
      navigate(`/report/${pid}`);
    },
  });

  const handleBlur = (o: OrderWithResult) => {
    if (o.test.result_type === 'calculated') return;
    const value = localValues[o.order.id] ?? '';
    if (!value) return;
    const flag = getFlag(o);
    saveMut.mutate({ orderId: o.order.id, value, flag });
  };

  const allHaveValues = orders.filter(o => !o.order.not_done).every(o => {
    if (o.test.result_type === 'calculated') return true;
    return (localValues[o.order.id] ?? '').trim() !== '';
  });

  const progress = orders.filter(o => !o.order.not_done && (localValues[o.order.id] || o.test.result_type === 'calculated')).length;
  const total = orders.filter(o => !o.order.not_done).length;

  return (
    <div className="space-y-4">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 -mx-6 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">
              <ChevronLeft size={20} />
            </button>
            {patient && (
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-gray-500">#{patient.test_no}</span>
                  <span className="font-semibold text-gray-900">{patient.title} {patient.name}</span>
                  <span className="text-sm text-gray-500">{patient.age} {patient.age_unit} / {patient.sex === 'MALE' ? 'M' : 'F'}</span>
                  {patient.doctor_name && <span className="text-xs text-gray-400">Ref: {patient.doctor_name}</span>}
                </div>
                {/* Progress bar */}
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-32 h-1.5 bg-gray-200 rounded-full">
                    <div className="h-1.5 bg-green-500 rounded-full transition-all" style={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs text-gray-500">{progress}/{total} entered</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isApproved ? (
              <button onClick={() => navigate(`/report/${pid}`)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                <FileText size={15} /> View Report
              </button>
            ) : (
              <button onClick={() => setShowApprove(true)} disabled={!allHaveValues}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed">
                <CheckCircle size={15} /> Approve (F9)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Panel sections */}
      {sortedPanels.map(({ panel, orders: panelOrders }) => (
        <div key={panel.code} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">{panel.report_heading}</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-xs font-medium text-gray-500 border-b border-gray-100">
                <th className="px-6 py-2 text-left w-64">Test Name</th>
                <th className="px-6 py-2 text-left w-48">Result</th>
                <th className="px-6 py-2 text-left w-24">Unit</th>
                <th className="px-6 py-2 text-left">Normal Range</th>
                <th className="px-6 py-2 text-left w-16">Flag</th>
                <th className="px-6 py-2 w-16" />
              </tr>
            </thead>
            <tbody>
              {panelOrders.map(o => {
                const flag = getFlag(o);
                const isCalc = o.test.result_type === 'calculated';
                const displayVal = getDisplayValue(o);
                const approved = !!o.result?.approved_at;
                const range = o.ranges[0];

                return (
                  <tr key={o.order.id} className={cn("border-b border-gray-50 last:border-0",
                    o.order.not_done && "opacity-40",
                    flag && "bg-red-50"
                  )}>
                    <td className="px-6 py-2.5 text-sm text-gray-900">{o.test.name}</td>
                    <td className="px-6 py-2.5">
                      {o.order.not_done ? (
                        <span className="text-xs text-gray-400 italic">Not done</span>
                      ) : isCalc ? (
                        <span className={cn("text-sm font-mono tabular-nums", flag === 'H' && "text-red-600 font-bold", flag === 'L' && "text-blue-600 font-bold")}>
                          {displayVal || '—'}
                        </span>
                      ) : o.test.result_type === 'choice' ? (
                        <select
                          value={localValues[o.order.id] ?? o.test.default_value ?? ''}
                          onChange={e => setLocalValues(prev => ({ ...prev, [o.order.id]: e.target.value }))}
                          onBlur={() => handleBlur(o)}
                          disabled={approved}
                          className={cn("px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-maroon-500",
                            flag ? "border-red-300 bg-red-50" : "border-gray-200",
                            approved && "bg-gray-50 cursor-not-allowed"
                          )}>
                          <option value="">—</option>
                          {(JSON.parse(o.test.choices ?? '[]') as string[]).map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={o.test.result_type === 'numeric' ? 'number' : 'text'}
                          value={localValues[o.order.id] ?? ''}
                          onChange={e => setLocalValues(prev => ({ ...prev, [o.order.id]: e.target.value }))}
                          onBlur={() => handleBlur(o)}
                          disabled={approved}
                          className={cn("px-2 py-1 border rounded text-sm tabular-nums w-32 focus:outline-none focus:ring-1 focus:ring-maroon-500",
                            flag === 'H' && "border-red-400 bg-red-50 font-bold text-red-700",
                            flag === 'L' && "border-blue-400 bg-blue-50 font-bold text-blue-700",
                            !flag && "border-gray-200",
                            approved && "bg-gray-50 cursor-not-allowed"
                          )}
                        />
                      )}
                    </td>
                    <td className="px-6 py-2.5 text-xs text-gray-500">{o.test.unit}</td>
                    <td className="px-6 py-2.5 text-xs text-gray-500">
                      {range?.band_text ? (
                        <span className="text-xs text-gray-400 italic">{range.band_text.split(' / ')[0]}</span>
                      ) : range?.range_text ?? ''}
                    </td>
                    <td className="px-6 py-2.5">
                      {flag && (
                        <span className={cn("px-1.5 py-0.5 rounded text-xs font-bold",
                          flag === 'H' && "bg-red-100 text-red-700",
                          flag === 'L' && "bg-blue-100 text-blue-700",
                          flag === 'A' && "bg-amber-100 text-amber-700"
                        )}>{flag}</span>
                      )}
                      {approved && <span className="ml-1 text-green-500" title="Approved">✓</span>}
                    </td>
                    <td className="px-6 py-2.5 text-right">
                      {!o.order.not_done && (
                        <button onClick={() => markNotDone(o.order.id).then(() => qc.invalidateQueries({ queryKey: ['orders', pid] }))}
                          className="text-xs text-gray-300 hover:text-gray-500" title="Mark not done">✕</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* Comments */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Comments (printed on report)</label>
        <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Optional comments for the report…"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500" />
      </div>

      {/* Approve modal */}
      {showApprove && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold text-gray-900 mb-2">Approve Report?</h3>
            <p className="text-sm text-gray-600 mb-4">Once approved, results will be locked and the report will be ready to print and deliver.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowApprove(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={() => approveMut.mutate()} disabled={approveMut.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60">
                {approveMut.isPending ? 'Approving…' : 'Approve & View Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
