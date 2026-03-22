"use client";

import { useEffect, useState, useCallback } from "react";
import {
  IndianRupee, Send, CheckCircle2, XCircle, Clock,
  AlertTriangle, RefreshCw, BadgeCheck, Building2,
  MapPin, User, Wallet, Users, TrendingUp, Settings2,
  ChevronRight, X, ToggleLeft, ToggleRight, Zap,
  ArrowUpRight, CreditCard, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PayoutConfig {
  auto_payout_enabled: boolean;
  fixed_amount: number;
  updated_at: string;
}

interface CashfreeBalance {
  ledgerBalance: number;
  availableBalance: number;
}

interface Beneficiary {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_account_name: string | null;
  cashfree_bene_id: string | null;
  organization: string | null;
  team: string | null;
}

interface ApprovedApp {
  id: string;
  application_id: string;
  client_name: string;
  city: string;
  reimbursable_amount: number;
  payout_status: string | null;
  cashfree_transfer_id: string | null;
  payout_initiated_at: string | null;
  payout_completed_at: string | null;
  users: {
    id: string;
    full_name: string;
    email: string;
    bank_account_number: string | null;
    bank_ifsc: string | null;
    bank_account_name: string | null;
    bank_verified: boolean;
  } | null;
}

// ── Payout badge ──────────────────────────────────────────────────────────────

function PayoutBadge({ status }: { status: string | null }) {
  if (!status) return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:"4px", padding:"3px 9px", borderRadius:"6px", fontSize:"11px", fontWeight:700, background:"#f1f5f9", color:"#64748b", border:"1px solid #e2e8f0" }}>
      <Clock size={10} /> —
    </span>
  );
  const map: Record<string, { bg:string; color:string; border:string }> = {
    PENDING:  { bg:"#fffbeb", color:"#b45309", border:"#fde68a" },
    SUCCESS:  { bg:"#f0fdf4", color:"#15803d", border:"#bbf7d0" },
    FAILURE:  { bg:"#fef2f2", color:"#b91c1c", border:"#fecaca" },
    REVERSED: { bg:"#faf5ff", color:"#7e22ce", border:"#e9d5ff" },
  };
  const icons: Record<string, React.ReactNode> = {
    PENDING: <Clock size={10} />, SUCCESS: <CheckCircle2 size={10} />,
    FAILURE: <XCircle size={10} />, REVERSED: <AlertTriangle size={10} />,
  };
  const s = map[status] ?? { bg:"#f8fafc", color:"#64748b", border:"#e2e8f0" };
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:"4px", padding:"3px 9px", borderRadius:"6px", fontSize:"11px", fontWeight:700, background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>
      {icons[status]} {status}
    </span>
  );
}

// ── Config Sidebar ────────────────────────────────────────────────────────────

