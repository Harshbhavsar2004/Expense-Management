"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle, XCircle, Clock, AlertTriangle, ArrowLeft,
  CheckCircle2, Send, RefreshCw, ExternalLink, IndianRupee,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Application {
  id: string;
  application_id: string;
  client_name: string;
  city: string;
  submitted_at: string;
  status: string;
  reimbursable_amount: number | null;
  flagged_count: number | null;
  payout_status: string | null;
  users: { full_name: string; email: string } | null;
}

interface PayoutConfig {
  auto_payout_enabled: boolean;
  fixed_amount: number;
}

// ── Payout status badge ───────────────────────────────────────────────────────

function PayoutBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const map: Record<string, { bg: string; color: string }> = {
    PENDING:  { bg: "#fef9c3", color: "#a16207" },
    SUCCESS:  { bg: "#dcfce7", color: "#15803d" },
    FAILURE:  { bg: "#fee2e2", color: "#b91c1c" },
    REVERSED: { bg: "#f3e8ff", color: "#7e22ce" },
  };
  const s = map[status] ?? { bg: "var(--bg-tertiary)", color: "var(--text-muted)" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "999px", fontSize: "10px", fontWeight: 700, background: s.bg, color: s.color, marginTop: "3px" }}>
      <IndianRupee size={9} /> {status}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading]           = useState(true);
  const [config, setConfig]             = useState<PayoutConfig | null>(null);
  // Per-row action state: { [applicationId]: "approving" | "rejecting" | null }
  const [actionState, setActionState]   = useState<Record<string, string | null>>({});

  const fetchApps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/applications/submitted");
      const d = await res.json();
      setApplications(Array.isArray(d) ? d : []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchApps();
    // Fetch payout config so we know if auto-payout is on
    fetch("/api/admin/payout-config")
      .then((r) => r.json())
      .then((d) => setConfig(d))
      .catch(() => {});
  }, [fetchApps]);

  const stats = useMemo(() => ({
    pending:  applications.length,
    flagged:  applications.reduce((s, a) => s + (a.flagged_count ?? 0), 0),
    totalVal: applications.reduce((s, a) => s + (a.reimbursable_amount ?? 0), 0),
  }), [applications]);

  const handleAction = async (app: Application, newStatus: "approved" | "rejected") => {
    setActionState((prev) => ({ ...prev, [app.application_id]: newStatus === "approved" ? "approving" : "rejecting" }));
    try {
      // 1. Update application status
      const res = await fetch(`/api/applications/${app.application_id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Status update failed");

      if (newStatus === "approved") {
        toast.success(`${app.application_id} approved.`);
        // 2. If auto-payout is enabled, trigger payout immediately
        if (config?.auto_payout_enabled) {
          const payoutRes = await fetch("/api/cashfree/initiate-payout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ applicationId: app.application_id, amount: config.fixed_amount }),
          });
          const payoutData = await payoutRes.json();
          if (payoutRes.ok) {
            toast.success(`₹${config.fixed_amount.toLocaleString("en-IN")} payout initiated automatically.`);
          } else {
            toast.error(`Approved, but payout failed: ${payoutData.error ?? "Unknown error"}. Go to Payouts to retry.`);
          }
        }
      } else {
        toast.success(`${app.application_id} rejected.`);
      }

      // Remove from list
      setApplications((prev) => prev.filter((a) => a.application_id !== app.application_id));
    } catch (err: any) {
      toast.error(err.message ?? "Action failed.");
    }
    setActionState((prev) => ({ ...prev, [app.application_id]: null }));
  };

  return (
    <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1400px" }}>

      {/* Header */}
      <div>
        <h2 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "'DM Sans', sans-serif" }}>
          Pending Approvals
        </h2>
        <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)" }}>
          Review and approve employee expense claims
          {config?.auto_payout_enabled && (
            <span style={{ marginLeft: "8px", padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: "#dcfce7", color: "#15803d" }}>
              ● Auto-payout ON · ₹{config.fixed_amount.toLocaleString("en-IN")}
            </span>
          )}
        </p>
      </div>

      <button
        onClick={() => router.push("/admin")}
        style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "13px", fontWeight: 600, padding: 0, width: "fit-content" }}
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      {/* Summary chips */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        {[
          { label: "Awaiting Review",  count: stats.pending,  color: "var(--warning)", bg: "var(--warning-bg)", icon: <Clock size={13} /> },
          { label: "Flagged Expenses", count: stats.flagged,  color: "var(--danger)",  bg: "var(--danger-bg)",  icon: <AlertTriangle size={13} /> },
        ].map((chip) => (
          <div key={chip.label} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 14px", background: chip.bg, borderRadius: "999px", border: `1px solid ${chip.color}30` }}>
            <span style={{ color: chip.color }}>{chip.icon}</span>
            <span style={{ fontSize: "13px", fontWeight: 600, color: chip.color }}>
              {loading ? "—" : chip.count} {chip.label}
            </span>
          </div>
        ))}
        {!loading && stats.totalVal > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 14px", background: "var(--accent-light)", borderRadius: "999px", border: "1px solid var(--accent)30" }}>
            <IndianRupee size={13} color="var(--accent)" />
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--accent)" }}>
              ₹{stats.totalVal.toLocaleString("en-IN")} total reimbursable
            </span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="premium-card" style={{ overflow: "hidden" }}>
        {/* Header row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 150px 120px 180px", gap: "12px", padding: "10px 20px", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          <span>Application / User</span>
          <span>Date Submitted</span>
          <span>Client / Location</span>
          <span>Reimbursable</span>
          <span>Actions</span>
        </div>

        {loading ? (
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {[1, 2, 3].map(i => <div key={i} className="shimmer" style={{ height: "64px", borderRadius: "8px" }} />)}
          </div>
        ) : applications.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <CheckCircle size={40} color="var(--success)" style={{ opacity: 0.4, marginBottom: "12px" }} />
            <p style={{ margin: 0, fontSize: "15px", color: "var(--text-muted)" }}>No pending applications!</p>
          </div>
        ) : (
          applications.map((app) => {
            const state = actionState[app.application_id];
            const isActing = !!state;

            return (
              <div
                key={app.id}
                style={{ display: "grid", gridTemplateColumns: "1fr 130px 150px 120px 180px", gap: "12px", padding: "14px 20px", borderBottom: "1px solid var(--border)", alignItems: "center", opacity: isActing ? 0.6 : 1, transition: "opacity 0.2s" }}
              >
                {/* App / User */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "white", flexShrink: 0 }}>
                    {app.application_id.slice(-2)}
                  </div>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--accent)" }}>{app.application_id}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{app.users?.full_name ?? "—"}</div>
                    <PayoutBadge status={app.payout_status ?? null} />
                  </div>
                </div>

                {/* Date */}
                <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString("en-IN") : "—"}
                </span>

                {/* Client + city */}
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>{app.client_name || "—"}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{app.city || "—"}</div>
                </div>

                {/* Reimbursable */}
                <div>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                    {app.reimbursable_amount != null ? `₹${app.reimbursable_amount.toLocaleString("en-IN")}` : "—"}
                  </span>
                  {(app.flagged_count ?? 0) > 0 && (
                    <div style={{ fontSize: "10px", color: "var(--danger)", fontWeight: 600 }}>
                      {app.flagged_count} flagged
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {/* Approve */}
                  <button
                    onClick={() => handleAction(app, "approved")}
                    disabled={isActing}
                    style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "7px", border: "none", background: "var(--success-bg)", color: "var(--success)", fontSize: "12px", fontWeight: 700, cursor: isActing ? "not-allowed" : "pointer", transition: "all 0.15s" }}
                    onMouseEnter={(e) => { if (!isActing) { e.currentTarget.style.background = "var(--success)"; e.currentTarget.style.color = "white"; } }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "var(--success-bg)"; e.currentTarget.style.color = "var(--success)"; }}
                  >
                    {state === "approving"
                      ? <><RefreshCw size={11} className="animate-spin" /> Approving…</>
                      : <><CheckCircle2 size={11} /> Approve{config?.auto_payout_enabled ? " + Pay" : ""}</>
                    }
                  </button>

                  {/* Reject */}
                  <button
                    onClick={() => handleAction(app, "rejected")}
                    disabled={isActing}
                    style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "7px", border: "none", background: "var(--danger-bg)", color: "var(--danger)", fontSize: "12px", fontWeight: 700, cursor: isActing ? "not-allowed" : "pointer", transition: "all 0.15s" }}
                    onMouseEnter={(e) => { if (!isActing) { e.currentTarget.style.background = "var(--danger)"; e.currentTarget.style.color = "white"; } }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "var(--danger-bg)"; e.currentTarget.style.color = "var(--danger)"; }}
                  >
                    {state === "rejecting"
                      ? <><RefreshCw size={11} className="animate-spin" /> Rejecting…</>
                      : <><XCircle size={11} /> Reject</>
                    }
                  </button>

                  {/* View report */}
                  <button
                    onClick={() => router.push(`/applications/${app.application_id}`)}
                    style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 10px", borderRadius: "7px", border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: "var(--text-muted)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                  >
                    <ExternalLink size={11} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
