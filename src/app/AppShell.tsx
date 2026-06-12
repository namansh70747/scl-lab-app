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
import { BrandLogo } from "@/components/common/SCLLogo";
import { useQuery } from "@tanstack/react-query";
import { getAllSettings } from "@/lib/queries/settings";

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
  const { user, logout } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const { data: settings = {} } = useQuery({ queryKey: ["settings"], queryFn: getAllSettings });

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    void maybeDailyBackup();
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f7f5]">
      <KeyboardShortcuts onOpenPalette={() => setPaletteOpen(true)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* ───────── Sidebar — deep SCL maroon, the brand anchor ───────── */}
      <aside
        className={cn(
          "relative flex flex-col shrink-0 transition-[width] duration-200 ease-out",
          collapsed ? "w-[68px]" : "w-[232px]"
        )}
        style={{ background: "linear-gradient(180deg, #2b0e0e 0%, #240c0c 55%, #1d0909 100%)" }}
      >
        {/* brand */}
        <div className={cn("flex items-center gap-3 h-[60px] px-4", collapsed && "justify-center px-0")}>
          <BrandLogo src={settings.logo_data} height={collapsed ? 26 : 30} chip />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <p className="text-[13px] font-bold text-white/95 truncate tracking-wide">Sharma Clinical</p>
              <p className="text-[10.5px] text-white/45 font-medium tracking-[0.14em] uppercase">Laboratory</p>
            </div>
          )}
        </div>

        <div className="mx-4 h-px bg-white/[0.08]" />

        {/* nav */}
        <nav className="flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto">
          {navItems.filter(i => !i.adminOnly || user?.role === "admin").map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) => cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors duration-100",
                collapsed && "justify-center px-0",
                isActive
                  ? "bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  : "text-white/55 hover:text-white/90 hover:bg-white/[0.05]"
              )}
            >
              {({ isActive }) => (
                <>
                  {/* active indicator bar */}
                  <span className={cn(
                    "absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-[#e8b4b4] transition-opacity",
                    isActive ? "opacity-100" : "opacity-0"
                  )} />
                  <item.icon size={17} strokeWidth={isActive ? 2.2 : 1.8} className="shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && item.primary && (
                    <kbd className="ml-auto text-[9.5px] font-semibold text-white/35 border border-white/15 rounded px-1 py-px">⌘{item.key}</kbd>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* user / collapse */}
        <div className="px-2.5 pb-3 space-y-1">
          <div className="mx-1.5 h-px bg-white/[0.08] mb-2" />
          <div className={cn("flex items-center gap-2.5 rounded-lg px-2 py-1.5", collapsed && "justify-center px-0")}>
            <div className="w-7.5 h-7.5 w-[30px] h-[30px] rounded-full bg-white/12 flex items-center justify-center text-[12px] font-bold text-white/85 shrink-0">
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
              className="p-1.5 rounded-md text-white/40 hover:text-white/90 hover:bg-white/[0.08] transition-colors"
            >
              <LogOut size={14.5} />
            </button>
          </div>
          <button
            onClick={() => setCollapsed(c => !c)}
            className={cn(
              "w-full flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11.5px] font-medium text-white/35 hover:text-white/70 hover:bg-white/[0.05] transition-colors",
              collapsed && "justify-center px-0"
            )}
          >
            {collapsed ? <Menu size={15} /> : <><ChevronLeft size={14} /> Collapse</>}
          </button>
        </div>
      </aside>

      {/* ───────── Workspace ───────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* topbar */}
        <header className="h-[60px] shrink-0 flex items-center gap-4 px-6 bg-[#f8f7f5]">
          <h1 className="text-[15px] font-semibold text-[#1a1a1e] tracking-tight min-w-0 truncate">
            {PAGE_TITLES[location.pathname] ?? ""}
          </h1>

          <div className="flex-1" />

          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2.5 w-[300px] px-3.5 py-[7px] rounded-[10px] bg-white text-[13px] text-[#a8a29b]
                       shadow-[0_1px_2px_rgba(26,22,18,0.05),0_0_0_1px_rgba(26,22,18,0.05)]
                       hover:shadow-[0_2px_6px_rgba(26,22,18,0.08),0_0_0_1px_rgba(26,22,18,0.07)] transition-shadow"
          >
            <Search size={14.5} />
            <span className="flex-1 text-left">Search patients, tests…</span>
            <kbd className="text-[10px] font-semibold text-[#8a857d] bg-[#f1efec] rounded px-1.5 py-0.5">⌘K</kbd>
          </button>

          <div className="flex items-center gap-3 text-[12.5px] text-[#8a857d]">
            <span
              className="flex items-center gap-1.5"
              title={online ? "All local features working" : "Offline — deliveries will queue"}
            >
              <span className={cn("w-[7px] h-[7px] rounded-full", online ? "bg-emerald-500" : "bg-amber-400")} />
              {online ? "Online" : "Offline"}
            </span>
            <span className="w-px h-4 bg-[#e7e5e1]" />
            <span className="font-medium">
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
