"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface LoadingScreenProps {
  onComplete?: () => void;
  /** Minimum display time in ms (default 2500) */
  minDuration?: number;
}

export function LoadingScreen({
  onComplete,
  minDuration = 1800,
}: LoadingScreenProps) {
  const [phase, setPhase] = useState<"enter" | "typing" | "hold" | "exit" | "done">("enter");
  const [revealedCount, setRevealedCount] = useState(0);
  const [showTagline, setShowTagline] = useState(false);
  const [barGo, setBarGo] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const letters = "EXPIFY".split("");

  const stableOnComplete = useCallback(() => {
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    // Phase 1 — fade in
    const t0 = setTimeout(() => setPhase("typing"), 80);

    // Phase 2 — type each letter
    const charTimers: ReturnType<typeof setTimeout>[] = [];
    letters.forEach((_, i) => {
      charTimers.push(
        setTimeout(() => setRevealedCount(i + 1), 400 + i * 140)
      );
    });

    // Phase 3 — show tagline + progress bar
    const tagDelay = 400 + letters.length * 140 + 200;
    const t1 = setTimeout(() => setShowTagline(true), tagDelay);
    const t2 = setTimeout(() => setBarGo(true), tagDelay + 200);

    // Phase 4 — exit
    const exitAt = Math.max(minDuration, tagDelay + 400);
    const t3 = setTimeout(() => setPhase("exit"), exitAt);
    const t4 = setTimeout(() => {
      setPhase("done");
      stableOnComplete();
    }, exitAt + 600);

    return () => {
      clearTimeout(t0);
      charTimers.forEach(clearTimeout);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(timerRef.current);
    };
  }, [minDuration, stableOnComplete]);

  if (phase === "done") return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@500;600;700&display=swap');

        .expify-ls {
          position: fixed; inset: 0; z-index: 9999;
          background: linear-gradient(160deg, #FAFAFA 0%, #F1F3F8 100%);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          opacity: 0;
          transition: opacity 0.5s ease;
        }
        .expify-ls.typing,
        .expify-ls.hold { opacity: 1; }
        .expify-ls.exit { opacity: 0; pointer-events: none; transition: opacity 0.6s ease; }

        .expify-typing-row {
          display: flex; align-items: center; height: 64px;
        }

        .expify-char {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 52px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: #0F172A;
          display: inline-block;
          opacity: 0;
          transform: translateY(18px);
          transition: opacity 0.32s cubic-bezier(0.22, 1, 0.36, 1),
                      transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .expify-char.show {
          opacity: 1;
          transform: translateY(0);
        }

        .expify-cursor {
          width: 3px; height: 44px; margin-left: 4px;
          background: #0F172A;
          animation: expify-blink 0.8s step-end infinite;
          transition: opacity 0.3s ease;
        }
        .expify-ls.exit .expify-cursor,
        .expify-ls.enter .expify-cursor { opacity: 0; }

        @keyframes expify-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        .expify-tagline {
          font-family: 'Inter', sans-serif;
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.22em; text-transform: uppercase;
          color: #64748B;
          margin-top: 14px;
          opacity: 0; transform: translateY(8px);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .expify-tagline.show {
          opacity: 1; transform: translateY(0);
        }

        .expify-bar-track {
          width: 120px; height: 2px; margin-top: 36px;
          background: #E2E8F0; border-radius: 1px;
          overflow: hidden;
          opacity: 0; transition: opacity 0.4s ease;
        }
        .expify-bar-track.show { opacity: 1; }

        .expify-bar-fill {
          width: 0; height: 100%;
          background: #0F172A; border-radius: 1px;
          transition: width 1.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .expify-bar-fill.go { width: 100%; }
      `}</style>

      <div className={`expify-ls ${phase}`}>
        <div className="expify-typing-row">
          {letters.map((char, i) => (
            <span
              key={i}
              className={`expify-char ${i < revealedCount ? "show" : ""}`}
            >
              {char}
            </span>
          ))}
          <div className="expify-cursor" />
        </div>

        <div className={`expify-tagline ${showTagline ? "show" : ""}`}>
          By Fristine Infotech
        </div>

        <div className={`expify-bar-track ${showTagline ? "show" : ""}`}>
          <div className={`expify-bar-fill ${barGo ? "go" : ""}`} />
        </div>
      </div>
    </>
  );
}