"use client";

import { useEffect, useState } from "react";

interface LoadingScreenProps {
  onComplete?: () => void;
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [phase, setPhase] = useState<"enter" | "visible" | "done">("enter");

  useEffect(() => {
    // Step 1 — trigger fade-in immediately
    const t1 = setTimeout(() => setPhase("visible"), 50);

    // Step 2 — hold for a moment then fade out
    const t2 = setTimeout(() => {
      setPhase("done");
      setTimeout(() => onComplete?.(), 500);
    }, 1800);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onComplete]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=DM+Sans:wght@400;500&display=swap');

        .ls-root {
          position: fixed;
          inset: 0;
          background: #0D1117;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          transition: opacity 0.5s ease;
        }
        .ls-root.enter   { opacity: 0; }
        .ls-root.visible { opacity: 1; }
        .ls-root.done    { opacity: 0; pointer-events: none; }

        /* ── Main brand block ── */
        .ls-brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          transform: translateY(0);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .ls-root.enter .ls-brand {
          opacity: 0;
          transform: translateY(12px);
        }
        .ls-root.visible .ls-brand {
          opacity: 1;
          transform: translateY(0);
        }

        /* Name */
        .ls-name {
          font-family: 'Nunito', sans-serif;
          font-size: 42px;
          font-weight: 900;
          color: #FFFFFF;
          letter-spacing: -0.04em;
          line-height: 1;
        }
        .ls-name span {
          color: #3B82F6;
        }

        /* Tagline */
        .ls-by {
          font-family: 'DM Sans', sans-serif;
          font-size: 12px;
          font-weight: 500;
          color: #475569;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        /* ── Pulse dot ── */
        .ls-pulse {
          margin-top: 40px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #3B82F6;
          animation: ls-pulse 1.4s ease-in-out infinite;
          opacity: 0;
          transition: opacity 0.4s ease 0.4s;
        }
        .ls-root.visible .ls-pulse {
          opacity: 1;
        }
        @keyframes ls-pulse {
          0%, 100% { transform: scale(1);   opacity: 0.5; }
          50%       { transform: scale(1.6); opacity: 1;   }
        }
      `}</style>

      <div className={`ls-root ${phase}`}>

        <div className="ls-brand">
          <div className="ls-name">Expify<span>.</span></div>
          <div className="ls-by">By Fristine Infotech</div>
        </div>

        <div className="ls-pulse" />

      </div>
    </>
  );
}