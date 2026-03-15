"use client";

import { usePathname } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import {
  IconLayoutDashboard,
  IconNotebook,
  IconHistory,
  IconSettings,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconBell,
  IconLogout,
  IconUser,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const employeeNavItems = [
  {
    id: "dashboard",
    icon: <IconLayoutDashboard size={20} stroke={1.5} />,
    color: "text-blue-500",
    label: "Dashboard",
    href: "/",
  },
  {
    id: "applications",
    icon: <IconHistory size={20} stroke={1.5} />,
    color: "text-amber-500",
    label: "My Reports",
    href: "/applications",
  },
  {
    id: "chat",
    icon: <IconBell size={20} stroke={1.5} />,
    color: "text-purple-500",
    label: "WhatsApp Chat",
    href: "/chat",
  },
  {
    id: "settings",
    icon: <IconSettings size={20} stroke={1.5} />,
    color: "text-slate-400",
    label: "Settings",
    href: "/settings",
  },
];

const adminNavItems = [
  {
    id: "admin",
    icon: <IconLayoutDashboard size={20} stroke={1.5} />,
    color: "text-blue-500",
    label: "Overview",
    href: "/admin",
  },
  {
    id: "all-expenses",
    icon: <IconNotebook size={20} stroke={1.5} />,
    color: "text-emerald-500",
    label: "All Expenses",
    href: "/admin/expenses",
  },
  {
    id: "approvals",
    icon: <IconHistory size={20} stroke={1.5} />,
    color: "text-amber-500",
    label: "Approvals",
    href: "/admin/approvals",
  },
  {
    id: "employees",
    icon: <IconUser size={20} stroke={1.5} />,
    color: "text-indigo-500",
    label: "Employees",
    href: "/admin/employees",
  },
  {
    id: "reports",
    icon: <IconBell size={20} stroke={1.5} />,
    color: "text-rose-500",
    label: "Reports",
    href: "/admin/reports",
  },
  {
    id: "settings",
    icon: <IconSettings size={20} stroke={1.5} />,
    color: "text-slate-400",
    label: "Settings",
    href: "/settings",
  },
];

const SidebarDemo = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<"admin" | "employee">("employee");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/user/profile");
        const data = await res.json();
        if (res.ok) {
          setUser({
            ...data,
            user_metadata: {
              full_name: data.full_name,
              avatar_url: data.avatar_url,
            },
          });
          setRole(data.role || "employee");
        }
      } catch (err) {
        console.error("Error fetching user profile in sidebar:", err);
      }
    };
    fetchUser();
  }, []);

  const navItems = role === "admin" ? adminNavItems : employeeNavItems;
  const portalName = role === "admin" ? "Admin Portal" : "Employee Portal";

  const activeId =
    navItems.find(
      (item) =>
        pathname === item.href ||
        (item.href !== "/" &&
          item.href !== "/admin" &&
          pathname.startsWith(item.href)),
    )?.id || (role === "admin" ? "admin" : "dashboard");

  const isFullScreenPage =
    pathname.startsWith("/expenses/new") ||
    pathname.startsWith("/chat/fullscreen");

  if (isFullScreenPage) {
    return (
      <div className="h-screen w-full overflow-hidden bg-background">
        {children}
      </div>
    );
  }

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f8fafc] font-sans text-slate-900">
      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "relative bg-(--sidebar-bg) flex flex-col items-center py-6 shrink-0 transition-all duration-300",
          isCollapsed ? "w-(--sidebar-collapsed-width)" : "w-(--sidebar-width)",
        )}
      >
        {/* Edge collapse tab */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "absolute -right-3 top-1/2 -translate-y-1/2 z-50",
            "w-6 h-12",
            "bg-(--sidebar-item-active-bg)",
            "border border-(--sidebar-border) hover:border-(--accent-primary-hover)",
            "rounded-r-lg",
            "flex items-center justify-center",
            "text-white transition-all active:scale-95 shadow-lg",
          )}
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
            "mb-10 w-full flex items-center justify-center text-center px-4",
            isCollapsed ? "justify-center" : "justify-between",
          )}
        >
          <div className="flex items-center gap-3">
            {!isCollapsed && (
              <span className="text-[15px] font-bold tracking-tight text-white">
                Expify<span className="text-blue-400">.AI</span>
              </span>
            )}
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex flex-col gap-2 w-full px-3">
          {navItems.map((item) => {
            const isActive = activeId === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "group relative flex h-11 w-full items-center rounded-xl transition-all duration-150 px-4 gap-3 active:scale-[0.98]",
                  isActive
                    ? "bg-(--sidebar-item-active-bg) text-(--sidebar-text-active) shadow-(--sidebar-shadow)"
                    : "text-(--sidebar-text-inactive) hover:text-(--sidebar-text-active) hover:bg-(--sidebar-item-hover-bg)",
                )}
              >
                <span
                  className={cn(
                    "shrink-0 transition-transform group-hover:scale-105",
                    isActive ? "text-(--sidebar-icon-active)" : item.color,
                    isCollapsed && "mx-auto",
                  )}
                >
                  {item.icon}
                </span>

                {!isCollapsed && (
                  <span
                    className={cn(
                      "typo-nav-item",
                      isActive && "typo-nav-item-active",
                    )}
                  >
                    {item.label}
                  </span>
                )}

                {/* Tooltip when collapsed */}
                {isCollapsed && (
                  <div className="absolute left-full ml-3 px-3 py-2 bg-(--sidebar-bg) border border-(--sidebar-border) text-white text-[11px] font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 shadow-xl z-50">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User profile */}
        <div className="mt-auto w-full px-3 group/profile relative">
          <div
            className={cn(
              "w-full p-4 rounded-xl bg-(--sidebar-item-hover-bg) border border-(--sidebar-border) flex items-center gap-3",
              isCollapsed ? "justify-center" : "justify-between",
            )}
          >
            <div className="flex items-center gap-3">
              {user?.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt="Avatar"
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <div className="h-9 w-9 rounded-full bg-(--sidebar-border) flex items-center justify-center">
                  <IconUser
                    size={18}
                    className="text-(--sidebar-icon-inactive)"
                  />
                </div>
              )}

              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {user?.user_metadata?.full_name ||
                      user?.email?.split("@")[0] ||
                      "User"}
                  </p>
                  <p className="typo-overline text-(--sidebar-text-inactive)! tracking-widest! text-[9px]!">
                    {portalName}
                  </p>
                </div>
              )}
            </div>

            {/* Logout button appears on hover when expanded */}
            {!isCollapsed && (
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="opacity-0 group-hover/profile:opacity-100 transition-opacity p-2 hover:bg-(--sidebar-item-hover-bg) rounded-lg text-(--sidebar-icon-inactive) hover:text-red-400"
                title="Sign out"
              >
                <IconLogout size={16} />
              </button>
            )}
          </div>

          {/* Simple logout menu for collapsed state */}
          {isCollapsed && (
            <div className="absolute left-full bottom-0 ml-3 py-2 bg-(--sidebar-bg) border border-(--sidebar-border) text-white rounded-xl opacity-0 group-hover/profile:opacity-100 pointer-events-none group-hover/profile:pointer-events-auto transition-all duration-150 shadow-xl z-50 flex flex-col min-w-[120px]">
              <div className="px-4 py-2 border-b border-(--sidebar-border) mb-1">
                <p className="text-xs font-semibold truncate">
                  {user?.email?.split("@")[0]}
                </p>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 text-xs text-red-400 hover:bg-(--sidebar-item-hover-bg) transition-colors w-full text-left"
              >
                <IconLogout size={14} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Content area ── */}
      <main className="flex-1 flex flex-col bg-(--bg-secondary) overflow-hidden">
        {/* Header */}
        <header className="h-(--topbar-height,64px) px-8 flex items-center justify-between bg-(--bg-secondary) border-b border-(--border) shadow-sm shrink-0 z-40">
          <div>
            <h1 className="typo-h3 text-(--text-primary)">
              {navItems.find((i) => i.id === activeId)?.label || "Overview"}
            </h1>
            <p className="typo-caption text-(--text-muted)">
              {portalName} / {activeId}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group hidden md:block">
              <IconSearch
                size={18}
                stroke={2}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-(--text-muted) group-focus-within:text-(--accent-primary) transition-colors"
              />
              <input
                className="bg-(--bg-tertiary) border-none rounded-xl py-2 pl-10 pr-4 typo-body-default w-48 focus:w-64 focus:ring-2 focus:ring-(--border-focus)/20 focus:bg-white transition-all outline-none text-(--text-primary) placeholder:text-(--text-muted)"
                placeholder="Search..."
              />
            </div>

            <div className="hidden" />

            <button className="relative p-2.5 text-(--text-muted) hover:text-(--accent-primary) hover:bg-(--accent-primary-subtle) rounded-xl transition-all active:scale-95">
              <IconBell size={20} stroke={1.5} />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-(--accent-primary) rounded-full border-2 border-white" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          <div className="w-full h-full">{children}</div>
        </div>
      </main>
    </div>
  );
};

const Sidebar = (props: any) => (
  <Suspense
    fallback={
      <div className="flex h-screen w-full">
        <div className="w-[240px] bg-[#0f172a] h-full animate-pulse shrink-0" />
        <div className="flex-1 bg-white" />
      </div>
    }
  >
    <SidebarDemo {...props} />
  </Suspense>
);

export { Sidebar as SidebarDemo };
export default Sidebar;
