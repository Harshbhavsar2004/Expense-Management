"use client";

import { useEffect, useState } from "react";
import {
  IconCoin,
  IconCircleCheck,
  IconClock,
  IconAlertCircle,
  IconX,
  IconExternalLink,
  IconCopy,
  IconCheck,
  IconBuildingBank,
  IconReceipt2,
  IconTrendingUp,
  IconArrowUpRight,
  IconChevronRight,
} from "@tabler/icons-react";
import { CircularLoader } from "@/components/CircularLoader";
import { motion, AnimatePresence } from "framer-motion";

interface Payout {
  id: string;
  application_id: string;
  total_claimed: string;
  reimbursable_amount: number;
  payout_status: string;
  payout_initiated_at: string;
  cashfree_transfer_id: string;
}

type StatusConfig = {
  bg: string;
  pill: string;
  text: string;
  icon: React.ReactNode;
  label: string;
  dot: string;
};

const statusMap: Record<string, StatusConfig> = {
  SUCCESS: {
    bg: "rgba(16,185,129,0.06)",
    pill: "rgba(16,185,129,0.12)",
    text: "#059669",
    dot: "#10b981",
    icon: <IconCircleCheck size={13} stroke={2.2} />,
    label: "Paid",
  },
  FAILED: {
    bg: "rgba(239,68,68,0.06)",
    pill: "rgba(239,68,68,0.12)",
    text: "#dc2626",
    dot: "#ef4444",
    icon: <IconAlertCircle size={13} stroke={2.2} />,
    label: "Failed",
  },
  REVERSED: {
    bg: "rgba(239,68,68,0.06)",
    pill: "rgba(239,68,68,0.12)",
    text: "#dc2626",
    dot: "#ef4444",
    icon: <IconAlertCircle size={13} stroke={2.2} />,
    label: "Reversed",
  },
};

const getStatus = (s: string): StatusConfig =>
  statusMap[s?.toUpperCase()] ?? {
    bg: "rgba(245,158,11,0.06)",
    pill: "rgba(245,158,11,0.12)",
    text: "#d97706",
    dot: "#f59e0b",
    icon: <IconClock size={13} stroke={2.2} />,
    label: s || "Processing",
  };

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  accent,
  delay,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      style={{
        background: "#ffffff",
        border: "1px solid rgba(203,213,225,0.5)",
        borderRadius: "16px",
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        boxShadow: "0 1px 8px rgba(15,23,42,0.04)",
        flex: 1,
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "#94a3b8",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: "28px",
          fontWeight: 800,
          color: accent ?? "#0f172a",
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: "11.5px", color: "#94a3b8", fontWeight: 500 }}>
          {sub}
        </span>
      )}
    </motion.div>
  );
}

