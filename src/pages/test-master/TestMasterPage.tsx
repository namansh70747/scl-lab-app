import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listTests, listPanels, updateTestPrice, setTestEnabled, getTestRanges } from "@/lib/queries/tests";
import { Test, TestRange } from "@/types";
import { FlaskConical, Search, ChevronRight, Eye, EyeOff, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function TestMasterPage() {
  const qc = useQueryClient();
  const [panelFilter, setPanelFilter] = useState<string>('ALL');
  const [searchQ, setSearchQ] = useState('');
  const [reviewOnly, setReviewOnly] = useState(false);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [editingPrice, setEditingPrice] = useState<number | null>(null);
  const [priceVal, setPriceVal] = useState('');

  const { data: panels = [] } = useQuery({ queryKey: ['panels'], queryFn: listPanels });
  const { data: tests = [] } = useQuery({
    queryKey: ['tests', panelFilter],
    queryFn: () => listTests(panelFilter === 'ALL' ? undefined : panelFilter, false),
  });
  const { data: ranges = [] } = useQuery({
    queryKey: ['test-ranges', selectedTest?.id],
    queryFn: () => selectedTest ? getTestRanges(selectedTest.id) : Promise.resolve([]),
    enabled: !!selectedTest,
  });

  const filtered = tests.filter(t => {
    if (reviewOnly && !t.needs_review) return false;
    if (searchQ && !t.name.toLowerCase().includes(searchQ.toLowerCase()) && !t.code.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  const savePrice = useMutation({
    mutationFn: ({ id, price }: { id: number; price: number }) => updateTestPrice(id, price),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tests'] }); setEditingPrice(null); },
  });

  const toggleEnabled = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: number }) => setTestEnabled(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tests'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Test Master</h1>
        <label className="flex items-center gap-2 text-sm text-amber-700 cursor-pointer">
          <input type="checkbox" checked={reviewOnly} onChange={e => setReviewOnly(e.target.checked)} className="rounded" />
          Show needs-review only
        </label>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search tests…"
            className="pl-8 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 w-56" />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setPanelFilter('ALL')}
            className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-colors",
              panelFilter === 'ALL' ? "bg-maroon-600 text-white border-maroon-600" : "border-gray-300 text-gray-600 hover:bg-gray-50")}>
            All
          </button>
          {panels.map(p => (
            <button key={p.code} onClick={() => setPanelFilter(p.code)}
              className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                panelFilter === p.code ? "bg-maroon-600 text-white border-maroon-600" : "border-gray-300 text-gray-600 hover:bg-gray-50")}>
              {p.code}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Test list */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Unit</th>
                <th className="px-4 py-3 text-right">Price ₹</th>
                <th className="px-4 py-3 text-left">Panel</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(t => (
                <tr key={t.id}
                  onClick={() => setSelectedTest(t)}
                  className={cn("hover:bg-gray-50 cursor-pointer text-sm",
                    selectedTest?.id === t.id && "bg-maroon-50",
                    !t.enabled && "opacity-50",
                    t.needs_review && "bg-amber-50"
                  )}>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{t.code}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{t.name}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{t.unit}</td>
                  <td className="px-4 py-2.5 tabular-nums text-right" onClick={e => { e.stopPropagation(); setEditingPrice(t.id); setPriceVal(String(t.price)); }}>
                    {editingPrice === t.id ? (
                      <input type="number" value={priceVal} onChange={e => setPriceVal(e.target.value)}
                        onBlur={() => savePrice.mutate({ id: t.id, price: parseFloat(priceVal) || 0 })}
                        onKeyDown={e => { if (e.key === 'Enter') savePrice.mutate({ id: t.id, price: parseFloat(priceVal) || 0 }); if (e.key === 'Escape') setEditingPrice(null); }}
                        autoFocus className="w-20 px-2 py-1 border border-maroon-400 rounded text-sm text-right focus:outline-none" />
                    ) : (
                      <span className="cursor-pointer hover:text-maroon-600">₹{t.price}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{t.panel_code}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn("px-2 py-0.5 rounded-full text-xs", t.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                      {t.enabled ? 'Active' : 'Disabled'}
                    </span>
                    {t.needs_review ? <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">Review</span> : null}
                  </td>
                  <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                    <button onClick={() => toggleEnabled.mutate({ id: t.id, enabled: t.enabled ? 0 : 1 })}
                      className="text-gray-400 hover:text-gray-700">
                      {t.enabled ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {selectedTest && (
          <div className="w-72 bg-white rounded-xl border border-gray-200 p-5 space-y-4 shrink-0 self-start">
            <h3 className="font-semibold text-gray-900">{selectedTest.name}</h3>
            <div className="space-y-2 text-sm">
              <Detail label="Code" value={selectedTest.code} />
              <Detail label="Type" value={selectedTest.result_type} />
              <Detail label="Unit" value={selectedTest.unit || '—'} />
              <Detail label="Price" value={`₹${selectedTest.price}`} />
              {selectedTest.formula && <Detail label="Formula" value={selectedTest.formula} mono />}
              {selectedTest.default_value && <Detail label="Default" value={selectedTest.default_value} />}
            </div>

            {ranges.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Reference Ranges</p>
                <div className="space-y-1">
                  {ranges.map(r => (
                    <div key={r.id} className="text-xs bg-gray-50 rounded px-2 py-1.5">
                      <span className="font-medium text-gray-600">{r.sex === 'ANY' ? 'Both' : r.sex}: </span>
                      <span className="text-gray-800">{r.range_text || `${r.low ?? '—'} – ${r.high ?? '—'}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedTest.interpretation_note && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Interpretation</p>
                <p className="text-xs text-gray-600 leading-relaxed">{selectedTest.interpretation_note}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500">{label}</span>
      <span className={cn("text-gray-900 text-right", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}
