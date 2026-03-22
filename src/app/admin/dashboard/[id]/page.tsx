"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import DashboardRenderer from "@/components/DashboardRenderer";
import type { DashboardSpec } from "@/types";
import { Loader2, AlertCircle } from "lucide-react";

export default function StandaloneDashboardPage() {
  const { id } = useParams();
  const [spec, setSpec] = useState<DashboardSpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("dashboards")
          .select("spec")
          .eq("id", id)
          .single();

        if (error) throw error;
        if (!data) throw new Error("Dashboard not found");

        setSpec(data.spec as unknown as DashboardSpec);
      } catch (err: any) {
        console.error("Error fetching dashboard:", err);
        setError(err.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [id]);

  if (loading) {
    return (
      <div style={{
        height: "100vh", width: "100vw", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", background: "#050608", gap: "16px"
      }}>
        <Loader2 size={40} color="#6366f1" className="animate-spin" />
        <p style={{ color: "#9ca3af", fontFamily: "'DM Sans', sans-serif" }}>Loading Dashboard...</p>
      </div>
    );
  }

  if (error || !spec) {
    return (
      <div style={{
        height: "100vh", width: "100vw", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", background: "#050608", gap: "16px",
        padding: "20px", textAlign: "center"
      }}>
        <AlertCircle size={48} color="#f43f5e" />
        <h1 style={{ color: "#f3f4f6", fontFamily: "'DM Sans', sans-serif", margin: 0 }}>Oops!</h1>
        <p style={{ color: "#9ca3af", fontFamily: "'DM Sans', sans-serif", maxWidth: "400px" }}>
          {error || "We couldn't find the dashboard you're looking for."}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: "10px", padding: "10px 20px", borderRadius: "8px",
            background: "#6366f1", border: "none", color: "white",
            cursor: "pointer", fontWeight: 600, fontFamily: "'DM Sans', sans-serif"
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  // hideHeader: true because user said "without sidebar and topbar"
  return <DashboardRenderer spec={spec} hideHeader={true} />;
}
