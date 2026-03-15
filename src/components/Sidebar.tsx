import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ReceiptText, BarChart3, Settings, LogOut } from "lucide-react";

const NAV_ITEMS = [
  { id: "dashboard", icon: LayoutDashboard, label: "Overview", href: "/" },
  { id: "expenses",  icon: ReceiptText, label: "Claims", href: "/expenses" },
  { id: "analytics", icon: BarChart3, label: "Insights", href: "/analytics" },
  { id: "settings",  icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar({ active }: { active?: string }) {
  const pathname = usePathname();

  return (
    <aside
      id="main-sidebar"
      style={{
        width: "var(--sidebar-width)",
        minWidth: "var(--sidebar-width)",
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "24px 0",
        height: "100vh",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      {/* Brand Logo */}
      <div
        style={{
          width: "42px",
          height: "42px",
          borderRadius: "var(--radius-md)",
          background: "var(--accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          marginBottom: "36px",
          boxShadow: "0 4px 12px var(--accent-glow)",
        }}
      >
        <ReceiptText size={22} strokeWidth={2.5} />
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", alignItems: "center" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              title={item.label}
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "var(--radius-md)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: isActive ? "var(--accent-light)" : "transparent",
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                transition: "all var(--transition)",
                position: "relative",
                textDecoration: "none",
              }}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              
              {isActive && (
                <div
                  style={{
                    position: "absolute",
                    right: "-1px",
                    width: "3px",
                    height: "20px",
                    background: "var(--accent)",
                    borderRadius: "4px 0 0 4px",
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Logout / User */}
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "12px" }}>
        <button
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "var(--radius-md)",
            border: "none",
            background: "transparent",
            color: "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all var(--transition)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          <LogOut size={20} />
        </button>
      </div>
    </aside>
  );
}
