"use client";

import { usePathname } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import {
  IconLayoutDashboard,
  IconNotebook,
  IconHistory,
  IconUsers,
  IconChartBar,
  IconSettings,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconBell,
  IconLogout,
  IconShield,
  IconShieldCheck,
  IconCash,
  IconPlug,
  IconChartPie,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    id: "admin",
    icon: <IconLayoutDashboard size={20} stroke={1.5} />,
    label: "Overview",
    href: "/admin",
  },
  {
    id: "all-expenses",
    icon: <IconNotebook size={20} stroke={1.5} />,
    label: "All Expenses",
    href: "/admin/expenses",
  },
  {
    id: "approvals",
    icon: <IconHistory size={20} stroke={1.5} />,
    label: "Approvals",
    href: "/admin/approvals",
  },
  {
    id: "employees",
    icon: <IconUsers size={20} stroke={1.5} />,
    label: "Employees",
    href: "/admin/employees",
  },
  {
    id: "reports",
    icon: <IconChartBar size={20} stroke={1.5} />,
    label: "Reports",
    href: "/admin/reports",
  },
  {
    id: "policy",
    icon: <IconShieldCheck size={20} stroke={1.5} />,
    label: "Policy",
    href: "/admin/policy",
  },
  {
    id: "dashboards",
    icon: <IconChartPie size={20} stroke={1.5} />,
    label: "Visual Insights",
    href: "/admin/dashboards",
  },
  {
    id: "payouts",
    icon: <IconCash size={20} stroke={1.5} />,
    label: "Payouts",
    href: "/admin/payouts",
  },
  {
    id: "integrations",
    icon: <IconPlug size={20} stroke={1.5} />,
    label: "Integrations",
    href: "/admin/connectors",
  },
  {
    id: "settings",
    icon: <IconSettings size={20} stroke={1.5} />,
    label: "Settings",
    href: "/settings",
  },
];

function AdminSidebarInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/user/profile");
        const data = await res.json();
        if (res.ok) setUser(data);
      } catch (err) {
        console.error("Error fetching admin profile:", err);
      }
    };
    fetchUser();
  }, []);

  const activeId =
    navItems.find(
      (item) =>
        pathname === item.href ||
        (item.href !== "/admin" && item.href !== "/" && pathname.startsWith(item.href))
    )?.id ||
    (pathname === "/admin" ? "admin" : "admin");

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const activeLabel = navItems.find((i) => i.id === activeId)?.label || "Overview";

  return (
    <div className="flex h-screen w-full overflow-hidden font-body text-slate-900" style={{ background: "var(--bg-secondary, #f4f5f7)" }}>
      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "relative flex flex-col items-center py-6 shrink-0 transition-all duration-300",
          isCollapsed ? "w-16" : "w-60"
        )}
        style={{ background: "var(--sidebar-bg, #1a1f36)" }}
      >
        {/* Collapse tab */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "absolute -right-3 top-1/2 -translate-y-1/2 z-50",
            "w-6 h-12 rounded-r-lg flex items-center justify-center",
            "text-white transition-all active:scale-95 shadow-lg"
          )}
          style={{ background: "#8B5CF6", border: "1px solid rgba(139,92,246,0.5)" }}
        >
          {isCollapsed ? (
            <IconChevronRight size={12} stroke={2} />
          ) : (
            <IconChevronLeft size={12} stroke={2} />
          )}
        </button>

        {/* Logo */}
        <div
          className={cn(
            "mb-6 w-full flex items-center px-6",
            isCollapsed ? "justify-center" : "justify-start"
          )}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg"
              style={{ background: "linear-gradient(135deg,#8B5CF6,#A78BFA)" }}
            >
              <span className="text-white font-bold text-lg leading-none">E</span>
            </div>
            {!isCollapsed && (
              <div>
                <span className="text-[18px] font-bold tracking-tight text-white font-outfit">
                  Expify<span className="text-zinc-500">.</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Portal label */}
        {!isCollapsed && (
          <div className="w-full px-4 mb-4">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Admin Portal
            </span>
          </div>
        )}

        {/* Nav */}
        <nav className="flex flex-col gap-1 w-full px-3">
          {navItems.map((item) => {
            const isActive = activeId === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "group relative flex h-10 w-full items-center rounded-lg transition-all duration-150 px-3 gap-3 active:scale-[0.98]",
                  isActive
                    ? "text-white"
                    : "hover:text-white"
                )}
                style={{
                  background: isActive
                    ? "linear-gradient(135deg,#8B5CF6,#A78BFA)"
                    : "transparent",
                  color: isActive ? "white" : "rgba(255,255,255,0.4)",
                  boxShadow: isActive ? "0 4px 12px rgba(139,92,246,0.3)" : "none",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = "transparent";
                }}
              >
                <span className={cn("shrink-0", isCollapsed && "mx-auto")}>
                  {item.icon}
                </span>

                {!isCollapsed && (
                  <span className="text-[14px] font-medium">{item.label}</span>
                )}

                {isCollapsed && (
                  <div
                    className="absolute left-full ml-3 px-3 py-1.5 text-white text-[12px] font-medium rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 shadow-xl z-50"
                    style={{ background: "#1a1f36", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User profile */}
        <div className="mt-auto w-full px-3">
          <div
            className={cn(
              "w-full py-3 px-3 rounded-lg flex items-center gap-3 transition-colors",
              isCollapsed ? "justify-center" : "justify-between"
            )}
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-white/10">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <div
                    className="h-full w-full flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg,#8B5CF6,#A78BFA)" }}
                  >
                    <span className="text-xs font-bold text-white">
                      {user?.full_name?.charAt(0).toUpperCase() || <IconShield size={16} />}
                    </span>
                  </div>
                )}
              </div>
              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-white truncate">
                    {user?.full_name || "Admin"}
                  </p>
                  <p className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>
                    Administrator
                  </p>
                </div>
              )}
            </div>

            {!isCollapsed && (
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="p-1.5 rounded-md transition-all active:scale-90"
                style={{ color: "rgba(255,255,255,0.3)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(239,68,68,0.12)";
                  e.currentTarget.style.color = "#f87171";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "rgba(255,255,255,0.3)";
                }}
                title="Sign out"
              >
                <IconLogout size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── Content area ── */}
      <main
        className="flex-1 flex flex-col overflow-hidden"
        style={{ background: "var(--bg-secondary, #f4f5f7)" }}
      >
        {/* Topbar */}
        <header
          className="h-16 px-8 flex items-center justify-between shrink-0 z-40"
          style={{
            background: "var(--bg-primary, #ffffff)",
            borderBottom: "1px solid var(--border, #e8eaed)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div>
            <div
              className="text-[13px]! font-semibold"
              style={{ color: "var(--text-primary, #0f172a)", fontFamily: "'Nunito', sans-serif" }}
            >
              {activeLabel}
            </div>
            <p
              className="text-[11px]! font-medium"
              style={{ color: "var(--text-muted, #94a3b8)", fontFamily: "'Inter', sans-serif" }}
            >
              Admin Portal / {activeId}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group hidden md:block">
              <IconSearch
                size={18}
                stroke={2}
                className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: "var(--text-muted, #94a3b8)" }}
              />
              <input
                className="rounded-xl py-2 pl-10 pr-4 text-sm w-48 focus:w-64 transition-all outline-none"
                style={{
                  background: "var(--bg-tertiary, #f4f5f7)",
                  border: "none",
                  color: "var(--text-primary, #0f172a)",
                }}
                placeholder="Search..."
              />
            </div>

            <button
              className="relative p-2.5 rounded-xl transition-all active:scale-95"
              style={{ color: "var(--text-muted, #94a3b8)" }}
            >
              <IconBell size={20} stroke={1.5} />
              <span
                className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full border-2 border-white"
                style={{ background: "#8B5CF6" }}
              />
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

export function AdminSidebar({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full">
          <div className="w-60 h-full animate-pulse shrink-0" style={{ background: "#1a1f36" }} />
          <div className="flex-1" style={{ background: "#f4f5f7" }} />
        </div>
      }
    >
      <AdminSidebarInner>{children}</AdminSidebarInner>
    </Suspense>
  );
}

export default AdminSidebar;
