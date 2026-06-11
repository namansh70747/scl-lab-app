import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { searchPatients } from "@/lib/queries/patients";
import { Search, FileText, Printer } from "lucide-react";
import { formatDateTime, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PatientsPage() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ['patients-search', query],
    queryFn: () => searchPatients(query || ''),
    enabled: true,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, test number, or phone…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
          autoFocus
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Searching…</div>
        ) : patients.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Search size={32} className="mx-auto mb-2 opacity-40" />
            <p>{query ? 'No patients found' : 'Type to search patients'}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-6 py-3 text-left">Test No</th>
                <th className="px-6 py-3 text-left">Name</th>
                <th className="px-6 py-3 text-left">Age/Sex</th>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-left">Doctor</th>
                <th className="px-6 py-3 text-right">Amount</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {patients.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-mono font-medium">{p.test_no}</td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">{p.title} {p.name}</td>
                  <td className="px-6 py-3 text-xs text-gray-600">{p.age} {p.age_unit} / {p.sex === 'MALE' ? 'M' : 'F'}</td>
                  <td className="px-6 py-3 text-xs text-gray-500">{formatDateTime(p.registered_at).split(',')[0]}</td>
                  <td className="px-6 py-3 text-xs text-gray-500">{p.doctor_name ?? '—'}</td>
                  <td className="px-6 py-3 text-sm tabular-nums text-right">{formatCurrency(p.bill?.total ?? 0)}</td>
                  <td className="px-6 py-3">
                    <span className={cn("px-2 py-1 rounded-full text-xs font-medium",
                      p.status === 'approved' ? 'bg-green-100 text-green-700' :
                      p.status === 'results_pending' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'
                    )}>{p.status?.replace('_', ' ')}</span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex gap-3">
                      <button onClick={() => navigate(`/result-entry/${p.id}`)} className="text-xs text-maroon-600 hover:underline">Results</button>
                      <button onClick={() => navigate(`/report/${p.id}`)} className="text-xs text-blue-600 hover:underline">Report</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
