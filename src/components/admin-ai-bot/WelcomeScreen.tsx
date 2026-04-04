"use client";

import { Sparkles } from "lucide-react";

interface WelcomeScreenProps {}

export default function WelcomeScreen({}: WelcomeScreenProps) {
  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "48px 24px 16px",
      fontFamily: "var(--font-sans, 'Geist', sans-serif)",
    }}>
      {/* Animated orb */}
      <div className="welcome-orb-wrap" style={{ position: "relative", marginBottom: "32px" }}>
        <div className="welcome-orb-ring" />
        <div className="welcome-orb-ring welcome-orb-ring-2" />

        {/* Outer rotating ring */}
        <div style={{
          width: "72px",
          height: "72px",
          borderRadius: "50%",
          padding: "1.5px",
          position: "relative",
          background: "conic-gradient(from 0deg, rgba(255,255,255,0.5), rgba(255,255,255,0.08), rgba(255,255,255,0.4), rgba(255,255,255,0.06), rgba(255,255,255,0.5))",
          animation: "orbRotate 10s linear infinite",
        }}>
          <div style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: "#212121",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Sparkles size={26} color="rgba(255,255,255,0.75)" strokeWidth={1.5} />
          </div>
        </div>
      </div>

      <h2 style={{
        margin: "0 0 6px",
        fontSize: "24px",
        fontWeight: 600,
        letterSpacing: "-0.03em",
        textAlign: "center",
        lineHeight: 1.2,
      }}>
        <span className="gemini-gradient-text">Hello, Admin</span>
      </h2>

      <p style={{
        margin: "0 0 40px",
        fontSize: "13.5px",
        fontWeight: 400,
        color: "rgba(255,255,255,0.22)",
        textAlign: "center",
        letterSpacing: "0.01em",
        fontFamily: "var(--font-sans, 'Geist', sans-serif)",
      }}>
        How can I help you today?
      </p>
    </div>
  );
}