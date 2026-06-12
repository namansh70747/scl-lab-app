import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  ImageIcon,
  Printer,
  DatabaseBackup,
  Mail,
  MessageCircle,
  Smartphone,
  Cable,
  Users,
  SlidersHorizontal,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { getAllSettings } from "@/lib/queries/settings";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { ToastProvider } from "./toast";
import { LabIdentityTab } from "./tabs/LabIdentityTab";
import { BrandingTab } from "./tabs/BrandingTab";
import { PrintingTab } from "./tabs/PrintingTab";
import { BackupsTab } from "./tabs/BackupsTab";
import { EmailTab } from "./tabs/EmailTab";
import { WhatsAppTab } from "./tabs/WhatsAppTab";
import { SmsTab } from "./tabs/SmsTab";
import { AnalyzerTab } from "./tabs/AnalyzerTab";
import { UsersTab } from "./tabs/UsersTab";
import { SystemTab } from "./tabs/SystemTab";

type TabId = "identity" | "branding" | "printing" | "backups" | "email" | "whatsapp" | "sms" | "analyzer" | "users" | "system";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "identity", label: "Lab Identity", icon: Building2 },
  { id: "branding", label: "Branding", icon: ImageIcon },
  { id: "printing", label: "Printing", icon: Printer },
  { id: "backups", label: "Backups", icon: DatabaseBackup },
  { id: "email", label: "Email (SMTP)", icon: Mail },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "sms", label: "SMS", icon: Smartphone },
  { id: "analyzer", label: "Analyzer", icon: Cable },
  { id: "users", label: "Users", icon: Users },
  { id: "system", label: "System", icon: SlidersHorizontal },
];

export function SettingsPage() {
  const can = useSession((s) => s.can);
  const [tab, setTab] = useState<TabId>("identity");
  const { data: settings = {}, isLoading } = useQuery({ queryKey: ["settings"], queryFn: getAllSettings });

  if (!can("view_settings")) {
    return (
      <div className="pt-4">
        <div className="card p-6 max-w-[640px] py-14 text-center animate-fade-up">
          <div className="w-11 h-11 rounded-xl bg-[#f1efec] text-[#8a857d] flex items-center justify-center mx-auto mb-3">
            <Lock size={17} strokeWidth={1.8} />
          </div>
          <div className="text-[13.5px] font-semibold text-[#1a1a1e]">Admin only</div>
          <p className="text-[13.5px] text-[#8a857d] mt-1">
            You need administrator access to view or change settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="pt-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-6 items-start animate-fade-up">
          {/* Left tab rail */}
          <nav className="w-full md:w-56 shrink-0 flex md:flex-col gap-1 flex-wrap" aria-label="Settings sections">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13.5px] text-left transition-colors w-auto md:w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-maroon-400",
                    active
                      ? "bg-white shadow-[var(--shadow-card)] text-[#1a1a1e] font-semibold"
                      : "text-[#5d5953] hover:bg-[#f1efec]"
                  )}
                >
                  <Icon
                    size={16}
                    strokeWidth={active ? 2.2 : 1.8}
                    className={active ? "text-maroon-600" : "text-[#a8a29b]"}
                  />
                  {t.label}
                </button>
              );
            })}
          </nav>

          {/* Right panel */}
          <div className="flex-1 min-w-0 w-full">
            {isLoading ? (
              <div className="card p-6 max-w-[640px] space-y-3">
                <div className="animate-pulse rounded-lg bg-[#efedea] h-5 w-40" />
                <div className="animate-pulse rounded-lg bg-[#efedea] h-4 w-72" />
                <div className="animate-pulse rounded-lg bg-[#efedea] h-9 w-full" />
                <div className="animate-pulse rounded-lg bg-[#efedea] h-9 w-full" />
                <div className="animate-pulse rounded-lg bg-[#efedea] h-9 w-2/3" />
              </div>
            ) : (
              <>
                {tab === "identity" && <LabIdentityTab settings={settings} />}
                {tab === "branding" && <BrandingTab settings={settings} />}
                {tab === "printing" && <PrintingTab settings={settings} />}
                {tab === "backups" && <BackupsTab settings={settings} />}
                {tab === "email" && <EmailTab settings={settings} />}
                {tab === "whatsapp" && <WhatsAppTab settings={settings} />}
                {tab === "sms" && <SmsTab settings={settings} />}
                {tab === "analyzer" && <AnalyzerTab settings={settings} />}
                {tab === "users" && <UsersTab />}
                {tab === "system" && <SystemTab settings={settings} />}
              </>
            )}
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
