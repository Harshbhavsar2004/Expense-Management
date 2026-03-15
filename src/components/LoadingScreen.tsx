"use client";

import { useEffect, useState } from "react";

interface LoadingScreenProps {
  onComplete?: () => void;
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"loading" | "done">("loading");
  const [statusIndex, setStatusIndex] = useState(0);

  const statuses = [
    "Initializing workspace...",
    "Loading expense data...",
    "Preparing your dashboard...",
    "Almost ready...",
  ];

  useEffect(() => {
    const steps = [
      { target: 25, delay: 0 },
      { target: 50, delay: 180 },
      { target: 72, delay: 220 },
      { target: 88, delay: 260 },
      { target: 100, delay: 300 },
    ];

    let elapsed = 0;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    steps.forEach((step, i) => {
      const t = setTimeout(() => {
        setProgress(step.target);
        setStatusIndex(Math.min(i, statuses.length - 1));
        if (step.target === 100) {
          const done = setTimeout(() => {
            setPhase("done");
            setTimeout(() => onComplete?.(), 400);
          }, 450);
          timeouts.push(done);
        }
      }, elapsed);
      elapsed += step.delay;
      timeouts.push(t);
    });

    return () => timeouts.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;700&family=Figtree:wght@400;500&display=swap');

        .ls-root {
          position: fixed;
          inset: 0;
          background: #F8FAFC;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          transition: opacity 0.4s ease, transform 0.4s ease;
        }
        .ls-root.done {
          opacity: 0;
          transform: scale(1.02);
          pointer-events: none;
        }

        /* Top thin progress line */
        .ls-topbar {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: #E2E8F0;
        }
        .ls-topbar-fill {
          height: 100%;
          background: #2563EB;
          border-radius: 0 2px 2px 0;
          transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Subtle dot grid background */
        .ls-bg-dots {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(#E2E8F0 1px, transparent 1px);
          background-size: 28px 28px;
          opacity: 0.6;
          pointer-events: none;
        }

        /* Center content */
        .ls-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 28px;
          position: relative;
          z-index: 1;
        }

        /* Logo mark */
        .ls-logo-wrap {
          position: relative;
          width: 72px;
          height: 72px;
          animation: ls-float 3s ease-in-out infinite;
        }
        @keyframes ls-float {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-5px); }
        }

        .ls-logo-ring {
          position: absolute;
          border-radius: 50%;
          border: 1.5px solid #BFDBFE;
          animation: ls-ring-pulse 2.4s ease-in-out infinite;
        }
        .ls-logo-ring-1 {
          inset: -14px;
          animation-delay: 0s;
          opacity: 0.5;
        }
        .ls-logo-ring-2 {
          inset: -6px;
          animation-delay: 0.3s;
          border-color: #93C5FD;
          opacity: 0.7;
        }
        @keyframes ls-ring-pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50%       { opacity: 0.7; transform: scale(1.04); }
        }

        .ls-logo-box {
          width: 72px;
          height: 72px;
          background: #2563EB;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 28px rgba(37, 99, 235, 0.22), 0 2px 8px rgba(37, 99, 235, 0.12);
          position: relative;
        }

        /* Brand text */
        .ls-brand {
          text-align: center;
          animation: ls-fade-up 0.5s ease-out 0.15s both;
        }
        @keyframes ls-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ls-brand-name {
          font-size: 24px;
          font-weight: 700;
          color: #0F172A;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .ls-brand-accent {
          color: #2563EB;
        }
        .ls-brand-sub {
          font-size: 12px;
          color: #94A3B8;
          margin-top: 5px;
          font-family: 'Figtree', sans-serif;
          letter-spacing: 0.04em;
        }

        /* Progress bar track */
        .ls-bar-wrap {
          width: 200px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          animation: ls-fade-up 0.5s ease-out 0.3s both;
        }
        .ls-bar-track {
          width: 100%;
          height: 4px;
          background: #E2E8F0;
          border-radius: 999px;
          overflow: hidden;
        }
        .ls-bar-fill {
          height: 100%;
          background: #2563EB;
          border-radius: 999px;
          transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }
        /* Shimmer on progress bar */
        .ls-bar-fill::after {
          content: '';
          position: absolute;
          top: 0; right: 0;
          width: 40px;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
          animation: ls-bar-shimmer 1.2s ease-in-out infinite;
        }
        @keyframes ls-bar-shimmer {
          from { transform: translateX(-40px); }
          to   { transform: translateX(40px); }
        }

        /* Status text */
        .ls-status {
          font-size: 11.5px;
          color: #94A3B8;
          font-family: 'Figtree', sans-serif;
          letter-spacing: 0.02em;
          height: 16px;
          transition: opacity 0.3s ease;
        }

        /* Footer */
        .ls-footer {
          position: absolute;
          bottom: 28px;
          font-size: 11px;
          color: #CBD5E1;
          font-family: 'Figtree', sans-serif;
          letter-spacing: 0.04em;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .ls-footer-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #CBD5E1;
        }
      `}</style>

      <div className={`ls-root${phase === "done" ? " done" : ""}`}>

        {/* Top progress line */}
        <div className="ls-topbar">
          <div className="ls-topbar-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Dot grid bg */}
        <div className="ls-bg-dots" />

        {/* Center */}
        <div className="ls-content">

          {/* Logo */}
          <div className="ls-logo-wrap">
            <div className="ls-logo-ring ls-logo-ring-1" />
            <div className="ls-logo-ring ls-logo-ring-2" />
            <div className="ls-logo-box">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <rect x="7"  y="7"  width="22" height="4" rx="2" fill="white"/>
                <rect x="7"  y="16" width="16" height="4" rx="2" fill="white" opacity="0.85"/>
                <rect x="7"  y="25" width="22" height="4" rx="2" fill="white"/>
                <circle cx="28" cy="18" r="2.5" fill="rgba(255,255,255,0.35)"/>
              </svg>
            </div>
          </div>

          {/* Brand */}
          <div className="ls-brand">
            <div className="ls-brand-name">
              Expify<span className="ls-brand-accent">.AI</span>
            </div>
            <div className="ls-brand-sub">Intelligent Expense Management</div>
          </div>

          {/* Progress bar + status */}
          <div className="ls-bar-wrap">
            <div className="ls-bar-track">
              <div className="ls-bar-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="ls-status">
              {progress === 100 ? "Ready ✓" : statuses[statusIndex]}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="ls-footer">
          <span>Powered by</span>
          <div className="ls-footer-dot" />
          <span>Fristine Infotech</span>
        </div>

      </div>
    </>
  );
}