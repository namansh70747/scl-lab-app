import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getDashboardStats, getTodayPatients } from "@/lib/queries/patients";
import { UserPlus, Search, Clock, CheckCircle, TrendingUp, IndianRupee, AlertCircle } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: stats } = useQuery({ queryKey: ['dashboard-stats'], queryFn: getDashboardStats, refetchInterval: 30_000 });
  const { data: patients = [] } = useQuery({ queryKey: ['today-patients'], queryFn: getTodayPatients, refetchInterval: 30_000 });

  const statusColor: Record<string, string> = {
    registered: 'bg-gray-100 text-gray-700',
    results_pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    delivered: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <button
          onClick={() => navigate('/new-patient')}
          className="flex items-center gap-2 bg-maroon-600 hover:bg-maroon-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <UserPlus size={16} />
          New Patient
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<UserPlus size={20} />} label="Today's Patients" value={stats?.todayCount ?? 0} color="text-maroon-600" />
        <StatCard icon={<Clock size={20} />} label="Results Pending" value={stats?.pendingCount ?? 0} color="text-amber-600" />
        <StatCard icon={<IndianRupee size={20} />} label="Today's Collection" value={formatCurrency(stats?.todayCollection ?? 0)} color="text-green-600" />
        <StatCard icon={<AlertCircle size={20} />} label="Balance Due" value={formatCurrency(stats?.balanceDue ?? 0)} color="text-red-600" />
      </div>

      {/* Quick actions */}
      <div className="flex gap-3">
        <button onClick={() => navigate('/new-patient')} className="flex items-center gap-2 bg-maroon-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-maroon-700">
          <UserPlus size={15} /> New Patient
        </button>
        <button onClick={() => navigate('/patients')} className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
          <Search size={15} /> Search Patient
        </button>
      </div>

      {/* Today's patients */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Today's Patients</h2>
        </div>
        {patients.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <UserPlus size={32} className="mx-auto mb-2 opacity-40" />
            <p>No patients registered today</p>
            <button onClick={() => navigate('/new-patient')} className="mt-3 text-maroon-600 text-sm hover:underline">
              Register first patient →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-6 py-3 text-left">Test No</th>
                  <th className="px-6 py-3 text-left">Name</th>
                  <th className="px-6 py-3 text-left">Time</th>
                  <th className="px-6 py-3 text-left">Doctor</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                  <th className="px-6 py-3 text-right">Balance</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {patients.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/result-entry/${p.id}`)}>
                    <td className="px-6 py-3 text-sm font-mono font-medium text-gray-900">{p.test_no}</td>
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{p.title} {p.name}</td>
                    <td className="px-6 py-3 text-xs text-gray-500">{formatDateTime(p.registered_at).split(',')[1]?.trim()}</td>
                    <td className="px-6 py-3 text-xs text-gray-500">{p.doctor_name ?? '—'}</td>
                    <td className="px-6 py-3 text-sm tabular-nums text-right">{formatCurrency(p.bill?.total ?? 0)}</td>
                    <td className="px-6 py-3 text-sm tabular-nums text-right text-red-600">{p.bill?.balance > 0 ? formatCurrency(p.bill.balance) : '—'}</td>
                    <td className="px-6 py-3">
                      <span className={cn("px-2 py-1 rounded-full text-xs font-medium", statusColor[p.status ?? 'registered'])}>
                        {p.status?.replace('_', ' ') ?? 'Registered'}
                      </span>
                    </td>
                    <td className="px-6 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <button onClick={() => navigate(`/result-entry/${p.id}`)} className="text-xs text-maroon-600 hover:underline">Results</button>
                        <button onClick={() => navigate(`/report/${p.id}`)} className="text-xs text-blue-600 hover:underline">Report</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className={cn("mb-3", color)}>{icon}</div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}
