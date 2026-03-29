"use client";

import { useEffect, useState } from "react";
import {
  IconCoin,
  IconCircleCheck,
  IconClock,
  IconAlertCircle,
  IconArrowRight,
  IconReceipt2,
} from "@tabler/icons-react";
import { CircularLoader } from "@/components/CircularLoader";

interface Payout {
  id: string;
  application_id: string;
  total_claimed: string;
  reimbursable_amount: number;
  payout_status: string;
  payout_initiated_at: string;
  cashfree_transfer_id: string;
}

const statusMap: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
  SUCCESS: {
    bg: "rgba(16,185,129,0.08)",
    text: "#059669",
    icon: <IconCircleCheck size={13} stroke={2.2} />,
    label: "Paid",
  },
  FAILED: {
    bg: "rgba(239,68,68,0.08)",
    text: "#dc2626",
    icon: <IconAlertCircle size={13} stroke={2.2} />,
    label: "Failed",
  },
  REVERSED: {
    bg: "rgba(239,68,68,0.08)",
    text: "#dc2626",
    icon: <IconAlertCircle size={13} stroke={2.2} />,
    label: "Reversed",
  },
};

const defaultStatus = (s: string) => ({
  bg: "rgba(245,158,11,0.08)",
  text: "#d97706",
  icon: <IconClock size={13} stroke={2.2} />,
  label: s || "Processing",
});

