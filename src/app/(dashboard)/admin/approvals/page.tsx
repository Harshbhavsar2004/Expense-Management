"use client";

import { useEffect, useState, useMemo } from "react";
import { ExpenseRow } from "@/components/ExpensesTable";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Clock, AlertTriangle, ArrowLeft } from "lucide-react";

export default function ApprovalsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/applications/submitted")
      .then((r) => r.json())
      .then((d) => setApplications(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    return {
      pending: applications.length,
      totalValue: 0, // Could sum up application totals if available
    };
  }, [applications]);

  return (
    <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: "28px", maxWidth: "1400px" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "'DM Sans', sans-serif" }}>
          Pending Approvals
        </h2>
        <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)", fontFamily: "'Inter', sans-serif" }}>
          Review and approve employee expense claims
        </p>
      </div>

      {/* Back to Dashboard Button */}
      <button
        onClick={() => router.push("/admin")}
        style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "13px", fontWeight: 600, padding: 0 }}
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      {/* Summary Chips */}
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        {[
          // Note: 'expenses' is not defined in this component. Assuming it should be 'applications' or a derived state.
          // For now, using applications.length for 'Awaiting Review' and a placeholder for 'Flagged'.
          { label: "Awaiting Review", count: applications.length, color: "var(--warning)", bg: "var(--warning-bg)", icon: <Clock size={14} /> },
          { label: "Flagged", count: 0, color: "var(--danger)", bg: "var(--danger-bg)", icon: <AlertTriangle size={14} /> }, // Placeholder for flagged
        ].map((chip) => (
          <div key={chip.label} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", background: chip.bg, borderRadius: "9999px", border: `1px solid ${chip.color}30` }}>
            <span style={{ color: chip.color }}>{chip.icon}</span>
            <span style={{ fontSize: "13px", fontWeight: 600, color: chip.color, fontFamily: "'Inter', sans-serif" }}>
              {loading ? "—" : chip.count} {chip.label}
            </span>
          </div>
        ))}
      </div>

      {/* Claims list */}
      <div className="premium-card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 140px 140px 140px", gap: "16px", padding: "12px 20px", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'Inter', sans-serif" }}>
            <span>Application / User</span>
            <span>Date Submitted</span>
            <span>Client</span>
            <span>Location</span>
            <span>Actions</span>
          </div>

          {loading ? (
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1, 2, 3].map(i => <div key={i} className="shimmer" style={{ height: "56px", borderRadius: "8px" }} />)}
            </div>
          ) : applications.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <CheckCircle size={40} color="var(--success)" style={{ opacity: 0.4, marginBottom: "12px" }} />
              <p style={{ margin: 0, fontSize: "15px", color: "var(--text-muted)", fontFamily: "'Inter', sans-serif" }}>
                No pending applications for approval!
              </p>
            </div>
          ) : (
            applications.map((app) => (
              <div
                key={app.id}
                onClick={() => router.push(`/applications/${app.application_id}`)}
                style={{ display: "grid", gridTemplateColumns: "1fr 140px 140px 140px 140px", gap: "16px", padding: "14px 20px", borderBottom: "1px solid var(--border)", alignItems: "center", transition: "background 0.15s", cursor: "pointer" }}
                onMouseEnter={(ev) => (ev.currentTarget.style.background = "var(--bg-hover)")}
                onMouseLeave={(ev) => (ev.currentTarget.style.background = "transparent")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: "white", flexShrink: 0 }}>
                    {app.application_id.slice(-2)}
                  </div>
                  <div>
                    <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--accent)", fontFamily: "'Inter', sans-serif" }}>{app.application_id}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "'Inter', sans-serif" }}>{app.users?.full_name || app.user_phone}</div>
                  </div>
                </div>

                <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontFamily: "'Inter', sans-serif" }}>
                  {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString("en-IN") : "Unknown"}
                </span>

                <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", fontFamily: "'Inter', sans-serif" }}>
                  {app.client_name || "—"}
                </span>

                <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontFamily: "'Inter', sans-serif" }}>
                  {app.city || "—"}
                </span>

                <div style={{ display: "flex", gap: "6px" }}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); /* Logic handled in detail page */ }}
                    style={{ padding: "5px 12px", borderRadius: "6px", border: "1px solid var(--accent)", background: "var(--accent-light)", color: "var(--accent)", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    View Report
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