function ConfigSidebar({
  open, onClose, config, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  config: PayoutConfig | null;
  onSaved: (c: PayoutConfig) => void;
}) {
  const [enabled, setEnabled] = useState(config?.auto_payout_enabled ?? false);
  const [amount, setAmount]   = useState(String(config?.fixed_amount ?? 5000));
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (config) { setEnabled(config.auto_payout_enabled); setAmount(String(config.fixed_amount)); }
  }, [config, open]);

  const save = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    const res = await fetch("/api/admin/payout-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auto_payout_enabled: enabled, fixed_amount: amt }),
    });
    if (res.ok) { const d = await res.json(); onSaved(d); toast.success("Settings saved"); onClose(); }
    else toast.error("Failed to save");
    setSaving(false);
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.35)", backdropFilter:"blur(3px)", zIndex:998, transition:"opacity 200ms" }}
        />
      )}

      {/* Drawer */}
      <div style={{
        position:"fixed", top:0, right:0, height:"100vh", width:"380px",
        background:"#fff", boxShadow:"-8px 0 40px rgba(0,0,0,0.12)",
        zIndex:999, transform: open ? "translateX(0)" : "translateX(100%)",
        transition:"transform 320ms cubic-bezier(0.4,0,0.2,1)",
        display:"flex", flexDirection:"column",
      }}>
        {/* Header */}
        <div style={{ padding:"20px 24px", borderBottom:"1px solid #e2e8f0", display:"flex", alignItems:"center", justifyContent:"space-between", background:"linear-gradient(135deg,#0f172a,#1e3a5f)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            <div style={{ width:"34px", height:"34px", borderRadius:"10px", background:"rgba(255,255,255,0.12)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Settings2 size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize:"15px", fontWeight:700, color:"#fff", fontFamily:"'DM Sans',sans-serif" }}>Payout Settings</div>
              <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.55)" }}>Auto-debit configuration</div>
            </div>
          </div>
          <button onClick={onClose} style={{ padding:"6px", borderRadius:"8px", border:"none", background:"rgba(255,255,255,0.1)", color:"#fff", cursor:"pointer", display:"flex" }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:"auto", padding:"24px" }}>

          {/* Auto-payout toggle */}
          <div style={{ marginBottom:"28px" }}>
            <label style={{ fontSize:"11px", fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.1em", display:"block", marginBottom:"12px" }}>
              Auto-Payout Mode
            </label>
            <button
              onClick={() => setEnabled(!enabled)}
              style={{
                width:"100%", display:"flex", alignItems:"center", gap:"14px",
                padding:"14px 16px", borderRadius:"12px", border:`2px solid ${enabled ? "#2563eb" : "#e2e8f0"}`,
                background: enabled ? "#eff6ff" : "#f8fafc",
                cursor:"pointer", transition:"all 200ms", textAlign:"left",
              }}
            >
              {enabled
                ? <ToggleRight size={30} color="#2563eb" />
                : <ToggleLeft size={30} color="#94a3b8" />
              }
              <div>
                <div style={{ fontSize:"14px", fontWeight:700, color: enabled ? "#1d4ed8" : "#0f172a" }}>
                  {enabled ? "Auto-Payout Enabled" : "Manual Mode"}
                </div>
                <div style={{ fontSize:"12px", color:"#64748b", marginTop:"2px" }}>
                  {enabled
                    ? "Approved amounts within threshold are paid automatically"
                    : "Admin triggers each payout manually"
                  }
                </div>
              </div>
            </button>
          </div>

          {/* Fixed amount */}
          <div style={{ marginBottom:"28px" }}>
            <label style={{ fontSize:"11px", fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.1em", display:"block", marginBottom:"12px" }}>
              Auto-Payout Threshold
            </label>
            <div style={{ border:"1.5px solid #e2e8f0", borderRadius:"12px", overflow:"hidden", background:"#fff", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ display:"flex", alignItems:"center" }}>
                <span style={{ padding:"14px 16px", background:"#f8fafc", borderRight:"1.5px solid #e2e8f0", fontSize:"18px", fontWeight:800, color:"#0f172a", fontFamily:"'DM Sans',sans-serif" }}>₹</span>
                <input
                  type="number" min="1" value={amount}
                  onChange={e => setAmount(e.target.value)}
                  style={{ flex:1, padding:"14px 16px", border:"none", outline:"none", fontSize:"22px", fontWeight:800, color:"#0f172a", fontFamily:"'DM Sans',sans-serif", background:"transparent" }}
                  placeholder="5000"
                />
              </div>
            </div>
            <p style={{ margin:"8px 0 0", fontSize:"12px", color:"#64748b", lineHeight:"1.5" }}>
              Any approved application with a reimbursable amount up to this limit will be paid out instantly upon approval.
            </p>
          </div>

          {/* Preview pill */}
          {enabled && parseFloat(amount) > 0 && (
            <div style={{ background:"linear-gradient(135deg,#eff6ff,#f0fdf4)", border:"1.5px solid #bfdbfe", borderRadius:"12px", padding:"14px 16px", display:"flex", alignItems:"center", gap:"12px" }}>
              <Zap size={20} color="#2563eb" />
              <div>
                <div style={{ fontSize:"13px", fontWeight:700, color:"#1e40af" }}>Auto-threshold active</div>
                <div style={{ fontSize:"12px", color:"#3b82f6" }}>
                  Approvals ≤ ₹{parseFloat(amount || "0").toLocaleString("en-IN")} will trigger instant payout
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:"16px 24px", borderTop:"1px solid #e2e8f0", display:"flex", gap:"10px" }}>
          <button onClick={onClose} style={{ flex:1, padding:"11px", borderRadius:"10px", border:"1.5px solid #e2e8f0", background:"#f8fafc", fontSize:"13px", fontWeight:700, color:"#64748b", cursor:"pointer" }}>
            Cancel
          </button>
          <button
            onClick={save} disabled={saving}
            style={{ flex:2, padding:"11px", borderRadius:"10px", border:"none", background:"linear-gradient(135deg,#2563eb,#3b82f6)", color:"#fff", fontSize:"13px", fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px", boxShadow:"0 4px 12px rgba(37,99,235,0.3)" }}
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <BadgeCheck size={14} />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PayoutsPage() {
  const [config, setConfig]           = useState<PayoutConfig | null>(null);
  const [apps, setApps]               = useState<ApprovedApp[]>([]);
  const [balance, setBalance]         = useState<CashfreeBalance | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [loadingBenes, setLoadingBenes] = useState(true);
  const [payingId, setPayingId]       = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchConfig = useCallback(async () => {
    const res = await fetch("/api/admin/payout-config");
    if (res.ok) setConfig(await res.json());
  }, []);

  const fetchApps = useCallback(async () => {
    setLoadingApps(true);
    const res = await fetch("/api/admin/applications/approved");
    if (res.ok) setApps(await res.json());
    setLoadingApps(false);
  }, []);

  const fetchBalance = useCallback(async () => {
    setLoadingBalance(true);
    const res = await fetch("/api/cashfree/balance");
    if (res.ok) setBalance(await res.json());
    setLoadingBalance(false);
  }, []);

  const fetchBeneficiaries = useCallback(async () => {
    setLoadingBenes(true);
    const res = await fetch("/api/cashfree/beneficiaries");
    if (res.ok) setBeneficiaries(await res.json());
    setLoadingBenes(false);
  }, []);

  useEffect(() => {
    fetchConfig(); fetchApps(); fetchBalance(); fetchBeneficiaries();
  }, [fetchConfig, fetchApps, fetchBalance, fetchBeneficiaries]);

  const triggerPayout = async (app: ApprovedApp) => {
    if (!app.users?.bank_account_number) {
      toast.error(`${app.users?.full_name ?? "User"} has no bank details.`);
      return;
    }
    const amount = app.reimbursable_amount;
    setPayingId(app.application_id);
    const res = await fetch("/api/cashfree/initiate-payout", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ applicationId: app.application_id, amount }),
    });
    const json = await res.json();
    if (res.ok) { toast.success(`₹${amount.toLocaleString("en-IN")} initiated for ${app.users?.full_name}`); fetchApps(); }
    else toast.error(json.error ?? "Payout failed");
    setPayingId(null);
  };

  // Derived stats
  const totalPaid    = apps.filter(a => a.payout_status === "SUCCESS").length;
  const totalPending = apps.filter(a => a.payout_status === "PENDING").length;
  const totalFailed  = apps.filter(a => a.payout_status === "FAILURE").length;
  const totalVolume  = totalPaid * (config?.fixed_amount ?? 0);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
        .payout-row:hover { background: #f8fafc !important; }
        .bene-row:hover   { background: #f8fafc !important; }
        .pay-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(37,99,235,0.35) !important; }
        .stat-card { transition: transform 180ms, box-shadow 180ms; }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.1) !important; }
        .shimmer { background: linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%); background-size:200% 100%; animation: shimmer 1.4s infinite; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

      <div style={{ padding:"28px 32px", fontFamily:"'DM Sans',sans-serif", maxWidth:"1400px", display:"flex", flexDirection:"column", gap:"24px" }}>

        {/* ── Page header ── */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
          <div>
            <h1 style={{ margin:"0 0 4px", fontSize:"22px", fontWeight:800, color:"#0f172a", letterSpacing:"-0.02em" }}>Payouts</h1>
            <p style={{ margin:0, fontSize:"13px", color:"#64748b" }}>Manage Cashfree transfers, beneficiaries and auto-debit settings</p>
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ display:"flex", alignItems:"center", gap:"8px", padding:"10px 18px", borderRadius:"10px", border:"1.5px solid #e2e8f0", background:"#fff", fontSize:"13px", fontWeight:700, color:"#0f172a", cursor:"pointer", boxShadow:"0 1px 4px rgba(0,0,0,0.06)", transition:"all 150ms" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#2563eb"; (e.currentTarget as HTMLElement).style.color = "#2563eb"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0"; (e.currentTarget as HTMLElement).style.color = "#0f172a"; }}
          >
            <Settings2 size={15} /> Payout Settings
            <ChevronRight size={13} />
          </button>
        </div>

        {/* ── Top stat cards ── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:"14px" }}>

          {/* Ledger balance */}
          <div className="stat-card" style={{ background:"linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)", borderRadius:"14px", padding:"20px 22px", boxShadow:"0 4px 16px rgba(15,23,42,0.18)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px" }}>
              <span style={{ fontSize:"11px", fontWeight:700, color:"rgba(255,255,255,0.5)", textTransform:"uppercase", letterSpacing:"0.1em" }}>Ledger Balance</span>
              <button onClick={fetchBalance} style={{ padding:"4px", background:"rgba(255,255,255,0.08)", border:"none", borderRadius:"6px", cursor:"pointer", display:"flex" }}>
                <RefreshCw size={12} color="rgba(255,255,255,0.5)" />
              </button>
            </div>
            {loadingBalance
              ? <div className="shimmer" style={{ height:"32px", borderRadius:"6px", opacity:0.3 }} />
              : <div style={{ fontSize:"28px", fontWeight:800, color:"#fff", letterSpacing:"-0.02em" }}>
                  ₹{(balance?.ledgerBalance ?? 0).toLocaleString("en-IN")}
                </div>
            }
            <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.4)", marginTop:"6px" }}>Total in Cashfree account</div>
          </div>

          {/* Available balance */}
          <div className="stat-card" style={{ background:"linear-gradient(135deg,#064e3b,#065f46)", borderRadius:"14px", padding:"20px 22px", boxShadow:"0 4px 16px rgba(6,78,59,0.2)" }}>
            <div style={{ marginBottom:"12px" }}>
              <span style={{ fontSize:"11px", fontWeight:700, color:"rgba(255,255,255,0.5)", textTransform:"uppercase", letterSpacing:"0.1em" }}>Available Balance</span>
            </div>
            {loadingBalance
              ? <div className="shimmer" style={{ height:"32px", borderRadius:"6px", opacity:0.3 }} />
              : <div style={{ fontSize:"28px", fontWeight:800, color:"#6ee7b7", letterSpacing:"-0.02em" }}>
                  ₹{(balance?.availableBalance ?? 0).toLocaleString("en-IN")}
                </div>
            }
            <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.4)", marginTop:"6px" }}>Ledger minus pending</div>
          </div>

          {/* Beneficiaries */}
          <div className="stat-card" style={{ background:"#fff", border:"1.5px solid #e2e8f0", borderRadius:"14px", padding:"20px 22px", boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"12px" }}>
              <div style={{ width:"28px", height:"28px", borderRadius:"8px", background:"#eff6ff", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Users size={14} color="#2563eb" />
              </div>
              <span style={{ fontSize:"11px", fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.1em" }}>Beneficiaries</span>
            </div>
            <div style={{ fontSize:"28px", fontWeight:800, color:"#0f172a", letterSpacing:"-0.02em" }}>
              {loadingBenes ? "—" : beneficiaries.length}
            </div>
            <div style={{ fontSize:"11px", color:"#64748b", marginTop:"6px" }}>Verified bank accounts</div>
          </div>

          {/* Total paid */}
          <div className="stat-card" style={{ background:"#fff", border:"1.5px solid #e2e8f0", borderRadius:"14px", padding:"20px 22px", boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"12px" }}>
              <div style={{ width:"28px", height:"28px", borderRadius:"8px", background:"#f0fdf4", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <CheckCircle2 size={14} color="#16a34a" />
              </div>
              <span style={{ fontSize:"11px", fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.1em" }}>Paid Out</span>
            </div>
            <div style={{ fontSize:"28px", fontWeight:800, color:"#16a34a", letterSpacing:"-0.02em" }}>{totalPaid}</div>
            <div style={{ fontSize:"11px", color:"#64748b", marginTop:"6px" }}>₹{totalVolume.toLocaleString("en-IN")} disbursed</div>
          </div>

          {/* Pending */}
          <div className="stat-card" style={{ background:"#fff", border:"1.5px solid #e2e8f0", borderRadius:"14px", padding:"20px 22px", boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"12px" }}>
              <div style={{ width:"28px", height:"28px", borderRadius:"8px", background:"#fffbeb", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Clock size={14} color="#b45309" />
              </div>
              <span style={{ fontSize:"11px", fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.1em" }}>Pending</span>
            </div>
            <div style={{ fontSize:"28px", fontWeight:800, color:"#b45309", letterSpacing:"-0.02em" }}>{totalPending}</div>
            <div style={{ fontSize:"11px", color:"#64748b", marginTop:"6px" }}>{totalFailed} failed</div>
          </div>

          {/* Auto-payout pill */}
          <div className="stat-card" style={{ background: config?.auto_payout_enabled ? "linear-gradient(135deg,#1d4ed8,#2563eb)" : "#fff", border: config?.auto_payout_enabled ? "none" : "1.5px solid #e2e8f0", borderRadius:"14px", padding:"20px 22px", boxShadow:"0 2px 8px rgba(0,0,0,0.05)", cursor:"pointer" }} onClick={() => setSidebarOpen(true)}>
            <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"12px" }}>
              <div style={{ width:"28px", height:"28px", borderRadius:"8px", background: config?.auto_payout_enabled ? "rgba(255,255,255,0.15)" : "#eff6ff", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Zap size={14} color={config?.auto_payout_enabled ? "#fff" : "#2563eb"} />
              </div>
              <span style={{ fontSize:"11px", fontWeight:700, color: config?.auto_payout_enabled ? "rgba(255,255,255,0.7)" : "#64748b", textTransform:"uppercase", letterSpacing:"0.1em" }}>Auto-Payout</span>
            </div>
            <div style={{ fontSize:"16px", fontWeight:800, color: config?.auto_payout_enabled ? "#fff" : "#0f172a" }}>
              {config?.auto_payout_enabled ? "ON" : "OFF"}
            </div>
            <div style={{ fontSize:"11px", color: config?.auto_payout_enabled ? "rgba(255,255,255,0.6)" : "#64748b", marginTop:"6px" }}>
              {config ? `₹${config.fixed_amount.toLocaleString("en-IN")} per application` : "Click to configure"}
            </div>
          </div>
        </div>

        {/* ── Registered Beneficiaries ── */}
        <div style={{ background:"#fff", border:"1.5px solid #e2e8f0", borderRadius:"14px", overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
          {/* Header */}
          <div style={{ padding:"16px 22px", borderBottom:"1px solid #e2e8f0", display:"flex", alignItems:"center", gap:"10px" }}>
            <ShieldCheck size={16} color="#2563eb" />
            <h3 style={{ margin:0, fontSize:"14px", fontWeight:700, color:"#0f172a" }}>Registered Beneficiaries</h3>
            <span style={{ padding:"2px 8px", borderRadius:"999px", background:"#eff6ff", color:"#2563eb", fontSize:"11px", fontWeight:700 }}>
              {loadingBenes ? "…" : beneficiaries.length}
            </span>
            <button onClick={fetchBeneficiaries} style={{ marginLeft:"auto", padding:"6px 12px", borderRadius:"8px", border:"1px solid #e2e8f0", background:"#f8fafc", color:"#64748b", fontSize:"12px", fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:"6px" }}>
              <RefreshCw size={11} /> Refresh
            </button>
          </div>

          {/* Column headers */}
          <div style={{ display:"grid", gridTemplateColumns:"1.8fr 1.4fr 1.2fr 1fr", gap:"12px", padding:"9px 22px", background:"#f8fafc", borderBottom:"1px solid #e2e8f0", fontSize:"10px", fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.1em" }}>
            <span>Employee</span><span>Bank Account</span><span>Organisation</span><span>Bene ID</span>
          </div>

          {loadingBenes ? (
            <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:"8px" }}>
              {[1,2,3].map(i => <div key={i} className="shimmer" style={{ height:"48px", borderRadius:"8px" }} />)}
            </div>
          ) : beneficiaries.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 20px" }}>
              <Users size={32} color="#cbd5e1" style={{ marginBottom:"10px" }} />
              <p style={{ margin:0, fontSize:"13px", color:"#64748b" }}>No beneficiaries registered yet.</p>
              <p style={{ margin:"4px 0 0", fontSize:"11px", color:"#94a3b8" }}>Employees complete bank details during onboarding.</p>
            </div>
          ) : beneficiaries.map((b, i) => (
            <div key={b.id} className="bene-row" style={{ display:"grid", gridTemplateColumns:"1.8fr 1.4fr 1.2fr 1fr", gap:"12px", padding:"12px 22px", borderBottom: i < beneficiaries.length - 1 ? "1px solid #f1f5f9" : "none", alignItems:"center", transition:"background 150ms" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <div style={{ width:"32px", height:"32px", borderRadius:"50%", background:"linear-gradient(135deg,#2563eb,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", fontWeight:700, color:"#fff", flexShrink:0 }}>
                  {(b.full_name ?? "?")[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize:"13px", fontWeight:700, color:"#0f172a" }}>{b.full_name}</div>
                  <div style={{ fontSize:"11px", color:"#94a3b8" }}>{b.email}</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize:"12px", fontWeight:700, color:"#0f172a", fontFamily:"'JetBrains Mono',monospace" }}>•••• {b.bank_account_number?.slice(-4) ?? "—"}</div>
                <div style={{ fontSize:"11px", color:"#64748b" }}>{b.bank_ifsc ?? "—"}</div>
                <div style={{ fontSize:"10px", color:"#16a34a", fontWeight:700, display:"flex", alignItems:"center", gap:"3px", marginTop:"2px" }}>
                  <BadgeCheck size={9} /> {b.bank_account_name}
                </div>
              </div>
              <div>
                <div style={{ fontSize:"12px", fontWeight:600, color:"#0f172a" }}>{b.organization ?? "—"}</div>
                <div style={{ fontSize:"11px", color:"#94a3b8" }}>{b.team ?? "—"}</div>
              </div>
              <div style={{ fontSize:"11px", fontFamily:"'JetBrains Mono',monospace", color:"#94a3b8", wordBreak:"break-all" }}>
                {b.cashfree_bene_id ?? "—"}
              </div>
            </div>
          ))}
        </div>

        {/* ── Approved Applications ── */}
        <div style={{ background:"#fff", border:"1.5px solid #e2e8f0", borderRadius:"14px", overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
          {/* Header */}
          <div style={{ padding:"16px 22px", borderBottom:"1px solid #e2e8f0", display:"flex", alignItems:"center", gap:"10px" }}>
            <CreditCard size={16} color="#2563eb" />
            <h3 style={{ margin:0, fontSize:"14px", fontWeight:700, color:"#0f172a" }}>Approved Applications</h3>
            <span style={{ padding:"2px 8px", borderRadius:"999px", background:"#f0fdf4", color:"#16a34a", fontSize:"11px", fontWeight:700 }}>
              {apps.length}
            </span>
            {config && (
              <span style={{ fontSize:"12px", color:"#64748b", marginLeft:"4px" }}>
                — ₹{config.fixed_amount.toLocaleString("en-IN")} per transfer
              </span>
            )}
            <button onClick={fetchApps} style={{ marginLeft:"auto", padding:"6px 12px", borderRadius:"8px", border:"1px solid #e2e8f0", background:"#f8fafc", color:"#64748b", fontSize:"12px", fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:"6px" }}>
              <RefreshCw size={11} /> Refresh
            </button>
          </div>

          {/* Column headers */}
          <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1.2fr 110px 110px 150px 130px", gap:"12px", padding:"9px 22px", background:"#f8fafc", borderBottom:"1px solid #e2e8f0", fontSize:"10px", fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.1em" }}>
            <span>Application</span><span>Bank Details</span><span>Audit Amt</span><span>Payout Amt</span><span>Status</span><span>Action</span>
          </div>

          {loadingApps ? (
            <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:"10px" }}>
              {[1,2,3,4].map(i => <div key={i} className="shimmer" style={{ height:"56px", borderRadius:"8px" }} />)}
            </div>
          ) : apps.length === 0 ? (
            <div style={{ textAlign:"center", padding:"60px 20px" }}>
              <CheckCircle2 size={36} color="#cbd5e1" style={{ marginBottom:"12px" }} />
              <p style={{ margin:0, fontSize:"13px", color:"#64748b" }}>No approved applications yet.</p>
            </div>
          ) : apps.map((app, i) => {
            const hasBankDetails = !!app.users?.bank_account_number;
            const isPayingNow    = payingId === app.application_id;
            const alreadyPaid    = app.payout_status === "SUCCESS";
            const isPending      = app.payout_status === "PENDING";
            return (
              <div key={app.id} className="payout-row" style={{ display:"grid", gridTemplateColumns:"1.6fr 1.2fr 110px 110px 150px 130px", gap:"12px", padding:"14px 22px", borderBottom: i < apps.length - 1 ? "1px solid #f1f5f9" : "none", alignItems:"center", transition:"background 150ms" }}>

                {/* App + user */}
                <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                  <div style={{ width:"34px", height:"34px", borderRadius:"50%", background:"linear-gradient(135deg,#2563eb,#3b82f6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", fontWeight:700, color:"#fff", flexShrink:0 }}>
                    {(app.users?.full_name ?? "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize:"13px", fontWeight:700, color:"#2563eb", fontFamily:"'JetBrains Mono',monospace" }}>{app.application_id}</div>
                    <div style={{ fontSize:"11px", color:"#64748b", display:"flex", alignItems:"center", gap:"4px" }}>
                      <User size={9} /> {app.users?.full_name ?? "—"}
                    </div>
                    {app.city && (
                      <div style={{ fontSize:"10px", color:"#94a3b8", display:"flex", alignItems:"center", gap:"3px" }}>
                        <MapPin size={9} /> {app.city}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bank */}
                <div>
                  {hasBankDetails ? (
                    <>
                      <div style={{ fontSize:"12px", fontWeight:700, color:"#0f172a", fontFamily:"'JetBrains Mono',monospace" }}>•••• {app.users!.bank_account_number!.slice(-4)}</div>
                      <div style={{ fontSize:"11px", color:"#64748b" }}>{app.users?.bank_ifsc}</div>
                      <div style={{ fontSize:"10px", color:"#16a34a", fontWeight:700, display:"flex", alignItems:"center", gap:"3px", marginTop:"2px" }}>
                        <BadgeCheck size={9} /> Verified
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize:"11px", color:"#dc2626", fontWeight:700 }}>No bank details</div>
                      <div style={{ fontSize:"10px", color:"#94a3b8" }}>Needs onboarding</div>
                    </>
                  )}
                </div>

                {/* Audit amount */}
                <div>
                  <div style={{ fontSize:"14px", fontWeight:800, color:"#0f172a" }}>₹{(app.reimbursable_amount ?? 0).toLocaleString("en-IN")}</div>
                  <div style={{ fontSize:"10px", color:"#94a3b8" }}>Computed</div>
                </div>

                {/* Fixed payout */}
                <div>
                  <div style={{ fontSize:"14px", fontWeight:800, color:"#2563eb" }}>₹{(app.reimbursable_amount ?? 0).toLocaleString("en-IN")}</div>
                  <div style={{ fontSize:"10px", color:"#94a3b8" }}>To send</div>
                </div>

                {/* Status */}
                <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                  <PayoutBadge status={app.payout_status ?? null} />
                  {app.payout_initiated_at && (
                    <span style={{ fontSize:"10px", color:"#94a3b8" }}>
                      {new Date(app.payout_initiated_at).toLocaleDateString("en-IN", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })}
                    </span>
                  )}
                </div>

                {/* Action */}
                <div>
                  {alreadyPaid ? (
                    <span style={{ fontSize:"12px", fontWeight:700, color:"#16a34a", display:"flex", alignItems:"center", gap:"5px" }}>
                      <CheckCircle2 size={13} /> Paid
                    </span>
                  ) : isPending ? (
                    <span style={{ fontSize:"12px", fontWeight:600, color:"#b45309", display:"flex", alignItems:"center", gap:"5px" }}>
                      <Clock size={12} /> Processing…
                    </span>
                  ) : (
                    <button
                      className="pay-btn"
                      onClick={() => triggerPayout(app)}
                      disabled={isPayingNow || !hasBankDetails}
                      style={{
                        display:"flex", alignItems:"center", gap:"6px",
                        padding:"8px 14px", borderRadius:"9px", border:"none",
                        background: hasBankDetails ? "linear-gradient(135deg,#2563eb,#3b82f6)" : "#f1f5f9",
                        color: hasBankDetails ? "#fff" : "#94a3b8",
                        fontSize:"12px", fontWeight:700, cursor: hasBankDetails ? "pointer" : "not-allowed",
                        opacity: isPayingNow ? 0.75 : 1, transition:"all 200ms",
                        boxShadow: hasBankDetails ? "0 2px 8px rgba(37,99,235,0.25)" : "none",
                      }}
                    >
                      {isPayingNow
                        ? <><RefreshCw size={12} className="animate-spin" /> Sending…</>
                        : <><Send size={12} /> Pay Now</>
                      }
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Config Sidebar ── */}
      <ConfigSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        config={config}
        onSaved={(c) => setConfig(c)}
      />
    </>
  );
}