import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useSession } from "@/lib/session";
import {
  LayoutDashboard, UserPlus, Users, FlaskConical, Stethoscope,
  BarChart2, Settings, LogOut, ChevronLeft, Menu
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", shortcut: "g d" },
  { to: "/new-patient", icon: UserPlus, label: "New Patient", shortcut: "g n", primary: true },
  { to: "/patients", icon: Users, label: "Patients", shortcut: "g p" },
  { to: "/test-master", icon: FlaskConical, label: "Test Master", shortcut: "g t" },
  { to: "/doctors", icon: Stethoscope, label: "Doctors", shortcut: "g r" },
  { to: "/reports", icon: BarChart2, label: "Reports", shortcut: "g b" },
  { to: "/settings", icon: Settings, label: "Settings", shortcut: "g s" },
];

export function AppShell() {
  const { user, logout } = useSession();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col bg-white border-r border-gray-200 transition-all duration-200 shrink-0",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo area */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-200">
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-maroon-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                SCL
              </div>
              <span className="text-sm font-semibold text-gray-900 truncate">SCL Lab</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="ml-auto p-1.5 rounded hover:bg-gray-100 text-gray-500"
          >
            {collapsed ? <Menu size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-maroon-50 text-maroon-700 border-l-2 border-maroon-600 ml-[-2px]"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                item.primary && !isActive && "bg-maroon-600 text-white hover:bg-maroon-700"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={18} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-gray-200 p-3">
          <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 shrink-0">
              {user?.display_name?.[0] ?? 'A'}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-900 truncate">{user?.display_name}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
            )}
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              title="Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 shrink-0">
          <div className="flex-1" />
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{new Date().toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short', year:'numeric' })}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