export default function PayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/user/payouts");
        const data = await res.json();
        if (Array.isArray(data)) setPayouts(data);
      } catch (err) {
        console.error("Error fetching payouts:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const getStatus = (s: string) =>
    statusMap[s?.toUpperCase()] ?? defaultStatus(s);

  const totalPaid = payouts
    .filter((p) => p.payout_status?.toUpperCase() === "SUCCESS")
    .reduce((sum, p) => sum + (p.reimbursable_amount || 0), 0);

  const successCount = payouts.filter(
    (p) => p.payout_status?.toUpperCase() === "SUCCESS"
  ).length;
  const pendingCount = payouts.filter(
    (p) =>
      !["SUCCESS", "FAILED", "REVERSED"].includes(
        p.payout_status?.toUpperCase()
      )
  ).length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        .payouts-root {
          padding: 28px 32px;
          width: 100%;
          font-family: 'DM Sans', -apple-system, sans-serif;
        }
        .payouts-root * { box-sizing: border-box; margin: 0; padding: 0; }

        .po-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        .po-header-left { display: flex; align-items: center; gap: 14px; }
        .po-header-icon {
          width: 40px; height: 40px; border-radius: 10px;
          background: #0f172a; color: #fff;
          display: flex; align-items: center; justify-content: center;
        }
        .po-header h1 { font-size: 20px; font-weight: 700; color: #0f172a; }
        .po-header p { font-size: 13px; color: #64748b; margin-top: 2px; }

        /* Stats strip */
        .po-stats {
          display: flex; gap: 12px; margin-bottom: 20px;
        }
        .po-stat {
          flex: 1;
          background: #f8fafc;
          border: 1px solid #f1f5f9;
          border-radius: 12px;
          padding: 14px 18px;
          display: flex; flex-direction: column; gap: 2px;
        }
        .po-stat-label {
          font-size: 11px; font-weight: 600; color: #94a3b8;
          text-transform: uppercase; letter-spacing: 0.06em;
        }
        .po-stat-value {
          font-size: 22px; font-weight: 700; color: #0f172a;
          font-family: 'JetBrains Mono', monospace;
        }
        .po-stat-value.green { color: #059669; }

        /* Table */
        .po-table {
          width: 100%;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          overflow: hidden;
        }
        .po-thead {
          display: grid;
          grid-template-columns: 1.8fr 1fr 1.2fr 1fr 0.8fr 40px;
          padding: 0 20px;
          height: 42px;
          align-items: center;
          background: #f8fafc;
          border-bottom: 1px solid #f1f5f9;
        }
        .po-th {
          font-size: 11px; font-weight: 600; color: #94a3b8;
          text-transform: uppercase; letter-spacing: 0.05em;
        }
        .po-th.right { text-align: right; }

        .po-row {
          display: grid;
          grid-template-columns: 1.8fr 1fr 1.2fr 1fr 0.8fr 40px;
          padding: 0 20px;
          height: 56px;
          align-items: center;
          border-bottom: 1px solid #f8fafc;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .po-row:last-child { border-bottom: none; }
        .po-row:hover { background: #fafbfe; }

        .po-cell {
          font-size: 13.5px; color: #0f172a; font-weight: 500;
          display: flex; align-items: center; gap: 6px;
        }
        .po-cell.secondary { color: #64748b; font-weight: 400; }
        .po-cell.mono {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px; font-weight: 500;
        }
        .po-cell.right { justify-content: flex-end; }

        .po-amount {
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px; font-weight: 600; color: #0f172a;
        }
        .po-amount .currency {
          font-size: 11px; font-weight: 500; color: #94a3b8; margin-right: 3px;
        }

        .po-badge {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 10px; border-radius: 6px;
          font-size: 11px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.03em;
        }

        .po-arrow { color: #cbd5e1; display: flex; justify-content: flex-end; }
        .po-row:hover .po-arrow { color: #2563eb; }

        /* Empty state */
        .po-empty {
          padding: 72px 40px; text-align: center;
          background: #fff; border: 1px solid #e2e8f0;
          border-radius: 14px;
        }
        .po-empty-icon {
          width: 56px; height: 56px; border-radius: 50%;
          background: #f8fafc; color: #94a3b8;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px;
        }
        .po-empty h3 { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 6px; }
        .po-empty p { font-size: 13px; color: #64748b; max-width: 300px; margin: 0 auto; line-height: 1.5; }

        /* Shimmer */
        .po-shimmer {
          height: 56px;
          background: linear-gradient(90deg, #f1f5f9 25%, #e8ecf1 50%, #f1f5f9 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* Responsive */
        @media (max-width: 768px) {
          .payouts-root { padding: 20px 16px; }
          .po-stats { flex-direction: column; }
          .po-thead { display: none; }
          .po-row {
            display: flex; flex-wrap: wrap; gap: 8px;
            height: auto; padding: 14px 16px;
          }
        }
      `}</style>

      <div className="payouts-root">
        {/* Header */}
        <div className="po-header">
          <div className="po-header-left">
            <div className="po-header-icon">
              <IconCoin size={20} stroke={1.8} />
            </div>
            <div>
              <h1>Payment History</h1>
              <p>Reimbursements processed to your bank account</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        {!loading && payouts.length > 0 && (
          <div className="po-stats">
            <div className="po-stat">
              <span className="po-stat-label">Total Paid</span>
              <span className="po-stat-value green">
                ₹{totalPaid.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="po-stat">
              <span className="po-stat-label">Transactions</span>
              <span className="po-stat-value">{payouts.length}</span>
            </div>
            <div className="po-stat">
              <span className="po-stat-label">Successful</span>
              <span className="po-stat-value">{successCount}</span>
            </div>
            <div className="po-stat">
              <span className="po-stat-label">Pending</span>
              <span className="po-stat-value">{pendingCount}</span>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <CircularLoader message="Loading payment history..." />
        ) : payouts.length === 0 ? (
          <div className="po-empty">
            <div className="po-empty-icon">
              <IconReceipt2 size={28} stroke={1.5} />
            </div>
            <h3>No payments yet</h3>
            <p>
              Reimbursements will appear here once approved applications are
              processed for payout.
            </p>
          </div>
        ) : (
          <div className="po-table">
            <div className="po-thead">
              <span className="po-th">Application</span>
              <span className="po-th">Amount</span>
              <span className="po-th">Reference</span>
              <span className="po-th">Date</span>
              <span className="po-th">Status</span>
              <span className="po-th" />
            </div>

            {payouts.map((payout) => {
              const st = getStatus(payout.payout_status);
              return (
                <div
                  key={payout.id}
                  className="po-row"
                  onClick={() =>
                    (window.location.href = `/applications/${payout.application_id}`)
                  }
                >
                  <div className="po-cell" style={{ fontWeight: 600 }}>
                    {payout.application_id}
                  </div>

                  <div className="po-cell">
                    <span className="po-amount">
                      <span className="currency">₹</span>
                      {Math.round(payout.reimbursable_amount).toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="po-cell mono secondary">
                    {payout.cashfree_transfer_id}
                  </div>

                  <div className="po-cell secondary">
                    {new Date(payout.payout_initiated_at).toLocaleDateString(
                      "en-IN",
                      { day: "2-digit", month: "short", year: "numeric" }
                    )}
                  </div>

                  <div className="po-cell">
                    <span
                      className="po-badge"
                      style={{ background: st.bg, color: st.text }}
                    >
                      {st.icon}
                      {st.label}
                    </span>
                  </div>

                  <div className="po-arrow">
                    <IconArrowRight size={16} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}