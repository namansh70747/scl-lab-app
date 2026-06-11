import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { UserPlus, Search, ListChecks, Clock } from "lucide-react";
import { getDashboardStats, getTodayPatients } from "@/lib/queries/patients";
import { getPendingDeliveries } from "@/lib/queries/delivery";
import { StatCards } from "./StatCards";
import { TodayPatientsTable } from "./TodayPatientsTable";
import { WaitingToSendTray } from "./WaitingToSendTray";

export function DashboardPage() {
  const navigate = useNavigate();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: getDashboardStats,
    refetchInterval: 30_000,
  });

  const { data: patients = [], isLoading: patientsLoading } = useQuery({
    queryKey: ["today-patients"],
    queryFn: getTodayPatients,
    refetchInterval: 30_000,
  });

  const { data: pending = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["pending-deliveries"],
    queryFn: getPendingDeliveries,
    refetchInterval: 30_000,
  });

  return (
    <div className="pt-4 space-y-4 animate-fade-up">
      {/* Header row: contextual greeting + primary action */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-[13px] text-[#8a857d]">
          <Greeting loading={patientsLoading} count={patients.length} />
        </p>
        <button onClick={() => navigate("/new-patient")} className="btn btn-primary">
          <UserPlus size={15} strokeWidth={1.8} />
          New Patient
        </button>
      </div>

      {/* Stat cards */}
      <StatCards stats={stats} loading={statsLoading} />

      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        <div className="lg:col-span-3">
          <TodayPatientsTable patients={patients} loading={patientsLoading} />
        </div>
        <div className="lg:col-span-2">
          <WaitingToSendTray rows={pending} loading={pendingLoading} />
        </div>
      </div>

      {/* Quick actions strip */}
      <div className="flex flex-wrap items-center gap-2">
        <QuickAction
          icon={<UserPlus size={15} strokeWidth={1.8} />}
          label="New Patient"
          onClick={() => navigate("/new-patient")}
        />
        <QuickAction
          icon={<ListChecks size={15} strokeWidth={1.8} />}
          label="Today's List"
          onClick={() => navigate("/patients")}
        />
        <QuickAction
          icon={<Search size={15} strokeWidth={1.8} />}
          label="Search"
          hint="⌘K"
          onClick={() => navigate("/patients")}
        />
        <QuickAction
          icon={<Clock size={15} strokeWidth={1.8} />}
          label="Pending Results"
          onClick={() => navigate("/patients")}
        />
      </div>
    </div>
  );
}

function Greeting({ loading, count }: { loading: boolean; count: number }) {
  const now = new Date();
  const dateLine = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const patientLine = loading
    ? null
    : count === 0
      ? "no patients yet today"
      : `${count} patient${count === 1 ? "" : "s"} so far today`;
  return (
    <>
      {dateLine}
      {patientLine && <span className="text-[#a8a29b]"> · </span>}
      {patientLine}
    </>
  );
}

function QuickAction({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="btn btn-secondary px-3 py-1.5 text-[12.5px]">
      <span className="text-[#8a857d]">{icon}</span>
      {label}
      {hint && (
        <kbd className="text-[10px] font-semibold text-[#8a857d] bg-[#f1efec] rounded px-1.5 py-0.5">
          {hint}
        </kbd>
      )}
    </button>
  );
}
