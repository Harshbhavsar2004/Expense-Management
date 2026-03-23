"use client";

import { useEffect, useState } from "react";

interface LoadingScreenProps {
  onComplete?: () => void;
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [phase, setPhase] = useState<"enter" | "visible" | "done">("enter");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("visible"), 50);

    const t2 = setTimeout(() => {
      setPhase("done");
      setTimeout(() => onComplete?.(), 500);
    }, 2200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onComplete]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=DM+Sans:wght@400;500&display=swap');

        .ls-root {
          position: fixed;
          inset: 0;
          background: linear-gradient(135deg, #F8FAFC, #EEF2FF);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          transition: opacity 0.6s ease;
        }

        .ls-root.enter { opacity: 0; }
        .ls-root.visible { opacity: 1; }
        .ls-root.done { opacity: 0; pointer-events: none; }

        /* Floating animation */
        .ls-brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          animation: float 3s ease-in-out infinite;
          transition: all 0.6s ease;
        }

        .ls-root.enter .ls-brand {
          opacity: 0;
          transform: translateY(20px);
        }

        .ls-root.visible .ls-brand {
          opacity: 1;
          transform: translateY(0);
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        /* Expify text */
        .ls-name {
          font-family: 'Nunito', sans-serif;
          font-size: 44px;
          font-weight: 900;
          letter-spacing: -0.04em;
          position: relative;
          background: linear-gradient(90deg, #2563EB, #60A5FA, #2563EB);
          background-size: 200%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 2.5s infinite linear;
        }

        @keyframes shimmer {
          0% { background-position: 0%; }
          100% { background-position: 200%; }
        }

        .ls-by {
          font-family: 'DM Sans', sans-serif;
          font-size: 12px;
          font-weight: 500;
          color: #64748B;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        /* Loading dots */
        .ls-dots {
          display: flex;
          gap: 8px;
          margin-top: 32px;
        }

        .ls-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #2563EB;
          animation: bounce 1.4s infinite ease-in-out;
        }

        .ls-dot:nth-child(2) {
          animation-delay: 0.2s;
        }
        .ls-dot:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0.6);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>

      <div className={`ls-root ${phase}`}>
        <div className="ls-brand">
          <div className="ls-name">Expify</div>
          <div className="ls-by">By Fristine Infotech</div>
        </div>

        <div className="ls-dots">
          <div className="ls-dot"></div>
          <div className="ls-dot"></div>
          <div className="ls-dot"></div>
        </div>
      </div>
    </>
  );
}