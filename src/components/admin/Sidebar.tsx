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
  IconLogout,
  IconShieldCheck,
  IconCash,
  IconPlug,
  IconChartPie,
  IconStack2,
} from "@tabler/icons-react";
import { motion, AnimatePresence } from "framer-motion";

const SIDEBAR_BG = "#000D4D"; // Premium Midnight Blue

const navItems = [
  { id: "admin",          Icon: IconLayoutDashboard, label: "Overview",        href: "/admin" },
  { id: "approvals",      Icon: IconHistory,         label: "Applications",    href: "/admin/approvals" },
  { id: "policy",         Icon: IconShieldCheck,     label: "Policy",          href: "/admin/policy" },
  { id: "dashboards",     Icon: IconChartPie,        label: "Visual Insights", href: "/admin/dashboards" },
  { id: "integrations",   Icon: IconPlug,            label: "Integrations",    href: "/admin/connectors" },
  { id: "employees",      Icon: IconUsers,           label: "Employees",       href: "/admin/employees" },
  { id: "payouts",        Icon: IconCash,            label: "Payouts",         href: "/admin/payouts" },
  { id: "settings",       Icon: IconSettings,        label: "Settings",        href: "/settings" },
];

const FADE_EASE = { duration: 0.16, ease: [0.4, 0, 0.2, 1] as const };

function AdminSidebarInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
      (item) => pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))
    )?.id || "admin";

  const activeLabel = navItems.find((i) => i.id === activeId)?.label || "Overview";

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", overflow: "hidden", background: "#f7f9fb" }}>

      {/* ── Sidebar ── */}
      <aside
        id="admin-sidebar"
        style={{
          width: "256px",
          flexShrink: 0,
          background: SIDEBAR_BG,
          display: "flex",
          flexDirection: "column",
          paddingTop: "16px",
          paddingBottom: "32px",
          position: "relative",
          zIndex: 50,
          boxShadow: "4px 0 24px rgba(33,89,226,0.25)",
        }}
      >
        {/* ── Brand ── */}
        <div style={{ padding: "0 24px", marginBottom: "32px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "32px", height: "32px", flexShrink: 0,
            background: "rgba(255,255,255,0.2)",
            borderRadius: "8px",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid rgba(255,255,255,0.25)",
          }}>
            <IconStack2 size={16} stroke={2} color="white" />
          </div>
          <span style={{
            fontSize: "20px",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: "#ffffff",
            fontFamily: "var(--font-sans)",
            whiteSpace: "nowrap",
          }}>
            Expify
          </span>
        </div>

        {/* ── Portal Label ── */}
        <div style={{ padding: "0 24px", marginBottom: "16px" }}>
          <span style={{
            fontSize: "9px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            color: "rgba(255,255,255,0.35)",
          }}>
            Admin Portal
          </span>
        </div>

        {/* ── Nav ── */}
        <nav style={{ flex: 1, padding: "0 12px", display: "flex", flexDirection: "column", gap: "2px", overflowY: "auto" }}>
          {navItems.map((item, i) => {
            const isActive = activeId === item.id;
            const { Icon } = item;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...FADE_EASE, delay: i * 0.03 }}
              >
                <Link
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px 16px",
                    borderRadius: "9999px",
                    textDecoration: "none",
                    position: "relative",
                    background: isActive ? "rgba(255,255,255,0.18)" : "transparent",
                    color: isActive ? "#ffffff" : "rgba(255,255,255,0.65)",
                    fontWeight: isActive ? 600 : 500,
                    fontSize: "13px",
                    letterSpacing: "0.01em",
                    fontFamily: "var(--font-sans)",
                    transition: "background 140ms, color 140ms",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    boxShadow: isActive ? "inset 4px 0 0 rgba(255,255,255,0.9)" : "inset 4px 0 0 transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)";
                      (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.9)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.65)";
                    }
                  }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="admin-nav-accent"
                      style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: "9999px",
                        background: "rgba(255,255,255,0.18)",
                        zIndex: 0,
                      }}
                      transition={{ type: "spring", damping: 30, stiffness: 380 }}
                    />
                  )}

                  <span style={{ position: "relative", zIndex: 1, flexShrink: 0, display: "flex", alignItems: "center" }}>
                    <Icon size={18} stroke={isActive ? 2 : 1.8} />
                  </span>

                  <span style={{ position: "relative", zIndex: 1 }}>
                    {item.label}
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </nav>

        {/* ── Divider ── */}
        <div style={{ margin: "16px 20px 16px", height: "1px", background: "rgba(255,255,255,0.12)" }} />

        {/* ── User profile ── */}
        <div style={{ padding: "0 12px" }}>
          <div style={{
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "9999px",
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden", minWidth: 0 }}>
              {/* Avatar */}
              <div style={{
                width: "36px", height: "36px", borderRadius: "50%",
                flexShrink: 0, overflow: "hidden",
                background: "rgba(255,255,255,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "1.5px solid rgba(255,255,255,0.35)",
              }}>
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ color: "white", fontSize: "13px", fontWeight: 700 }}>
                    {user?.full_name?.charAt(0).toUpperCase() || "?"}
                  </span>
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <p style={{
                  fontSize: "12px", fontWeight: 700,
                  color: "#ffffff", lineHeight: 1.3,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  fontFamily: "var(--font-sans)",
                }}>
                  {user?.full_name || "Admin"}
                </p>
                <p style={{
                  fontSize: "9.5px", color: "rgba(255,255,255,0.55)", fontWeight: 600,
                  marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.12em",
                }}>
                  Administrator
                </p>
              </div>
            </div>

            <motion.button
              onClick={handleSignOut}
              disabled={isSigningOut}
              title="Sign out"
              style={{
                width: "30px", height: "30px", borderRadius: "50%",
                background: "transparent", border: "none",
                color: "rgba(255,255,255,0.55)", cursor: "pointer",
                flexShrink: 0,
              }}
              whileHover={{ color: "#fca5a5", background: "rgba(239,68,68,0.2)" }}
              transition={{ duration: 0.15 }}
            >
              <IconLogout size={15} stroke={2} />
            </motion.button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Topbar */}
        <header style={{
          height: "64px",
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(203,213,225,0.35)",
          boxShadow: "0 1px 6px rgba(15,23,42,0.04)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 32px", flexShrink: 0, zIndex: 40,
          position: "sticky", top: 0,
        }}>
          <nav style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#94a3b8", fontWeight: 500, letterSpacing: "0.02em" }}>
            <span>Portal</span>
            <span style={{ fontSize: "14px", color: "#cbd5e1", lineHeight: 1 }}>›</span>
            <span style={{ color: "#0f172a", fontWeight: 600 }}>{activeLabel}</span>
          </nav>

          {/* User chip */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "5px 14px 5px 6px", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "9999px" }}>
            <div style={{
              width: "28px", height: "28px", borderRadius: "50%",
              background: SIDEBAR_BG,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <span style={{ color: "white", fontSize: "11px", fontWeight: 700 }}>
                {user?.full_name?.charAt(0).toUpperCase() || "?"}
              </span>
            </div>
            <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#334155", maxWidth: "100px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.full_name?.split(" ")[0] || "Admin"}
            </span>
          </div>
        </header>

        {/* Page content */}
        <div style={{ flex: 1, overflowY: "auto", background: "#f7f9fb" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              style={{ height: "100%" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export function AdminSidebar({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", height: "100vh", width: "100%" }}>
          <div style={{ width: "256px", background: "#000D4D", height: "100%", flexShrink: 0 }} />
          <div style={{ flex: 1, background: "#f7f9fb" }} />
        </div>
      }
    >
      <AdminSidebarInner>{children}</AdminSidebarInner>
    </Suspense>
  );
}

export default AdminSidebar;
