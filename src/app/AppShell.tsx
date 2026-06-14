import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useSession } from "@/lib/session";
import {
  LayoutDashboard, UserPlus, Users, FlaskConical, Stethoscope,
  BarChart3, Settings, LogOut, ChevronLeft, Menu, Search,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/app/CommandPalette";
import { KeyboardShortcuts } from "@/app/KeyboardShortcuts";
import { maybeDailyBackup } from "@/lib/backup";
import { NamAstaMark, NamAstaWordmark } from "@/components/common/NamAstaLogo";
import { getUserById } from "@/lib/queries/auth";
import { getLicenseStatus, type LicenseStatus } from "@/lib/license";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", key: "D" },
  { to: "/new-patient", icon: UserPlus, label: "New Patient", key: "N", primary: true },
  { to: "/patients", icon: Users, label: "Patients", key: "P" },
  { to: "/test-master", icon: FlaskConical, label: "Test Master", key: "T", adminOnly: true },
  { to: "/doctors", icon: Stethoscope, label: "Doctors", key: "R" },
  { to: "/reports", icon: BarChart3, label: "Reports", key: "B" },
  { to: "/settings", icon: Settings, label: "Settings", key: "S", adminOnly: true },
];

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard", "/new-patient": "New Patient", "/patients": "Patients",
  "/test-master": "Test Master", "/doctors": "Doctors", "/reports": "Reports", "/settings": "Settings",
};