// ─── Payout Card ──────────────────────────────────────────────────────────────
function PayoutCard({
  payout,
  index,
  onClick,
}: {
  payout: Payout;
  index: number;
  onClick: () => void;
}) {
  const st = getStatus(payout.payout_status);
  const date = new Date(payout.payout_initiated_at);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.06, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      onClick={onClick}
      style={{
        background: "#ffffff",
        border: "1px solid rgba(203,213,225,0.5)",
        borderRadius: "16px",
        padding: "0",
        overflow: "hidden",
        cursor: "pointer",
        boxShadow: "0 1px 6px rgba(15,23,42,0.04)",
        transition: "box-shadow 180ms, border-color 180ms, transform 180ms",
      }}
      whileHover={{
        boxShadow: "0 4px 20px rgba(15,23,42,0.10)",
        y: -2,
      }}
      whileTap={{ scale: 0.995 }}
    >
      {/* Status bar accent at top */}
      <div
        style={{
          height: "3px",
          background: st.dot,
          opacity: 0.7,
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "20px 24px",
          gap: "20px",
        }}
      >
        {/* Left: icon */}
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "14px",
            background: st.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            border: `1px solid ${st.dot}22`,
          }}
        >
          <IconCoin size={22} stroke={1.8} color={st.text} />
        </div>

        {/* Center: details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "4px",
            }}
          >
            <span
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#0f172a",
                fontFamily: "monospace",
                letterSpacing: "0.01em",
              }}
            >
              {payout.application_id}
            </span>
            {/* Status pill */}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 9px",
                borderRadius: "9999px",
                background: st.pill,
                color: st.text,
                fontSize: "10.5px",
                fontWeight: 700,
                letterSpacing: "0.04em",
              }}
            >
              {st.icon}
              {st.label}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 500 }}>
              {date.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
            {payout.cashfree_transfer_id && (
              <>
                <span style={{ color: "#cbd5e1", fontSize: "12px" }}>·</span>
                <span
                  style={{
                    fontSize: "11.5px",
                    color: "#94a3b8",
                    fontFamily: "monospace",
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "160px",
                  }}
                >
                  {payout.cashfree_transfer_id}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: amount + chevron */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flexShrink: 0,
          }}
        >
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: "20px",
                fontWeight: 800,
                color: "#0f172a",
                letterSpacing: "-0.03em",
                lineHeight: 1,
              }}
            >
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#475569" }}>
                ₹
              </span>
              {Math.round(payout.reimbursable_amount).toLocaleString("en-IN")}
            </div>
            <div
              style={{
                fontSize: "10.5px",
                color: "#94a3b8",
                fontWeight: 600,
                marginTop: "3px",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Reimbursed
            </div>
          </div>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "9999px",
              background: "#f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#94a3b8",
            }}
          >
            <IconChevronRight size={16} stroke={2} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function PayoutDetailsModal({
  payout,
  onClose,
}: {
  payout: Payout;
  onClose: () => void;
}) {
  const st = getStatus(payout.payout_status);
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 16 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#ffffff",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "480px",
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(15,23,42,0.25)",
        }}
      >
        {/* Status accent bar */}
        <div style={{ height: "4px", background: st.dot }} />

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "24px 24px 0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "rgba(0,13,77,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconCoin size={20} stroke={1.8} color="#000D4D" />
            </div>
            <div>
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "#0f172a",
                  lineHeight: 1.2,
                }}
              >
                Payout Details
              </h3>
              <p
                style={{
                  fontSize: "12px",
                  color: "#94a3b8",
                  fontFamily: "monospace",
                  marginTop: "2px",
                }}
              >
                {payout.application_id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "9999px",
              background: "#f1f5f9",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
            }}
          >
            <IconX size={16} stroke={2} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px" }}>
          {/* Status banner */}
          <div
            style={{
              background: st.bg,
              border: `1px solid ${st.dot}30`,
              borderRadius: "12px",
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: st.pill,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: st.text,
                flexShrink: 0,
              }}
            >
              {st.icon}
            </div>
            <div>
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: st.text,
                  lineHeight: 1.3,
                }}
              >
                {st.label}
              </p>
              <p style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                Processed on{" "}
                {new Date(payout.payout_initiated_at).toLocaleDateString(
                  "en-IN",
                  { day: "2-digit", month: "long", year: "numeric" }
                )}
              </p>
            </div>
          </div>

          {/* Amount */}
          <div
            style={{
              textAlign: "center",
              padding: "20px 0 24px",
              borderBottom: "1px solid #f1f5f9",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: "6px",
              }}
            >
              Amount Reimbursed
            </div>
            <div
              style={{
                fontSize: "40px",
                fontWeight: 900,
                color: "#0f172a",
                letterSpacing: "-0.04em",
                lineHeight: 1,
              }}
            >
              <span
                style={{
                  fontSize: "22px",
                  fontWeight: 700,
                  color: "#64748b",
                  verticalAlign: "super",
                }}
              >
                ₹
              </span>
              {Math.round(payout.reimbursable_amount).toLocaleString("en-IN")}
            </div>
          </div>

          {/* Details grid */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            {/* Transfer ID */}
            <div>
              <label
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  display: "block",
                  marginBottom: "6px",
                }}
              >
                Transfer ID
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  gap: "8px",
                }}
              >
                <code
                  style={{
                    fontSize: "13px",
                    color: "#334155",
                    fontFamily: "monospace",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                  }}
                >
                  {payout.cashfree_transfer_id || "—"}
                </code>
                {payout.cashfree_transfer_id && (
                  <button
                    onClick={() => handleCopy(payout.cashfree_transfer_id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: copied ? "#059669" : "#94a3b8",
                      padding: "2px",
                      display: "flex",
                      alignItems: "center",
                      flexShrink: 0,
                      transition: "color 150ms",
                    }}
                  >
                    {copied ? (
                      <IconCheck size={15} stroke={2.5} />
                    ) : (
                      <IconCopy size={15} stroke={2} />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Reference ID */}
            <div>
              <label
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  display: "block",
                  marginBottom: "6px",
                }}
              >
                Reference ID
              </label>
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "10px 14px",
                }}
              >
                <code
                  style={{
                    fontSize: "12.5px",
                    color: "#64748b",
                    fontFamily: "monospace",
                  }}
                >
                  {payout.id}
                </code>
              </div>
            </div>

            {/* Bank info */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                background: "rgba(0,13,77,0.04)",
                border: "1px solid rgba(0,13,77,0.08)",
                borderRadius: "10px",
                padding: "12px 16px",
                marginTop: "4px",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "9px",
                  background: "rgba(0,13,77,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <IconBuildingBank size={18} stroke={1.6} color="#000D4D" />
              </div>
              <div>
                <p
                  style={{
                    fontSize: "12.5px",
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  Bank Settlement
                </p>
                <p
                  style={{
                    fontSize: "11.5px",
                    color: "#64748b",
                    marginTop: "2px",
                  }}
                >
                  Direct transfer to your primary account
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "0 24px 24px",
            display: "flex",
            gap: "10px",
          }}
        >
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "11px",
              borderRadius: "10px",
              background: "#f1f5f9",
              border: "none",
              fontSize: "13.5px",
              fontWeight: 600,
              color: "#64748b",
              cursor: "pointer",
              transition: "background 150ms",
            }}
          >
            Close
          </button>
          <button
            onClick={() =>
              window.open(
                `https://payouts.cashfree.com/transfers/${payout.cashfree_transfer_id}`,
                "_blank"
              )
            }
            style={{
              flex: 1,
              padding: "11px",
              borderRadius: "10px",
              background: "#000D4D",
              border: "none",
              fontSize: "13.5px",
              fontWeight: 600,
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              transition: "opacity 150ms",
            }}
          >
            View on Cashfree
            <IconExternalLink size={14} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
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
    <div
      style={{
        minHeight: "100%",
        padding: "32px",
      }}
    >
      {/* ── Page header ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "28px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "13px",
              background: "#000D4D",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0,13,77,0.25)",
            }}
          >
            <IconCoin size={22} stroke={1.8} color="white" />
          </div>
          <div>
            <h1
              style={{
                fontSize: "22px",
                fontWeight: 800,
                color: "#0f172a",
                letterSpacing: "-0.03em",
                lineHeight: 1.2,
              }}
            >
              Payment History
            </h1>
            <p
              style={{
                fontSize: "13px",
                color: "#64748b",
                fontWeight: 500,
                marginTop: "2px",
              }}
            >
              Reimbursements processed to your bank account
            </p>
          </div>
        </div>

        {/* Live indicator */}
        {!loading && payouts.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              background: "rgba(16,185,129,0.08)",
              border: "1px solid rgba(16,185,129,0.2)",
              borderRadius: "9999px",
            }}
          >
            <div
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "#10b981",
              }}
            />
            <span
              style={{
                fontSize: "11.5px",
                fontWeight: 700,
                color: "#059669",
                letterSpacing: "0.04em",
              }}
            >
              Active
            </span>
          </div>
        )}
      </motion.div>

      {/* ── Stats ── */}
      {!loading && payouts.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "12px",
            marginBottom: "28px",
            flexWrap: "wrap",
          }}
        >
          <StatCard
            label="Total Paid"
            value={`₹${totalPaid.toLocaleString("en-IN")}`}
            sub="Cumulative reimbursements"
            accent="#059669"
            delay={0.05}
          />
          <StatCard
            label="Transactions"
            value={payouts.length}
            sub="All time"
            delay={0.1}
          />
          <StatCard
            label="Successful"
            value={successCount}
            sub={`${Math.round((successCount / payouts.length) * 100)}% success rate`}
            delay={0.15}
          />
          <StatCard
            label="Pending"
            value={pendingCount}
            sub="Awaiting settlement"
            accent={pendingCount > 0 ? "#d97706" : undefined}
            delay={0.2}
          />
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <CircularLoader message="Loading payment history..." />
      ) : payouts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "80px 24px",
            background: "#ffffff",
            borderRadius: "20px",
            border: "1px dashed #cbd5e1",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "18px",
              background: "#f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px",
            }}
          >
            <IconReceipt2 size={28} stroke={1.5} color="#94a3b8" />
          </div>
          <h3
            style={{
              fontSize: "17px",
              fontWeight: 700,
              color: "#0f172a",
              marginBottom: "8px",
            }}
          >
            No payments yet
          </h3>
          <p
            style={{
              fontSize: "13.5px",
              color: "#64748b",
              maxWidth: "320px",
              lineHeight: 1.6,
            }}
          >
            Reimbursements will appear here once your approved applications are
            processed for payout.
          </p>
        </motion.div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* Section label */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "4px",
            }}
          >
            <IconTrendingUp size={14} stroke={2} color="#94a3b8" />
            <span
              style={{
                fontSize: "11.5px",
                fontWeight: 600,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {payouts.length} transaction{payouts.length !== 1 ? "s" : ""}
            </span>
          </div>

          {payouts.map((payout, index) => (
            <PayoutCard
              key={payout.id}
              payout={payout}
              index={index}
              onClick={() => setSelectedPayout(payout)}
            />
          ))}
        </div>
      )}

      {/* ── Detail Modal ── */}
      <AnimatePresence>
        {selectedPayout && (
          <PayoutDetailsModal
            payout={selectedPayout}
            onClose={() => setSelectedPayout(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
