"use client";

export const AdminAIBotStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  /* ── Keyframes ── */
  @keyframes fabPulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(6,182,212,0.45), 0 6px 24px rgba(99,102,241,0.4); }
    60%      { box-shadow: 0 0 0 18px rgba(6,182,212,0), 0 6px 24px rgba(99,102,241,0.4); }
  }
  @keyframes fabFloat {
    0%,100% { transform: translateY(0px) scale(1); }
    50%     { transform: translateY(-5px) scale(1.03); }
  }
  @keyframes fabGradient {
    0%,100% { background-position: 0% 50%; }
    50%     { background-position: 100% 50%; }
  }
  @keyframes fabSpin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes overlayIn {
    from { opacity:0; transform:scale(0.97) translateY(16px); filter:blur(4px); }
    to   { opacity:1; transform:scale(1)    translateY(0);    filter:blur(0); }
  }
  @keyframes overlayOut {
    from { opacity:1; transform:scale(1)    translateY(0);    filter:blur(0); }
    to   { opacity:0; transform:scale(0.97) translateY(16px); filter:blur(4px); }
  }
  @keyframes voicePanelIn {
    from { width: 0; opacity: 0; }
    to   { width: 320px; opacity: 1; }
  }
  @keyframes voicePanelOut {
    from { width: 320px; opacity: 1; }
    to   { width: 0; opacity: 0; }
  }
  @keyframes sidebarIn {
    from { opacity:0; transform:translateX(-20px); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes mainIn {
    from { opacity:0; transform:translateY(14px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes msgSlideUp {
    from { opacity:0; transform:translateY(10px) scale(0.99); }
    to   { opacity:1; transform:translateY(0)    scale(1); }
  }
  @keyframes dotBounce {
    0%,80%,100% { transform:scaleY(0.4) translateY(2px); opacity:0.35; }
    40%          { transform:scaleY(1.5) translateY(-2px); opacity:1; }
  }
  @keyframes voiceBar {
    0%,100% { transform:scaleY(0.3); }
    50%     { transform:scaleY(1); }
  }
  @keyframes ringPulse {
    0%   { transform:translate(-50%,-50%) scale(1);   opacity:0.35; }
    100% { transform:translate(-50%,-50%) scale(2.4); opacity:0; }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  @keyframes orbRotate {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes welcomeFloat {
    0%,100% { transform: translateY(0px); }
    50%     { transform: translateY(-7px); }
  }
  @keyframes gradientShift {
    0%,100% { background-position: 0% 50%; }
    50%     { background-position: 100% 50%; }
  }
  @keyframes inputGlow {
    0%,100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); }
    50%     { box-shadow: 0 0 20px 2px rgba(255,255,255,0.04); }
  }
  @keyframes newChatShine {
    from { transform: translateX(-100%) skewX(-15deg); }
    to   { transform: translateX(300%) skewX(-15deg); }
  }
  @keyframes counterPop {
    0%   { transform: scale(0.5); opacity: 0; }
    70%  { transform: scale(1.2); }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes orbPulse {
    0%,100% { opacity: 0.7; transform: scale(1); }
    50%     { opacity: 1;   transform: scale(1.05); }
  }
  @keyframes voiceOrbActive {
    0%,100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.12), 0 0 32px rgba(255,255,255,0.08); }
    50%     { box-shadow: 0 0 0 18px rgba(255,255,255,0), 0 0 48px rgba(255,255,255,0.12); }
  }

  /* ── Applied classes ── */
  .aib-overlay-in    { animation: overlayIn  0.32s cubic-bezier(0.22,1,0.36,1) forwards; }
  .aib-overlay-out   { animation: overlayOut 0.26s cubic-bezier(0.4,0,1,1) forwards; }
  .aib-voice-panel-in  { animation: voicePanelIn  0.32s cubic-bezier(0.22,1,0.36,1) forwards; overflow: hidden; }
  .aib-voice-panel-out { animation: voicePanelOut 0.24s cubic-bezier(0.4,0,1,1) forwards; overflow: hidden; }
  .aib-sidebar-in    { animation: sidebarIn 0.34s cubic-bezier(0.22,1,0.36,1) 0.04s both; }
  .aib-main-in       { animation: mainIn    0.36s cubic-bezier(0.22,1,0.36,1) 0.07s both; }
  .aib-msg-in        { animation: msgSlideUp 0.26s cubic-bezier(0.22,1,0.36,1) both; }

  .dot-bounce  { animation: dotBounce 1.1s ease-in-out infinite; }
  .voice-bar-1 { animation: voiceBar 0.7s ease-in-out infinite 0s; }
  .voice-bar-2 { animation: voiceBar 0.7s ease-in-out infinite 0.12s; }
  .voice-bar-3 { animation: voiceBar 0.7s ease-in-out infinite 0.24s; }
  .voice-bar-4 { animation: voiceBar 0.7s ease-in-out infinite 0.12s; }
  .voice-bar-5 { animation: voiceBar 0.7s ease-in-out infinite 0s; }

  .agent-ring {
    position: absolute; top: 50%; left: 50%;
    width: 120px; height: 120px; border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.18);
    animation: ringPulse 2.2s ease-out infinite;
    pointer-events: none;
  }
  .agent-ring-2 { animation-delay: 0.7s; }
  .agent-ring-3 { animation-delay: 1.4s; }

  /* ── Welcome gradient text (white shimmer) ── */
  .gemini-gradient-text {
    background: linear-gradient(90deg, #ffffff 0%, #a0a0a0 35%, #ffffff 65%, #a0a0a0 100%);
    background-size: 200%;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: shimmer 4s linear infinite;
  }

  /* ── Sidebar item hover ── */
  .aib-sidebar-item { transition: all 0.15s !important; }
  .aib-sidebar-item:hover { background: rgba(255,255,255,0.06) !important; }
  .aib-sidebar-item:hover .aib-del-btn { opacity: 1 !important; }

  /* ── Input focus ── */
  .aib-input-wrap:focus-within {
    border-color: rgba(255,255,255,0.25) !important;
    box-shadow: 0 0 0 3px rgba(255,255,255,0.04) !important;
  }

  /* ── Send button ── */
  .aib-send-btn:hover:not(:disabled) {
    transform: scale(1.06) translateY(-1px);
    box-shadow: 0 4px 20px rgba(255,255,255,0.15) !important;
  }
  .aib-send-btn { transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1) !important; }

  /* ── New chat button shine ── */
  .aib-new-chat { position: relative; overflow: hidden; }
  .aib-new-chat::after {
    content: '';
    position: absolute; top: 0; left: 0; width: 40%;
    height: 100%; background: rgba(255,255,255,0.08);
    transform: translateX(-100%) skewX(-15deg);
  }
  .aib-new-chat:hover::after { animation: newChatShine 0.5s ease forwards; }

  /* ── Mention dropdown item ── */
  .mention-item { transition: background 0.1s !important; }
  .mention-item:hover { background: rgba(255,255,255,0.07) !important; }

  /* ── Welcome orb ring ── */
  .welcome-orb-ring {
    position: absolute; inset: -6px; border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.12);
    animation: orbPulse 3s ease-in-out infinite;
  }
  .welcome-orb-ring-2 {
    inset: -14px;
    border-color: rgba(255,255,255,0.06);
    animation-delay: 0.8s;
  }
  .welcome-orb-wrap {
    animation: welcomeFloat 5s ease-in-out infinite;
  }

  /* ── Main area subtle bg ── */
  .aib-main-bg {
    background-image:
      radial-gradient(circle at 20% 50%, rgba(255,255,255,0.012) 0%, transparent 60%),
      radial-gradient(circle at 80% 20%, rgba(255,255,255,0.008) 0%, transparent 50%);
    background-size: 100% 100%, 100% 100%;
  }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.16); }

  /* ── FAB counter pop ── */
  .fab-counter { animation: counterPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both; }

  /* ── Topbar border ── */
  .aib-topbar {
    position: relative;
  }
  .aib-topbar::after {
    content: '';
    position: absolute; bottom: 0; left: 0; right: 0;
    height: 1px;
    background: rgba(255,255,255,0.07);
  }

  /* ── User message bubble ── */
  .aib-user-bubble {
    position: relative; overflow: hidden;
  }
  .aib-user-bubble::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 60%);
    pointer-events: none;
  }

  /* ── Suggestion chip hover ── */
  .aib-chip:hover { border-color: rgba(255,255,255,0.18) !important; background: rgba(255,255,255,0.07) !important; }

  /* ── Input action buttons ── */
  .aib-action-btn {
    background: none; border: none; cursor: pointer;
    color: rgba(255,255,255,0.3); padding: 6px; border-radius: 9px;
    display: flex; transition: all 0.15s; flex-shrink: 0;
  }
  .aib-action-btn:hover {
    color: rgba(255,255,255,0.75);
    background: rgba(255,255,255,0.07);
  }
  .aib-action-btn.active {
    color: rgba(255,255,255,0.9);
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.18);
  }

  /* ── Voice orb active glow ── */
  .voice-orb-active {
    animation: voiceOrbActive 2s ease-in-out infinite !important;
  }

  /* ── Voice panel divider ── */
  .aib-voice-panel-divider {
    border-left: 1px solid rgba(255,255,255,0.07);
  }

  /* ── Sidebar footer ── */
  .aib-sidebar-footer {
    background: linear-gradient(to top, rgba(23,23,23,1) 0%, rgba(23,23,23,0) 100%);
  }
`;
