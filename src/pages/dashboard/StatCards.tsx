import { useNavigate } from "react-router-dom";
import { UserPlus, Clock, IndianRupee, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface DashboardStats {
  todayCount: number;
  pendingCount: number;
  approvedCount: number;
  todayCollection: number;
  balanceDue: number;
}

export function StatCards({ stats, loading }: { stats?: DashboardStats; loading: boolean }) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card p-5">
            <div className="h-9 w-9 animate-pulse rounded-[10px] bg-[#efedea]" />
            <div className="mt-4 h-7 w-20 animate-pulse rounded-lg bg-[#efedea]" />
            <div className="mt-2 h-3.5 w-28 animate-pulse rounded-lg bg-[#efedea]" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={<UserPlus size={16} strokeWidth={1.8} />}
        tint="bg-[#7b1b1b]/[0.08] text-maroon-600"
        label="Today's Patients"
        value={stats?.todayCount ?? 0}
        onClick={() => navigate("/patients")}
      />
      <StatCard
        icon={<Clock size={16} strokeWidth={1.8} />}
        tint="bg-[#b45309]/[0.08] text-[#b45309]"
        label="Reports Pending"
        value={stats?.pendingCount ?? 0}
        onClick={() => navigate("/patients")}
      />
      <StatCard
        icon={<IndianRupee size={16} strokeWidth={1.8} />}
        tint="bg-[#047857]/[0.08] text-[#047857]"
        label="Today's Collection"
        value={formatCurrency(stats?.todayCollection ?? 0)}
        onClick={() => navigate("/patients")}
      />
      <StatCard
        icon={<AlertCircle size={16} strokeWidth={1.8} />}
        tint="bg-[#1d4ed8]/[0.08] text-[#1d4ed8]"
        label="Balance Due"
        value={formatCurrency(stats?.balanceDue ?? 0)}
        onClick={() => navigate("/patients")}
      />
    </div>
  );
}

function StatCard({
  icon,
  tint,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode;
  tint: string;
  label: string;
  value: string | number;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="card card-hover p-5 text-left">
      <div className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${tint}`}>
        {icon}
      </div>
      <p className="mt-3.5 text-[26px] font-bold tracking-tight tabular-nums text-[#1a1a1e] leading-none transition-colors">
        {value}
      </p>
      <p className="mt-1.5 text-[12px] text-[#8a857d]">{label}</p>
    </button>
  );
}
