"use client";

import { Sparkles } from "lucide-react";

interface WelcomeScreenProps {
}

export default function WelcomeScreen({ }: WelcomeScreenProps) {
  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "48px 24px 16px",
    }}>
      {/* Animated orb */}
      <div className="welcome-orb-wrap" style={{ position: "relative", marginBottom: "28px" }}>
        <div className="welcome-orb-ring" />
        <div className="welcome-orb-ring welcome-orb-ring-2" />
        <div style={{
          width: "76px", height: "76px", borderRadius: "50%",
          padding: "2.5px", position: "relative",
          background: "conic-gradient(from 0deg, rgba(255,255,255,0.6), rgba(255,255,255,0.1), rgba(255,255,255,0.5), rgba(255,255,255,0.15), rgba(255,255,255,0.6))",
          animation: "orbRotate 8s linear infinite",
        }}>
          <div style={{
            width: "100%", height: "100%", borderRadius: "50%",
            background: "#0a0a0c",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={28} color="rgba(255,255,255,0.7)" />
          </div>
        </div>
      </div>

      <h2 style={{
        margin: "0 0 8px", fontSize: "26px", fontWeight: 700,
        letterSpacing: "-0.04em", textAlign: "center",
      }}>
        <span className="gemini-gradient-text">Hello, Admin</span>
      </h2>
      <p style={{
        margin: "0 0 36px", fontSize: "15px", fontWeight: 400,
        color: "rgba(255,255,255,0.2)", textAlign: "center",
        letterSpacing: "-0.01em", fontFamily: "'Sora', sans-serif",
      }}>
        How can I help you today?
      </p>
    </div>
  );
}
