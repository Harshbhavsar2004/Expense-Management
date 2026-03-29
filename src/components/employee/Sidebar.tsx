"use client";

import { usePathname } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import {
  IconLayoutDashboard,
  IconHistory,
  IconMessageCircle,
  IconSettings,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconBell,
  IconLogout,
  IconUser,
  IconShieldCheck,
  IconCoin,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    id: "dashboard",
    icon: <IconLayoutDashboard size={18} stroke={1.8} />,
    label: "Dashboard",
    href: "/",
  },
  {
    id: "applications",
    icon: <IconHistory size={18} stroke={1.8} />,
    label: "My Reports",
    href: "/applications",
  },
  {
    id: "payouts",
    icon: <IconCoin size={18} stroke={1.8} />,
    label: "Payments",
    href: "/payouts",
  },
  {
    id: "chat",
    icon: <IconMessageCircle size={18} stroke={1.8} />,
    label: "Audit AI",
    href: "/chat",
  },
  {
    id: "policy",
    icon: <IconShieldCheck size={18} stroke={1.8} />,
    label: "Policy",
    href: "/policy",
  },
  {
    id: "settings",
    icon: <IconSettings size={18} stroke={1.8} />,
    label: "Settings",
    href: "/settings",
  },
];

function EmployeeSidebarInner({ children }: { children: React.ReactNode }) {
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
        console.error("Error fetching user profile:", err);
      }
    };
    fetchUser();
  }, []);

  const activeId =
    navItems.find(
      (item) =>
        pathname === item.href ||
        (item.href !== "/" && pathname.startsWith(item.href))
    )?.id || "dashboard";

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const activeLabel =
    navItems.find((i) => i.id === activeId)?.label || "Dashboard";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f1f5f9]">
      {/* ─── Sidebar ─── */}
      <aside
        style={{
          width: isCollapsed ? "68px" : "236px",
          transition: "width 280ms cubic-bezier(0.4, 0, 0.2, 1)",
          background: "linear-gradient(180deg, #0d1526 0%, #0f1c35 100%)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "4px 0 24px rgba(0,0,0,0.18)",
        }}
        className="relative flex flex-col shrink-0 overflow-hidden z-20"
      >
        {/* Subtle grid texture overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.025) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Collapse button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            position: "absolute",
            right: "-14px",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 50,
            width: "28px",
            height: "44px",
            background: "#2563eb",
            border: "1.5px solid #1d4ed8",
            borderRadius: "0 8px 8px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            cursor: "pointer",
            boxShadow: "2px 0 12px rgba(37,99,235,0.4)",
            transition: "background 150ms, transform 150ms",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "#1d4ed8")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "#2563eb")
          }
        >
          {isCollapsed ? (
            <IconChevronRight size={13} stroke={2.5} />
          ) : (
            <IconChevronLeft size={13} stroke={2.5} />
          )}
        </button>

        {/* Brand */}
        <div
          className="relative z-10 flex items-center px-4 pt-6 pb-5"
          style={{ minHeight: "72px" }}
        >
          {!isCollapsed ? (
            <div
              style={{
                opacity: 1,
                transition: "opacity 200ms 80ms",
              }}
            >
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  color: "#ffffff",
                  lineHeight: 1,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Expify
              </div>
              <div
                style={{
                  fontSize: "9px",
                  fontWeight: 600,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "rgba(148,163,184,0.6)",
                  marginTop: "4px",
                }}
              >
                by Fristine Infotech
              </div>
            </div>
          ) : (
            <div
              style={{
                width: "36px",
                height: "36px",
                background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(37,99,235,0.35)",
              }}
            >
              <span
                style={{
                  color: "white",
                  fontWeight: 800,
                  fontSize: "16px",
                  lineHeight: 1,
                }}
              >
                E
              </span>
            </div>
          )}
        </div>

        {/* Section label */}
        <div className="relative z-10 px-4 mb-2">
          {!isCollapsed ? (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "rgba(100,116,139,0.8)",
              }}
            >
              Employee Portal
            </span>
          ) : (
            <div
              style={{
                height: "1px",
                background: "rgba(255,255,255,0.06)",
                margin: "0 4px",
              }}
            />
          )}
        </div>

        {/* Nav items */}
        <nav className="relative z-10 flex flex-col gap-1 px-3 mt-1">
          {navItems.map((item) => {
            const isActive = activeId === item.id;
            return (
              <div key={item.id} className="relative group">
                <Link
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    height: "42px",
                    borderRadius: "10px",
                    padding: isCollapsed ? "0 12px" : "0 12px",
                    gap: "10px",
                    justifyContent: isCollapsed ? "center" : "flex-start",
                    textDecoration: "none",
                    position: "relative",
                    overflow: "hidden",
                    transition: "all 150ms cubic-bezier(0.4, 0, 0.2, 1)",
                    background: isActive
                      ? "linear-gradient(135deg, #2563eb, #3b82f6)"
                      : "transparent",
                    boxShadow: isActive
                      ? "0 4px 16px rgba(37,99,235,0.3), inset 0 1px 0 rgba(255,255,255,0.1)"
                      : "none",
                    color: isActive ? "#ffffff" : "rgba(148,163,184,0.85)",
                  }}
                  className={cn(
                    "nav-item",
                    !isActive && "hover:nav-item-hover"
                  )}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.06)";
                      e.currentTarget.style.color = "rgba(226,232,240,1)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "rgba(148,163,184,0.85)";
                    }
                  }}
                >
                  {/* Active left accent bar */}
                  {isActive && (
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: "8px",
                        bottom: "8px",
                        width: "3px",
                        background: "rgba(255,255,255,0.5)",
                        borderRadius: "0 3px 3px 0",
                      }}
                    />
                  )}

                  {/* Icon */}
                  <span
                    style={{
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {item.icon}
                  </span>

                  {/* Label */}
                  {!isCollapsed && (
                    <span
                      style={{
                        fontSize: "13.5px",
                        fontWeight: isActive ? 600 : 500,
                        letterSpacing: "-0.01em",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                      }}
                    >
                      {item.label}
                    </span>
                  )}
                </Link>

                {/* Tooltip when collapsed */}
                {isCollapsed && (
                  <div
                    style={{
                      position: "absolute",
                      left: "calc(100% + 12px)",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "#1e293b",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#e2e8f0",
                      fontSize: "12px",
                      fontWeight: 500,
                      padding: "6px 12px",
                      borderRadius: "8px",
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                      opacity: 0,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                      zIndex: 100,
                    }}
                    className="group-hover:opacity-100 transition-opacity duration-150"
                  >
                    {item.label}
                    <div
                      style={{
                        position: "absolute",
                        left: "-5px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: "8px",
                        height: "8px",
                        background: "#1e293b",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRight: "none",
                        borderTop: "none",
                        rotate: "45deg",
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Divider */}
        <div
          className="relative z-10 mx-4 mb-3"
          style={{ height: "1px", background: "rgba(255,255,255,0.07)" }}
        />

        {/* User profile */}
        <div className="relative z-10 px-3 pb-5">
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "12px",
              padding: isCollapsed ? "10px 8px" : "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              justifyContent: isCollapsed ? "center" : "space-between",
              transition: "background 150ms",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,0.07)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,0.04)")
            }
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "50%",
                  flexShrink: 0,
                  overflow: "hidden",
                  background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1.5px solid rgba(255,255,255,0.12)",
                }}
              >
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt="Avatar"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span
                    style={{
                      color: "white",
                      fontSize: "13px",
                      fontWeight: 700,
                    }}
                  >
                    {user?.full_name?.charAt(0).toUpperCase() || "?"}
                  </span>
                )}
              </div>

              {/* Name + Role */}
              {!isCollapsed && (
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#e2e8f0",
                      lineHeight: 1.2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {user?.full_name || "Employee"}
                  </p>
                  <p
                    style={{
                      fontSize: "11px",
                      color: "rgba(100,116,139,0.9)",
                      fontWeight: 500,
                      marginTop: "2px",
                    }}
                  >
                    Employee
                  </p>
                </div>
              )}
            </div>

            {/* Signout */}
            {!isCollapsed && (
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                title="Sign out"
                style={{
                  padding: "6px",
                  borderRadius: "8px",
                  background: "transparent",
                  border: "none",
                  color: "rgba(100,116,139,0.8)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 150ms",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "rgba(239,68,68,0.12)";
                  (e.currentTarget as HTMLElement).style.color = "#f87171";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "transparent";
                  (e.currentTarget as HTMLElement).style.color =
                    "rgba(100,116,139,0.8)";
                }}
              >
                <IconLogout size={15} stroke={2} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ─── Content Area ─── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header
          style={{
            height: "60px",
            background: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
            boxShadow: "0 1px 8px rgba(15,23,42,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 28px",
            flexShrink: 0,
            zIndex: 40,
          }}
        >
          {/* Page title */}
          <div>
            <h1
              style={{
                fontSize: "15px",
                fontWeight: 700,
                color: "#0f172a",
                lineHeight: 1.2,
                letterSpacing: "-0.01em",
              }}
            >
              {activeLabel}
            </h1>
            <p
              style={{
                fontSize: "11px",
                color: "#94a3b8",
                fontWeight: 500,
                marginTop: "2px",
                textTransform: "capitalize",
              }}
            >
              Employee Portal / {activeId}
            </p>
          </div>

          {/* Right controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Search */}
            <div
              className="hidden md:flex"
              style={{ position: "relative", alignItems: "center" }}
            >
              <IconSearch
                size={15}
                stroke={2}
                style={{
                  position: "absolute",
                  left: "12px",
                  color: "#94a3b8",
                  pointerEvents: "none",
                }}
              />
              <input
                style={{
                  background: "#f8fafc",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "8px 14px 8px 34px",
                  fontSize: "13px",
                  width: "196px",
                  outline: "none",
                  color: "#0f172a",
                  transition: "all 200ms",
                }}
                placeholder="Search..."
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#2563eb";
                  e.currentTarget.style.boxShadow =
                    "0 0 0 3px rgba(37,99,235,0.1)";
                  e.currentTarget.style.width = "240px";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.width = "196px";
                }}
              />
            </div>

            {/* Notifications */}
            <button
              style={{
                position: "relative",
                padding: "8px",
                borderRadius: "10px",
                background: "transparent",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 150ms",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "#eff6ff";
                (e.currentTarget as HTMLElement).style.color = "#2563eb";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "transparent";
                (e.currentTarget as HTMLElement).style.color = "#64748b";
              }}
            >
              <IconBell size={18} stroke={1.8} />
              <span
                style={{
                  position: "absolute",
                  top: "7px",
                  right: "7px",
                  width: "7px",
                  height: "7px",
                  background: "#2563eb",
                  borderRadius: "50%",
                  border: "1.5px solid white",
                }}
              />
            </button>

            {/* User chip */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "5px 12px 5px 6px",
                background: "#f8fafc",
                border: "1.5px solid #e2e8f0",
                borderRadius: "24px",
                cursor: "default",
              }}
            >
              <div
                style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    color: "white",
                    fontSize: "11px",
                    fontWeight: 700,
                  }}
                >
                  {user?.full_name?.charAt(0).toUpperCase() || "?"}
                </span>
              </div>
              <span
                style={{
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: "#334155",
                  maxWidth: "100px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user?.full_name?.split(" ")[0] || "Employee"}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div
          style={{ flex: 1, overflowY: "auto", background: "#f1f5f9" }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

export function EmployeeSidebar({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", height: "100vh", width: "100%" }}>
          <div
            style={{
              width: "236px",
              background: "linear-gradient(180deg, #0d1526 0%, #0f1c35 100%)",
              height: "100%",
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, background: "#f1f5f9" }} />
        </div>
      }
    >
      <EmployeeSidebarInner>{children}</EmployeeSidebarInner>
    </Suspense>
  );
}

export default EmployeeSidebar;