"use client";

import { useEffect, useState } from "react";
import { 
  IconCoin, 
  IconCircleCheck, 
  IconClock, 
  IconAlertCircle, 
  IconArrowRight,
  IconReceipt2
} from "@tabler/icons-react";
import Link from "next/link";

interface Payout {
  id: string;
  application_id: string;
  total_claimed: string;
  reimbursable_amount: number;
  payout_status: string;
  payout_initiated_at: string;
  cashfree_transfer_id: string;
}

export default function PayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPayouts = async () => {
      try {
        const res = await fetch("/api/user/payouts");
        const data = await res.json();
        if (Array.isArray(data)) {
          setPayouts(data);
        }
      } catch (err) {
        console.error("Error fetching payouts:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPayouts();
  }, []);

  const getStatusStyle = (status: string) => {
    switch (status?.toUpperCase()) {
      case "SUCCESS":
        return { 
          bg: "rgba(16, 185, 129, 0.1)", 
          text: "#059669", 
          icon: <IconCircleCheck size={14} />,
          label: "Paid"
        };
      case "FAILED":
      case "REVERSED":
        return { 
          bg: "rgba(239, 68, 68, 0.1)", 
          text: "#dc2626", 
          icon: <IconAlertCircle size={14} />,
          label: "Failed"
        };
      default:
        return { 
          bg: "rgba(245, 158, 11, 0.1)", 
          text: "#d97706", 
          icon: <IconClock size={14} />,
          label: status || "Processing"
        };
    }
  };

  return (
    <div style={{ padding: "32px", maxWidth: "1000px", margin: "0 auto" }}>
      {/* Header Section */}
      <div style={{ marginBottom: "32px", display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ 
          width: "48px", 
          height: "48px", 
          borderRadius: "14px", 
          background: "linear-gradient(135deg, #2563eb, #3b82f6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          boxShadow: "0 8px 16px rgba(37, 99, 235, 0.2)"
        }}>
          <IconCoin size={24} />
        </div>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#0f172a", margin: 0 }}>Payment History</h2>
          <p style={{ fontSize: "14px", color: "#64748b", margin: "4px 0 0" }}>Track all reimbursements processed to your bank account</p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="shimmer" style={{ height: "88px", borderRadius: "16px", background: "white" }} />
          ))}
        </div>
      ) : payouts.length === 0 ? (
        <div style={{ 
          background: "white", 
          borderRadius: "24px", 
          padding: "80px 40px", 
          textAlign: "center",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 12px rgba(0,0,0,0.03)"
        }}>
          <div style={{ 
            width: "64px", 
            height: "64px", 
            borderRadius: "50%", 
            background: "#f8fafc", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            margin: "0 auto 20px",
            color: "#94a3b8"
          }}>
            <IconReceipt2 size={32} stroke={1.5} />
          </div>
          <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#0f172a", margin: "0 0 8px" }}>No payments found</h3>
          <p style={{ fontSize: "14px", color: "#64748b", margin: 0, maxWidth: "320px", marginInline: "auto" }}>
            Reimbursements will appear here once your approved applications are processed for payout.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {payouts.map((payout) => {
            const style = getStatusStyle(payout.payout_status);
            return (
              <div 
                key={payout.id}
                style={{
                  background: "white",
                  borderRadius: "20px",
                  padding: "20px 24px",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#2563eb";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(37, 99, 235, 0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
                }}
                onClick={() => window.location.href = `/applications/${payout.application_id}`}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                  {/* Amount Circle */}
                  <div style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "16px",
                    background: "#f8fafc",
                    border: "1.5px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#0f172a"
                  }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>INR</span>
                    <span style={{ fontSize: "15px", fontWeight: 800 }}>{Math.round(payout.reimbursable_amount)}</span>
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>{payout.application_id}</span>
                      <div style={{ 
                        background: style.bg, 
                        color: style.text, 
                        padding: "4px 10px", 
                        borderRadius: "20px", 
                        fontSize: "11px", 
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        textTransform: "uppercase",
                        letterSpacing: "0.02em"
                      }}>
                        {style.icon}
                        {style.label}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12.5px", color: "#64748b" }}>
                      <span>Initiated: {new Date(payout.payout_initiated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      <span style={{ color: "#e2e8f0" }}>|</span>
                      <span style={{ fontFamily: 'monospace', fontSize: "11px" }}>Ref: {payout.cashfree_transfer_id}</span>
                    </div>
                  </div>
                </div>

                <div style={{ color: "#cbd5e1" }}>
                  <IconArrowRight size={20} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
