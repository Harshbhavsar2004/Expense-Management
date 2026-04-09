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
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { 
  IconX, 
  IconExternalLink, 
  IconCopy, 
  IconCheck, 
  IconBuildingBank 
} from "@tabler/icons-react";

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
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);

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
          <motion.div 
            className="po-stats"
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: { staggerChildren: 0.1 }
              }
            }}
          >
            {[
              { label: "Total Paid", value: `₹${totalPaid.toLocaleString("en-IN")}`, variant: "green" },
              { label: "Transactions", value: payouts.length, variant: "" },
              { label: "Successful", value: successCount, variant: "" },
              { label: "Pending", value: pendingCount, variant: "" }
            ].map((stat, i) => (
              <motion.div 
                key={i}
                className="po-stat"
                variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
              >
                <span className="po-stat-label">{stat.label}</span>
                <span className={cn("po-stat-value", stat.variant)}>{stat.value}</span>
              </motion.div>
            ))}
          </motion.div>
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

            {payouts.map((payout, index) => {
              const st = getStatus(payout.payout_status);
              return (
                <motion.div
                  key={payout.id}
                  className="po-row"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + (index * 0.05) }}
                  onClick={() => setSelectedPayout(payout)}
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
                </motion.div>
              );
            })}
          </div>
        )}

        <AnimatePresence>
          {selectedPayout && (
            <PayoutDetailsModal 
              payout={selectedPayout} 
              onClose={() => setSelectedPayout(null)} 
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function PayoutDetailsModal({ payout, onClose }: { payout: Payout; onClose: () => void }) {
  const st = statusMap[payout.payout_status?.toUpperCase()] ?? defaultStatus(payout.payout_status);
  
  return (
    <motion.div 
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div 
        className="modal-content"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="brand-logo"><IconCoin size={20} /></div>
            <div>
              <h3>Payout Details</h3>
              <p>{payout.application_id}</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}><IconX size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="status-banner" style={{ background: `${st.bg}40` }}>
            <div className="banner-icon" style={{ color: st.text }}>{st.icon}</div>
            <div className="banner-text">
              <span style={{ color: st.text }}>{st.label}</span>
              <p>Processed on {new Date(payout.payout_initiated_at).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="detail-item" style={{ marginBottom: 24 }}>
            <label>Amount Paid</label>
            <div className="amount-hero">
              <span className="curr">₹</span>
              {Math.round(payout.reimbursable_amount).toLocaleString("en-IN")}
            </div>
          </div>

          <div className="details-grid">
            <div className="detail-item">
              <label>Transfer ID</label>
              <div className="copy-field">
                <code>{payout.cashfree_transfer_id}</code>
                <button onClick={() => navigator.clipboard.writeText(payout.cashfree_transfer_id)}>
                  <IconCopy size={14} />
                </button>
              </div>
            </div>
            <div className="detail-item">
              <label>Reference ID</label>
              <p>{payout.id}</p>
            </div>
          </div>

          <div className="bank-info">
            <div className="bank-icon">
              <IconBuildingBank size={20} stroke={1.5} />
            </div>
            <div className="bank-text">
              <label>Recipient Bank Account</label>
              <p>Direct Settlement to Primary Account</p>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="action-btn secondary" onClick={onClose}>Close</button>
          <button 
            className="action-btn primary" 
            onClick={() => window.open(`https://payouts.cashfree.com/transfers/${payout.cashfree_transfer_id}`, '_blank')}
          >
            View on Cashfree <IconExternalLink size={14} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}