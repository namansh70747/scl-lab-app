import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { dbQuery } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";
import { BarChart2, Download } from "lucide-react";

export function BizReportsPage() {
  const [tab, setTab] = useState<'daybook' | 'monthly' | 'doctorwise'>('daybook');
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: daybook = [] } = useQuery({
    queryKey: ['daybook', fromDate, toDate],
    queryFn: () => dbQuery<{ test_no: number; name: string; total: number; received: number; balance: number; registered_at: string }>(
      `SELECT p.test_no, p.name, b.total, b.received, b.balance, p.registered_at
       FROM patients p JOIN bills b ON b.patient_id=p.id
       WHERE date(p.registered_at,'localtime') BETWEEN ? AND ?
       ORDER BY p.registered_at`,
      [fromDate, toDate]
    ),
    enabled: tab === 'daybook',
  });

  const dayTotal = daybook.reduce((a, r) => ({ total: a.total + r.total, received: a.received + r.received, balance: a.balance + r.balance }), { total: 0, received: 0, balance: 0 });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reports</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['daybook', 'monthly', 'doctorwise'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}>
            {t === 'daybook' ? 'Day Book' : t === 'monthly' ? 'Monthly' : 'Doctor-wise'}
          </button>
        ))}
      </div>

      {/* Date filter */}
      <div className="flex gap-3 items-center">
        <label className="text-sm text-gray-600">From:</label>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
        <label className="text-sm text-gray-600">To:</label>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
      </div>

      {tab === 'daybook' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                <th className="px-6 py-3 text-left">Test No</th>
                <th className="px-6 py-3 text-left">Name</th>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-right">Total</th>
                <th className="px-6 py-3 text-right">Received</th>
                <th className="px-6 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {daybook.map(r => (
                <tr key={r.test_no}>
                  <td className="px-6 py-3 text-sm font-mono">{r.test_no}</td>
                  <td className="px-6 py-3 text-sm">{r.name}</td>
                  <td className="px-6 py-3 text-xs text-gray-500">{formatDate(r.registered_at)}</td>
                  <td className="px-6 py-3 text-sm tabular-nums text-right">{formatCurrency(r.total)}</td>
                  <td className="px-6 py-3 text-sm tabular-nums text-right text-green-600">{formatCurrency(r.received)}</td>
                  <td className="px-6 py-3 text-sm tabular-nums text-right text-red-600">{r.balance > 0 ? formatCurrency(r.balance) : '—'}</td>
                </tr>
              ))}
              {daybook.length > 0 && (
                <tr className="bg-gray-50 font-semibold">
                  <td colSpan={3} className="px-6 py-3 text-sm">Total ({daybook.length} patients)</td>
                  <td className="px-6 py-3 text-sm tabular-nums text-right">{formatCurrency(dayTotal.total)}</td>
                  <td className="px-6 py-3 text-sm tabular-nums text-right text-green-600">{formatCurrency(dayTotal.received)}</td>
                  <td className="px-6 py-3 text-sm tabular-nums text-right text-red-600">{formatCurrency(dayTotal.balance)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
