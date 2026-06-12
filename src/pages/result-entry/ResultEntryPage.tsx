import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPatientById } from "@/lib/queries/patients";
import { getOrdersWithResults, saveResult, approvePatient, markNotDone, unlockResult, getReportComment, saveReportComment } from "@/lib/queries/results";
import { listPanels } from "@/lib/queries/tests";
import { useSession } from "@/lib/session";
import { OrderWithResult, Panel } from "@/types";
import { computeCalculated } from "@/lib/calc";
import { computeFlag, patientAgeDays, findRange, displayRange } from "@/lib/flags";
import { getAllSettings } from "@/lib/queries/settings";
import { readAnalyzer } from "@/lib/serial";
import { matchToOrders, type AnalyzerMatch, type AnalyzerReading } from "@/lib/astm";
import { saveHistograms } from "@/lib/queries/analyzer";
import { cn } from "@/lib/utils";
import { Check, CheckCircle, ChevronLeft, FileText, Unlock, X, Cable } from "lucide-react";

export function ResultEntryPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const pid = parseInt(patientId ?? '0');
  const navigate = useNavigate();
  const user = useSession(s => s.user);
  const can = useSession(s => s.can);
  const qc = useQueryClient();
  const [showApprove, setShowApprove] = useState(false);
  const [comment, setComment] = useState('');
  const [localValues, setLocalValues] = useState<Record<number, string>>({});
  const [reading, setReading] = useState(false);
  const [analyzer, setAnalyzer] = useState<{ matches: AnalyzerMatch[]; reading: AnalyzerReading } | null>(null);

  const { data: patient } = useQuery({ queryKey: ['patient', pid], queryFn: () => getPatientById(pid) });
  const { data: orders = [] } = useQuery({ queryKey: ['orders', pid], queryFn: () => getOrdersWithResults(pid) });
  const { data: panels = [] } = useQuery({ queryKey: ['panels'], queryFn: listPanels });
  const { data: savedComment } = useQuery({ queryKey: ['comment', pid], queryFn: () => getReportComment(pid) });
  const { data: settings = {} } = useQuery({ queryKey: ['settings'], queryFn: getAllSettings });

  // Init local values from saved results
  useEffect(() => {
    const init: Record<number, string> = {};
    for (const o of orders) {
      if (o.result?.value) init[o.order.id] = o.result.value;
      else if (o.test.default_value) init[o.order.id] = o.test.default_value;
    }
    setLocalValues(init);
  }, [orders]);

  useEffect(() => { if (savedComment != null) setComment(savedComment); }, [savedComment]);

  const isApproved = orders.length > 0 && orders.every(o => o.order.not_done || o.result?.approved_at);

  // Group orders by panel (bundle rows are billing artifacts — never shown here)
  const visibleOrders = orders.filter(o => !o.test.is_panel);
  const panelMap: Record<string, { panel: Panel; orders: OrderWithResult[] }> = {};
  for (const o of visibleOrders) {
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
    mutationFn: async () => {
      // Flush EVERY value first — including pre-filled defaults the user never
      // touched and a snapshot of calculated values — so approval locks exactly
      // what is on screen (patient-safety: report can never differ from entry).
      for (const o of orders) {
        if (o.order.not_done || o.test.is_panel) continue;
        const value = getDisplayValue(o);
        if (!value.trim()) continue;
        if (o.result?.value === value && o.result?.approved_at) continue;
        if (o.result?.value !== value || !o.result) {
          await saveResult(o.order.id, value, getFlag(o), user!.id);
        }
      }
      await saveReportComment(pid, comment);
      await approvePatient(pid, user!.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders', pid] });
      qc.invalidateQueries({ queryKey: ['patient', pid] });
      qc.invalidateQueries({ queryKey: ['comment', pid] });
      setShowApprove(false);
      navigate(`/report/${pid}`);
    },
    onError: (e) => alert(String(e)),
  });

  const unlockMut = useMutation({
    mutationFn: async () => {
      const reason = window.prompt('Reason for unlocking this approved report (audit-logged):');
      if (!reason) throw new Error('cancelled');
      for (const o of orders) {
        if (o.result?.approved_at) await unlockResult(o.order.id, reason, user!.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders', pid] });
      qc.invalidateQueries({ queryKey: ['patient', pid] });
    },
    onError: (e) => { if (String(e).includes('cancelled')) return; alert(String(e)); },
  });

  // F9 = approve (only when not already approved)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'F9' && !isApproved && allHaveValues) { e.preventDefault(); setShowApprove(true); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  // Esc closes the approve dialog (per DESIGN.md dialog spec)
  useEffect(() => {
    if (!showApprove) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowApprove(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [showApprove]);

  const handleBlur = (o: OrderWithResult) => {
    if (o.test.result_type === 'calculated') return;
    const value = localValues[o.order.id] ?? '';
    if (!value) return;
    const flag = getFlag(o);
    saveMut.mutate({ orderId: o.order.id, value, flag });
  };

  async function readFromAnalyzer() {
    if (!settings.analyzer_port) {
      alert('No analyzer port is configured. Set it in Settings → Analyzer.');
      return;
    }
    setReading(true);
    try {
      const r = await readAnalyzer(settings.analyzer_port, Number(settings.analyzer_baud || '9600'), 8000);
      const matches = matchToOrders(r, orders, localValues);
      if (!matches.length) {
        alert('Data was received but none of the parameters matched this patient\'s ordered tests. Use Settings → Analyzer → Capture raw to check the format.');
        return;
      }
      setAnalyzer({ matches, reading: r });
    } catch (e) {
      alert(String(e));
    } finally {
      setReading(false);
    }
  }

  async function applyAnalyzer() {
    if (!analyzer) return;
    const next = { ...localValues };
    for (const m of analyzer.matches) next[m.orderId] = m.incoming;
    setLocalValues(next);
    // Persist each imported value, with its freshly-computed flag.
    for (const m of analyzer.matches) {
      const o = orders.find(x => x.order.id === m.orderId);
      if (!o) continue;
      const ageDays = patient ? patientAgeDays(patient.age, patient.age_unit) : 0;
      const flag = patient ? computeFlag(o.test.result_type, m.incoming, o.ranges, patient.sex, ageDays) : '';
      await saveResult(m.orderId, m.incoming, flag, user!.id);
    }
    await saveHistograms(pid, analyzer.reading.histograms);
    qc.invalidateQueries({ queryKey: ['orders', pid] });
    setAnalyzer(null);
  }

  const activeOrders = visibleOrders.filter(o => !o.order.not_done);
  const allHaveValues = activeOrders.every(o => {
    if (o.test.result_type === 'calculated') return true;
    return (localValues[o.order.id] ?? '').trim() !== '';
  });

  const progress = activeOrders.filter(o => localValues[o.order.id] || o.test.result_type === 'calculated').length;
  const total = activeOrders.length;
  const notDoneOrders = orders.filter(o => o.order.not_done && !o.test.is_panel);

  return (
    <div className="space-y-4">
      {/* Sticky header strip */}
      <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-[#f8f7f5]/95 backdrop-blur border-b border-[#e7e5e1]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => navigate(-1)} className="btn btn-ghost !px-1.5 shrink-0" title="Back">
              <ChevronLeft size={17} strokeWidth={1.8} />
            </button>
            {patient && (
              <div className="min-w-0">
                <div className="flex items-baseline gap-2.5 min-w-0">
                  <span className="font-mono text-[12.5px] text-[#8a857d] shrink-0">#{patient.test_no}</span>
                  <span className="font-semibold text-[15px] text-[#1a1a1e] truncate">{patient.title} {patient.name}</span>
                  <span className="text-[12.5px] text-[#5d5953] shrink-0">
                    {patient.age} {patient.age_unit} / {patient.sex === 'MALE' ? 'M' : 'F'}
                  </span>
                  {patient.doctor_name && (
                    <span className="text-[12.5px] text-[#8a857d] truncate">Ref: {patient.doctor_name}</span>
                  )}
                </div>
                <div className="flex items-center gap-2.5 mt-1.5">
                  <div className="w-36 h-[2px] rounded-full bg-[#e7e5e1] overflow-hidden">
                    <div
                      className="h-full bg-maroon-600 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-[#8a857d] tabular-nums">{progress}/{total} entered</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            {isApproved ? (
              <>
                {can('unlock_results') && (
                  <button
                    onClick={() => unlockMut.mutate()}
                    disabled={unlockMut.isPending}
                    className="btn btn-secondary !text-[#92600a] !border-[#eedcb3] hover:!bg-[#fdf6e3]"
                  >
                    <Unlock size={15} strokeWidth={1.8} /> Unlock
                  </button>
                )}
                <button onClick={() => navigate(`/report/${pid}`)} className="btn btn-primary">
                  <FileText size={15} strokeWidth={1.8} /> View Report
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={readFromAnalyzer}
                  disabled={reading}
                  title="Read CBC results from the ERBA H360 analyzer"
                  className="btn btn-secondary"
                >
                  <Cable size={15} strokeWidth={1.8} /> {reading ? 'Reading…' : 'Read from analyzer'}
                </button>
                <button
                  onClick={() => setShowApprove(true)}
                  disabled={!allHaveValues}
                  title={!allHaveValues ? 'Enter all results, or mark missing tests "not done"' : undefined}
                  className="btn btn-success"
                >
                  <CheckCircle size={15} strokeWidth={1.8} /> Approve
                  <kbd className="text-[10px] font-semibold bg-white/20 rounded px-1.5 py-0.5">F9</kbd>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Panel sections */}
      {sortedPanels.map(({ panel, orders: panelOrders }) => (
        <div key={panel.code} className="card overflow-hidden animate-fade-up">
          <div className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a857d] bg-[#faf9f7] border-b border-[#f1efec]">
            {panel.report_heading}
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#f1efec]">
                <th className="px-5 py-3 text-left table-head">Test Name</th>
                <th className="px-5 py-3 text-left table-head w-44">Result</th>
                <th className="px-5 py-3 text-left table-head w-24">Unit</th>
                <th className="px-5 py-3 text-left table-head">Normal Range</th>
                <th className="px-5 py-3 text-left table-head w-20">Flag</th>
                <th className="px-5 py-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {panelOrders.map(o => {
                const flag = getFlag(o);
                const isCalc = o.test.result_type === 'calculated';
                const displayVal = getDisplayValue(o);
                const approved = !!o.result?.approved_at;
                const range = patient ? findRange(o.ranges, patient.sex, patientAgeDays(patient.age, patient.age_unit)) : o.ranges[0];

                return (
                  <tr
                    key={o.order.id}
                    className={cn(
                      "group border-b border-[#f6f5f3] last:border-0 transition-colors",
                      o.order.not_done ? "opacity-40" : "hover:bg-[#faf9f7]",
                      flag && !o.order.not_done && "bg-[#fdf6f6]"
                    )}
                  >
                    <td className="px-5 py-2.5 text-[15px] text-[#1a1a1e]">{o.test.name}</td>
                    <td className="px-5 py-2.5">
                      {o.order.not_done ? (
                        <span className="text-[12px] text-[#a8a29b] italic">Not done</span>
                      ) : isCalc ? (
                        <span className="inline-flex w-32 items-center justify-end gap-1.5">
                          <span className={cn(
                            "text-[14px] tabular-nums text-right",
                            flag === 'H' && "text-[#b91c1c] font-semibold",
                            flag === 'L' && "text-[#1d4ed8] font-semibold",
                            !flag && "text-[#1a1a1e]"
                          )}>
                            {displayVal || '—'}
                          </span>
                          <span className="chip chip-gray !px-1.5 !py-0 !text-[10px]">auto</span>
                        </span>
                      ) : o.test.result_type === 'choice' ? (
                        <select
                          value={localValues[o.order.id] ?? o.test.default_value ?? ''}
                          onChange={e => setLocalValues(prev => ({ ...prev, [o.order.id]: e.target.value }))}
                          onBlur={() => handleBlur(o)}
                          disabled={approved}
                          className={cn(
                            "field !w-36 !py-1.5 text-[13.5px]",
                            flag && "!border-[#fca5a5] !text-[#b91c1c] font-semibold"
                          )}
                        >
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
                          className={cn(
                            "field !w-32 !py-1.5 text-right tabular-nums text-[14px]",
                            flag === 'H' && "!border-[#fca5a5] !text-[#b91c1c] font-semibold",
                            flag === 'L' && "!border-[#93c5fd] !text-[#1d4ed8] font-semibold"
                          )}
                        />
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-[12.5px] text-[#8a857d]">{o.test.unit}</td>
                    <td className="px-5 py-2.5 text-[12.5px] text-[#8a857d] tabular-nums">
                      {displayRange(range) || (range?.band_text ? <span className="italic">{range.band_text.split(' / ')[0]}</span> : '')}
                    </td>
                    <td className="px-5 py-2.5">
                      <span className="inline-flex items-center gap-1.5">
                        {flag && (
                          <span className={cn(
                            "chip",
                            flag === 'H' && "chip-red",
                            flag === 'L' && "chip-blue",
                            flag === 'A' && "chip-amber"
                          )}>{flag}</span>
                        )}
                        {approved && <Check size={14} strokeWidth={2.2} className="text-[#14743a]" aria-label="Approved" />}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {!o.order.not_done && (
                        <button
                          onClick={() => markNotDone(o.order.id).then(() => qc.invalidateQueries({ queryKey: ['orders', pid] }))}
                          className="text-[#a8a29b] opacity-0 group-hover:opacity-100 transition-opacity hover:text-[#b91c1c]"
                          title="Mark not done"
                        >
                          <X size={14} strokeWidth={1.8} />
                        </button>
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
      <div className="card p-5">
        <label className="block text-[12.5px] font-medium text-[#5d5953] mb-1.5">Comments (printed on report)</label>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          onBlur={() => saveReportComment(pid, comment).then(() => qc.invalidateQueries({ queryKey: ['comment', pid] }))}
          rows={3}
          placeholder="Optional comments for the report…"
          className="field resize-y"
        />
      </div>

      {/* Analyzer review dialog — staff confirm before values touch the patient */}
      {analyzer && (
        <div
          className="fixed inset-0 z-50 bg-[#1a1208]/40 backdrop-blur-[2px] animate-fade-in flex items-center justify-center p-4"
          onClick={() => setAnalyzer(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg p-6 animate-scale-in shadow-[var(--shadow-pop)]"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-[16px] font-semibold text-[#1a1a1e] mb-1">Values from analyzer</h3>
            <p className="text-[13px] text-[#5d5953] mb-3">
              Review the {analyzer.matches.length} matched parameter{analyzer.matches.length !== 1 ? 's' : ''}. Applying overwrites the current values.
            </p>
            <div className="max-h-72 overflow-auto rounded-xl border border-[#f1efec]">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#f1efec] bg-[#faf9f7]">
                    <th className="px-3 py-2 text-left table-head">Test</th>
                    <th className="px-3 py-2 text-right table-head w-24">Current</th>
                    <th className="px-3 py-2 text-right table-head w-24">Analyzer</th>
                  </tr>
                </thead>
                <tbody>
                  {analyzer.matches.map(m => (
                    <tr key={m.orderId} className="border-b border-[#f6f5f3] last:border-0">
                      <td className="px-3 py-1.5 text-[#1a1a1e]">{m.testName}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-[#a8a29b]">{m.current || '—'}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-[#1a1a1e]">{m.incoming}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(analyzer.reading.histograms.wbc || analyzer.reading.histograms.rbc || analyzer.reading.histograms.plt) && (
              <p className="text-[12px] text-[#14743a] mt-3">✓ Histogram curves captured — they will print on the report.</p>
            )}
            <div className="flex gap-2.5 justify-end mt-5">
              <button onClick={() => setAnalyzer(null)} className="btn btn-secondary">Cancel</button>
              <button onClick={applyAnalyzer} className="btn btn-primary">Apply {analyzer.matches.length} value{analyzer.matches.length !== 1 ? 's' : ''}</button>
            </div>
          </div>
        </div>
      )}

      {/* Approve confirm dialog */}
      {showApprove && (
        <div
          className="fixed inset-0 z-50 bg-[#1a1208]/40 backdrop-blur-[2px] animate-fade-in flex items-center justify-center p-4"
          onClick={() => setShowApprove(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-6 animate-scale-in shadow-[var(--shadow-pop)]"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-[16px] font-semibold text-[#1a1a1e] mb-2">Approve report?</h3>
            <p className="text-[13.5px] text-[#5d5953] leading-relaxed mb-3">
              <span className="tabular-nums">{total}</span> test{total !== 1 ? 's' : ''} entered. Once approved, results are{' '}
              <strong className="text-[#1a1a1e]">locked</strong> (only an Admin can unlock) and the report is ready to print &amp; deliver.
            </p>
            {notDoneOrders.length > 0 && (
              <div className="rounded-xl bg-[#faf9f7] border border-[#f1efec] px-3.5 py-2.5 mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a857d] mb-1.5">Excluded — not done</p>
                <ul className="space-y-0.5">
                  {notDoneOrders.map(o => (
                    <li key={o.order.id} className="text-[12.5px] text-[#5d5953]">{o.test.name}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2.5 justify-end mt-5">
              <button onClick={() => setShowApprove(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={() => approveMut.mutate()} disabled={approveMut.isPending} className="btn btn-success">
                {approveMut.isPending ? 'Approving…' : 'Approve & View Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
