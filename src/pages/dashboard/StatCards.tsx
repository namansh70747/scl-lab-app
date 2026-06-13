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

interface CardDef {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  grad: string;     // icon tile gradient
  glow: string;     // hover glow color
  spark: number[];  // decorative sparkbars
}

export function StatCards({ stats, loading }: { stats?: DashboardStats; loading: boolean }) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card p-5">
            <div className="skeleton h-10 w-10 rounded-xl" />
            <div className="skeleton mt-4 h-7 w-20" />
            <div className="skeleton mt-2 h-3.5 w-28" />
          </div>
        ))}
      </div>
    );
  }

  const cards: CardDef[] = [
    {
      icon: <UserPlus size={17} strokeWidth={2} />,
      label: "Today's Patients",
      value: stats?.todayCount ?? 0,
      grad: "linear-gradient(135deg,#6d74f5,#4f46e5)",
      glow: "rgba(99,102,241,0.35)",
      spark: [3, 5, 4, 7, 6, 9, 8],
    },
    {
      icon: <Clock size={17} strokeWidth={2} />,
      label: "Reports Pending",
      value: stats?.pendingCount ?? 0,
      grad: "linear-gradient(135deg,#f59e0b,#b45309)",
      glow: "rgba(180,83,9,0.32)",
      spark: [6, 4, 5, 3, 4, 2, 3],
    },
    {
      icon: <IndianRupee size={17} strokeWidth={2} />,
      label: "Today's Collection",
      value: formatCurrency(stats?.todayCollection ?? 0),
      grad: "linear-gradient(135deg,#10b981,#047857)",
      glow: "rgba(4,120,87,0.3)",
      spark: [4, 6, 5, 7, 8, 7, 9],
    },
    {
      icon: <AlertCircle size={17} strokeWidth={2} />,
      label: "Balance Due",
      value: formatCurrency(stats?.balanceDue ?? 0),
      grad: "linear-gradient(135deg,#93262d,#7b1b1b)",
      glow: "rgba(123,27,27,0.3)",
      spark: [2, 3, 2, 4, 3, 5, 4],
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c, i) => (
        <StatCard key={c.label} {...c} delay={i * 60} onClick={() => navigate("/patients")} />
      ))}
    </div>
  );
}

function StatCard({
  icon, label, value, grad, glow, spark, delay, onClick,
}: CardDef & { delay: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${delay}ms`, ["--glow" as string]: glow }}
      className="group card relative overflow-hidden p-5 text-left animate-pop-in opacity-0 [animation-fill-mode:forwards]
                 transition-all duration-300 hover:-translate-y-1
                 hover:shadow-[0_18px_40px_-12px_var(--glow),0_2px_6px_rgba(20,21,28,0.06),0_0_0_1px_rgba(20,21,28,0.05)]"
    >
      {/* corner sparkbars */}
      <div className="absolute right-4 top-5 flex items-end gap-[3px] h-9 opacity-50 group-hover:opacity-90 transition-opacity">
        {spark.map((h, idx) => (
          <span
            key={idx}
            className="w-[3.5px] rounded-full"
            style={{ height: `${h * 3.5}px`, background: grad }}
          />
        ))}
      </div>

      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-[0_4px_12px_-2px_var(--glow)]"
        style={{ background: grad }}
      >
        {icon}
      </div>
      <p className="mt-3.5 text-[27px] font-extrabold tracking-tight tabular-nums text-[#14151c] leading-none">
        {value}
      </p>
      <p className="mt-1.5 text-[12px] font-medium text-[#8a8b97]">{label}</p>
    </button>
  );
}