export function AppShell() {
  const { user, logout, setUser } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  useEffect(() => { getLicenseStatus().then(setLicense).catch(() => {}); }, []);

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    void maybeDailyBackup();
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // Re-validate the persisted session against the DB on app open: if the user was
  // deactivated or deleted, sign them out; if their role changed, refresh it.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getUserById(user.id)
      .then(fresh => {
        if (cancelled) return;
        if (!fresh || fresh.active === 0) { logout(); navigate("/login"); }
        else if (fresh.role !== user.role) { setUser({ ...user, role: fresh.role }); }
      })
      .catch(() => { /* offline/db error — keep the cached session */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f3f4f8]">
      <KeyboardShortcuts onOpenPalette={() => setPaletteOpen(true)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* ───────── Sidebar — modern near-black command center with aurora glow ───────── */}
      <aside
        className={cn(
          "relative flex flex-col shrink-0 overflow-hidden transition-[width] duration-200 ease-out",
          collapsed ? "w-[72px]" : "w-[244px]"
        )}
        style={{ background: "linear-gradient(180deg, #14161f 0%, #0e0f16 55%, #0a0b10 100%)" }}
      >
        {/* aurora glow accents */}
        <div className="pointer-events-none absolute -top-28 -left-16 h-72 w-72 rounded-full bg-[#6366f1]/25 blur-3xl" />
        <div className="pointer-events-none absolute top-1/3 -right-20 h-64 w-64 rounded-full bg-[#7c3aed]/25 blur-3xl" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

        {/* brand */}
        <div className={cn("relative flex items-center gap-3 h-[64px] px-4", collapsed && "justify-center px-0")}>
          {collapsed
            ? <NamAstaMark size={34} />
            : <NamAstaWordmark size={34} light />
          }
        </div>

        <div className="relative mx-4 h-px bg-white/[0.07]" />

        {/* nav */}
        <nav className="relative flex-1 py-3 px-3 space-y-1 overflow-y-auto">
          {navItems.filter(i => !i.adminOnly || user?.role === "admin").map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) => cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-150",
                collapsed && "justify-center px-0",
                isActive
                  ? "text-white"
                  : "text-white/50 hover:text-white/90 hover:bg-white/[0.05]"
              )}
              style={({ isActive }) => isActive ? {
                background: "linear-gradient(120deg, rgba(99,102,241,0.22), rgba(123,27,27,0.18))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 6px 18px -10px rgba(99,102,241,0.6)",
              } : undefined}
            >
              {({ isActive }) => (
                <>
                  {/* active indicator bar */}
                  <span className={cn(
                    "absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-gradient-to-b from-[#818cf8] to-[#6366f1] transition-opacity",
                    isActive ? "opacity-100" : "opacity-0"
                  )} />
                  <item.icon size={17.5} strokeWidth={isActive ? 2.3 : 1.8} className={cn("shrink-0 transition-transform group-hover:scale-110", isActive && "text-[#c7cbff]")} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && item.primary && (
                    <kbd className="ml-auto text-[9.5px] font-semibold text-white/40 border border-white/15 rounded px-1 py-px">⌘{item.key}</kbd>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* user / collapse */}
        <div className="relative px-3 pb-3 space-y-1">
          <div className="mx-1.5 h-px bg-white/[0.07] mb-2.5" />
          <div className={cn("flex items-center gap-2.5 rounded-xl px-2 py-1.5", collapsed && "justify-center px-0")}>
            <div
              className="w-[32px] h-[32px] rounded-full flex items-center justify-center text-[12.5px] font-bold text-white shrink-0 shadow-[0_2px_8px_-2px_rgba(99,102,241,0.6)]"
              style={{ background: "linear-gradient(135deg, #6d74f5, #5b4be8 60%, #7c3aed)" }}
            >
              {user?.display_name?.[0]?.toUpperCase() ?? "U"}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-[12.5px] font-semibold text-white/90 truncate">{user?.display_name}</p>
                <p className="text-[10.5px] text-white/40 capitalize">{user?.role}</p>
              </div>
            )}
            <button
              onClick={() => { logout(); navigate("/login"); }}
              title="Sign out"
              className="p-1.5 rounded-lg text-white/40 hover:text-white/90 hover:bg-white/[0.08] transition-colors"
            >
              <LogOut size={14.5} />
            </button>
          </div>
          <button
            onClick={() => setCollapsed(c => !c)}
            className={cn(
              "w-full flex items-center gap-2 rounded-xl px-3 py-1.5 text-[11.5px] font-medium text-white/35 hover:text-white/70 hover:bg-white/[0.05] transition-colors",
              collapsed && "justify-center px-0"
            )}
          >
            {collapsed ? <Menu size={15} /> : <><ChevronLeft size={14} /> Collapse</>}
          </button>
        </div>
      </aside>

      {/* ───────── Workspace ───────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* topbar — frosted glass, sits above the page */}
        <header className="h-[60px] shrink-0 flex items-center gap-4 px-6 glass border-b border-black/[0.05] z-20">
          <h1 className="text-[15.5px] font-bold text-[#14151c] tracking-tight min-w-0 truncate">
            {PAGE_TITLES[location.pathname] ?? ""}
          </h1>

          <div className="flex-1" />

          <button
            onClick={() => setPaletteOpen(true)}
            className="group flex items-center gap-2.5 w-[320px] px-3.5 py-[8px] rounded-xl bg-white/80 text-[13px] text-[#9a9cab] border border-[#e6e7ee]
                       shadow-[0_1px_2px_rgba(20,21,28,0.04)] hover:border-[#c7c9ff] hover:shadow-[0_4px_14px_-4px_rgba(99,102,241,0.3)] transition-all"
          >
            <Search size={14.5} className="group-hover:text-[#6366f1] transition-colors" />
            <span className="flex-1 text-left">Search patients, tests…</span>
            <kbd className="text-[10px] font-semibold text-[#8a8b97] bg-[#eef0f4] rounded px-1.5 py-0.5">⌘K</kbd>
          </button>

          <div className="flex items-center gap-3 text-[12.5px] text-[#8a8b97]">
            {license?.daysLeft != null && license.daysLeft <= 14 && (
              <span
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium border bg-amber-50 border-amber-200 text-amber-700"
                title="Renew your NamAsta subscription to avoid interruption."
              >
                <span className="w-[7px] h-[7px] rounded-full bg-amber-400 animate-pulse" />
                {license.daysLeft <= 0 ? "Subscription expired" : `Renew in ${license.daysLeft}d`}
              </span>
            )}
            <span
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium border",
                online ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700"
              )}
              title={online ? "All local features working" : "Offline — deliveries will queue"}
            >
              <span className={cn("w-[7px] h-[7px] rounded-full", online ? "bg-emerald-500 animate-pulse" : "bg-amber-400")} />
              {online ? "Online" : "Offline"}
            </span>
            <span className="font-medium tabular-nums">
              {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </div>
        </header>

        {/* page */}
        <main className="flex-1 overflow-auto px-6 pb-8">
          <div className="max-w-[1240px] mx-auto animate-fade-up" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
