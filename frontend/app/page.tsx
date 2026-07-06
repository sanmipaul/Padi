"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import Lobby from "@/components/Lobby";
import GameBoard from "@/components/GameBoard";
import Leaderboard from "@/components/Leaderboard";

const fadeUp   = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };
const fadeIn   = { initial: { opacity: 0 },         animate: { opacity: 1 } };
const scaleIn  = { initial: { opacity: 0, scale: 0.88 }, animate: { opacity: 1, scale: 1 } };
const slideLeft = { initial: { opacity: 0, x: -16 }, animate: { opacity: 1, x: 0 } };

type Screen = "onboarding" | "lobby" | "game" | "ranks";
type Overlay = null | "win" | "lose" | "daily";

interface ToastState { text: string; color: string; }

const DAILY_REWARDS = [20, 40, 60, 80, 120, 160, 300];

const COLORS = ["#EF4B3C", "#1FA85C", "#3D6BFF", "#F2A916"];

function alpha(hex: string, a: number) {
  return hex + Math.round(a * 255).toString(16).padStart(2, "0");
}

/* ─── Landing Page ───────────────────────────────────────────────── */
function LandingPage({ onConnect, isConnecting, isMiniPay }: { onConnect: () => void; isConnecting: boolean; isMiniPay: boolean }) {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      {/* Background glows */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(ellipse 80% 40% at 50% 0%,rgba(239,75,60,.18),transparent 60%),radial-gradient(circle at 15% 60%,rgba(242,169,22,.1),transparent 36%),radial-gradient(circle at 90% 40%,rgba(61,107,255,.1),transparent 36%)", pointerEvents: "none" }} />

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px clamp(16px,5vw,28px) 0", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "5px" }}>
          <span style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "28px", letterSpacing: "-1.2px", color: "#FBEFE0" }}>padi</span>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#EF4B3C", marginBottom: "5px", boxShadow: "0 0 10px #EF4B3C", display: "inline-block" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(31,168,92,.12)", border: "1px solid rgba(31,168,92,.3)", borderRadius: "999px", padding: "5px 12px" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#1FA85C", display: "inline-block" }} />
          <span style={{ color: "#6FA582", fontWeight: 700, fontSize: "11px" }}>Celo Mainnet</span>
        </div>
      </div>

      {/* Hero */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "30px 28px 0", textAlign: "center", position: "relative", gap: "8px" }}>
        {/* Colour circles — visual hint of Ludo pieces */}
        <motion.div {...fadeIn} transition={{ duration: 0.5 }} style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
          {["#EF4B3C","#1FA85C","#3D6BFF","#F2A916"].map((c, i) => (
            <div key={i} style={{ width: "18px", height: "18px", borderRadius: "50%", background: `radial-gradient(circle at 35% 30%,rgba(255,255,255,.7),${c} 65%)`, boxShadow: `0 0 12px ${c}88`, animation: `floaty ${2.6 + i * 0.4}s ease-in-out ${i * 0.3}s infinite` }} />
          ))}
        </motion.div>

        <motion.h1 className="hero-h1" {...fadeUp} transition={{ duration: 0.55, ease: "easeOut" }} style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "clamp(46px,15vw,72px)", lineHeight: 0.9, letterSpacing: "clamp(-2px,-0.05em,-3px)", color: "#FBEFE0", margin: 0 }}>
          padi
        </motion.h1>
        <motion.p {...fadeUp} transition={{ duration: 0.5, delay: 0.12, ease: "easeOut" }} style={{ color: "#F2A916", fontWeight: 700, fontSize: "clamp(12px,3.5vw,14px)", letterSpacing: "2.5px", textTransform: "uppercase", margin: "10px 0 0" }}>On-chain Ludo on Celo</motion.p>
        <motion.p {...fadeUp} transition={{ duration: 0.5, delay: 0.22, ease: "easeOut" }} style={{ color: "#A8927C", fontSize: "clamp(13px,3.8vw,15px)", lineHeight: 1.6, maxWidth: "min(290px, 85vw)", margin: "12px 0 0" }}>
          Roll the dice. Chase your AI <span style={{ color: "#FBEFE0", fontWeight: 600 }}>padis</span> off the board. Win real USDM — zero signatures during play.
        </motion.p>
      </div>

      {/* Feature cards */}
      <div style={{ padding: "28px clamp(16px,5vw,28px) 0", display: "flex", flexDirection: "column", gap: "10px", position: "relative" }}>
        {[
          { dot: "#EF4B3C", title: "Play vs up to 3 AI padis", sub: "Chidi, Amaka & Tunde — each with a personality" },
          { dot: "#F2A916", title: "Wager USDM, win 99%", sub: "One signature to start, one to settle. That's it." },
          { dot: "#1FA85C", title: "Daily streaks & prize pool", sub: "Show up every day, stack cowries & climb the ranks" },
        ].map((f, i) => (
          <motion.div key={i} {...fadeUp} transition={{ duration: 0.4, delay: 0.32 + i * 0.09, ease: "easeOut" }} style={{ display: "flex", alignItems: "center", gap: "14px", background: "rgba(255,238,214,.04)", border: "1px solid rgba(247,179,43,.1)", borderRadius: "14px", padding: "12px 14px" }}>
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: f.dot, boxShadow: `0 0 8px ${f.dot}`, flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "#FBEFE0" }}>{f.title}</p>
              <p style={{ margin: "2px 0 0", color: "#7d6a58", fontSize: "12px" }}>{f.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* CTA */}
      <motion.div {...fadeUp} transition={{ duration: 0.4, delay: 0.58, ease: "easeOut" }} style={{ padding: "24px clamp(16px,5vw,28px) max(28px,env(safe-area-inset-bottom,36px))", position: "relative" }}>
        {isMiniPay ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "9px", padding: "16px", background: "rgba(31,168,92,.12)", border: "1px solid rgba(31,168,92,.3)", borderRadius: "18px" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#1FA85C", boxShadow: "0 0 9px #1FA85C", display: "inline-block", animation: "floaty 2s ease-in-out infinite" }} />
            <span style={{ color: "#8FB99B", fontWeight: 700, fontSize: "15px" }}>Connecting MiniPay…</span>
          </div>
        ) : (
          <motion.button
            onClick={onConnect}
            disabled={isConnecting}
            whileTap={isConnecting ? {} : { scale: 0.97 }}
            style={{ width: "100%", padding: "18px", border: "none", borderRadius: "18px", background: isConnecting ? "rgba(239,75,60,.45)" : "linear-gradient(135deg,#F2622E,#EF4B3C)", color: "#fff", fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "18px", letterSpacing: ".3px", cursor: isConnecting ? "default" : "pointer", animation: isConnecting ? "none" : "glowPulse 2.8s ease-in-out infinite", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", boxShadow: "0 18px 40px -14px rgba(239,75,60,.6)" }}>
            {isConnecting ? (
              <>
                <span style={{ width: "18px", height: "18px", borderRadius: "50%", border: "2.5px solid rgba(255,255,255,.4)", borderTopColor: "#fff", animation: "spin .7s linear infinite", display: "inline-block", flexShrink: 0 }} />
                Connecting…
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/></svg>
                Connect Wallet
              </>
            )}
          </motion.button>
        )}
        <p style={{ textAlign: "center", color: "#5a4a3a", fontSize: "11px", margin: "12px 0 0" }}>Free to play · Optional USDM wagers · Fully on-chain</p>
      </motion.div>
    </div>
  );
}

/* ─── App Bar ─────────────────────────────────────────────────────── */
function AppBar({ address, cowries, streak, onDisconnect }: { address?: string; cowries: number; streak: number; onDisconnect: () => void }) {
  const { disconnect } = useDisconnect();
  const [showDisconnect, setShowDisconnect] = useState(false);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px clamp(14px,4.5vw,22px) 10px", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", flexShrink: 0 }}>
        <span style={{ fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: "clamp(20px,6vw,26px)", letterSpacing: "-1px", color: "#FBEFE0" }}>padi</span>
        <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#EF4B3C", marginBottom: "5px", boxShadow: "0 0 8px #EF4B3C", display: "inline-block" }} />
      </div>
      <div className="appbar-inner" style={{ display: "flex", gap: "7px", alignItems: "center", flexWrap: "nowrap", minWidth: 0 }}>
        {/* Streak */}
        <div style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(242,169,22,.13)", border: "1px solid rgba(242,169,22,.3)", borderRadius: "999px", padding: "5px 10px", flexShrink: 0 }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#F2A916", boxShadow: "0 0 8px #F2A916", display: "inline-block" }} />
          <span style={{ color: "#F2A916", fontWeight: 800, fontSize: "12px" }}>{streak}</span>
          <span style={{ color: "#C99A2E", fontWeight: 600, fontSize: "11px" }}>day</span>
        </div>
        {/* Cowries */}
        <div style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(255,238,214,.05)", border: "1px solid rgba(247,179,43,.14)", borderRadius: "999px", padding: "5px 10px", flexShrink: 0 }}>
          <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#FCE2A0,#E8A21C)", display: "inline-block", flexShrink: 0 }} />
          <span className="appbar-cowries-text" style={{ color: "#F4D8A8", fontWeight: 800, fontSize: "12px" }}>{cowries.toLocaleString()}</span>
        </div>
        {/* Wallet chip → tapping shows disconnect */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setShowDisconnect(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(255,238,214,.05)", border: "1px solid rgba(247,179,43,.18)", borderRadius: "999px", padding: "5px 10px", cursor: "pointer" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#1FA85C", boxShadow: "0 0 6px #1FA85C", display: "inline-block", flexShrink: 0 }} />
            <span style={{ color: "#A8927C", fontWeight: 600, fontSize: "11px" }}>
              {address ? `${address.slice(0, 4)}…${address.slice(-3)}` : "●●"}
            </span>
          </button>
          {/* Disconnect dropdown */}
          {showDisconnect && (
            <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 40, background: "#1e1108", border: "1px solid rgba(247,179,43,.2)", borderRadius: "14px", padding: "6px", minWidth: "160px", boxShadow: "0 16px 36px -12px #000" }}>
              {address && (
                <div style={{ padding: "8px 12px 6px", borderBottom: "1px solid rgba(255,238,214,.07)", marginBottom: "4px" }}>
                  <p style={{ margin: 0, color: "#6f5d4c", fontSize: "10px", fontWeight: 600 }}>CONNECTED AS</p>
                  <p style={{ margin: "2px 0 0", color: "#A8927C", fontSize: "12px", fontWeight: 600, wordBreak: "break-all" }}>{address.slice(0, 10)}…{address.slice(-6)}</p>
                </div>
              )}
              <button
                onClick={() => { disconnect(); setShowDisconnect(false); onDisconnect(); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: "9px", padding: "10px 12px", borderRadius: "10px", background: "rgba(239,75,60,.1)", border: "1px solid rgba(239,75,60,.2)", color: "#EF4B3C", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Disconnect Wallet
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Bottom Nav ─────────────────────────────────────────────────── */
function BottomNav({ screen, onNavigate }: { screen: Screen; onNavigate: (to: "lobby" | "daily" | "ranks") => void }) {
  const tabs: Array<{ id: "lobby" | "daily" | "ranks"; label: string; shape: React.CSSProperties }> = [
    { id: "lobby", label: "Home", shape: { borderRadius: "6px" } },
    { id: "daily", label: "Rewards", shape: { borderRadius: "50%" } },
    { id: "ranks", label: "Ranks", shape: { borderRadius: "3px", transform: "rotate(45deg)" } },
  ];
  return (
    <div style={{ display: "flex", flexShrink: 0, background: "rgba(18,11,5,.94)", backdropFilter: "blur(12px)", borderTop: "1px solid rgba(247,179,43,.13)", padding: `10px clamp(20px,8vw,40px) max(16px,env(safe-area-inset-bottom,16px))`, zIndex: 30 }}>
      {tabs.map(({ id, label, shape }) => {
        const active = screen === id;
        return (
          <button key={id} onClick={() => onNavigate(id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}>
            <div style={{ width: "20px", height: "20px", border: `2.5px solid ${active ? "#EF4B3C" : "#8c7866"}`, ...shape }} />
            <span style={{ fontSize: "10px", fontWeight: 700, color: active ? "#EF4B3C" : "#8c7866" }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Win / Lose Overlay ─────────────────────────────────────────── */
function WinOverlay({ won, lastReward, onPlayAgain, onClose }: { won: boolean; lastReward: number; onPlayAgain: () => void; onClose: () => void }) {
  const confetti = Array.from({ length: 42 }, (_, i) => {
    const left = Math.random() * 100;
    const delay = Math.random() * 0.7;
    const dur = 2.4 + Math.random() * 1.7;
    const sz = 6 + Math.random() * 8;
    return (
      <div key={i} style={{ position: "absolute", top: "-20px", left: `${left}%`, width: `${sz}px`, height: `${sz * 0.62}px`, background: COLORS[i % COLORS.length], borderRadius: "2px", animation: `confettiFall ${dur}s linear ${delay}s infinite`, opacity: 0.92 }} />
    );
  });

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(8,5,2,.8)", backdropFilter: "blur(7px)", padding: "24px" }}>
      {won && <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>{confetti}</div>}
      <div style={{ position: "relative", width: "100%", maxWidth: "370px", background: "linear-gradient(180deg,#2a1a10,#1a0f07)", border: "1px solid rgba(247,179,43,.2)", borderRadius: "26px", padding: "32px 24px 24px", textAlign: "center", animation: "popIn .42s cubic-bezier(.2,1.3,.4,1)", boxShadow: "0 30px 70px -20px #000" }}>
        <div style={{ width: "64px", height: "64px", margin: "0 auto 14px", borderRadius: "50%", background: won ? "rgba(31,168,92,.2)" : "rgba(239,75,60,.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "30px" }}>
          {won ? "★" : "↺"}
        </div>
        <div style={{ fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: "32px", color: won ? "#5BD08A" : "#EF4B3C", lineHeight: 1 }}>
          {won ? "You win!" : "Padi wins"}
        </div>
        <p style={{ margin: "10px auto 0", color: "#C9B49C", fontSize: "14px", maxWidth: "260px", lineHeight: 1.5 }}>
          {won ? "You walked your last piece home. Cowries incoming!" : "Tough one — your padi reached home first. Run it back."}
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "9px", margin: "18px 0", background: "rgba(242,169,22,.1)", border: "1px solid rgba(242,169,22,.26)", borderRadius: "14px", padding: "13px" }}>
          <span style={{ width: "20px", height: "20px", borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#FCE2A0,#E8A21C)", display: "inline-block" }} />
          <span style={{ fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: "20px", color: "#F4C95A" }}>+{lastReward} cowries</span>
        </div>
        <button onClick={onPlayAgain} style={{ width: "100%", padding: "15px", border: "none", borderRadius: "15px", background: "linear-gradient(135deg,#F2622E,#EF4B3C)", color: "#fff", fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: "16px", cursor: "pointer", boxShadow: "0 12px 26px -10px rgba(239,75,60,.7)" }}>
          Play again
        </button>
        <button onClick={onClose} style={{ width: "100%", marginTop: "10px", padding: "13px", border: "1px solid rgba(247,179,43,.16)", borderRadius: "15px", background: "transparent", color: "#C9B49C", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}>
          Back to lobby
        </button>
      </div>
    </div>
  );
}

/* ─── Daily Rewards Overlay ──────────────────────────────────────── */
function DailyOverlay({ streak, dailyClaimed, onClaim, onClose }: { streak: number; dailyClaimed: boolean; onClaim: () => void; onClose: () => void }) {
  const cur = Math.min(Math.max(streak, 1), 7);
  const todayReward = DAILY_REWARDS[cur - 1];

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(8,5,2,.78)", backdropFilter: "blur(6px)" }}>
      <div style={{ width: "100%", background: "linear-gradient(180deg,#241509,#180e06)", borderTop: "1px solid rgba(247,179,43,.2)", borderRadius: "26px 26px 0 0", padding: `24px clamp(16px,5vw,24px) max(24px,env(safe-area-inset-bottom,30px))`, animation: "popIn .35s ease-out" }}>
        <div style={{ width: "40px", height: "4px", borderRadius: "4px", background: "rgba(247,179,43,.25)", margin: "0 auto 18px" }} />
        <p style={{ margin: 0, fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: "22px", color: "#FBEFE0", textAlign: "center" }}>Daily cowries</p>
        <p style={{ margin: "5px 0 18px", color: "#A8927C", fontSize: "13px", textAlign: "center" }}>Show up every day, grow your streak, stack rewards</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "clamp(4px,1.5vw,8px)" }}>
          {DAILY_REWARDS.map((rw, idx) => {
            const day = idx + 1;
            const past = day < cur;
            const today = day === cur;
            return (
              <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "clamp(6px,2vw,10px) 1px clamp(5px,1.8vw,8px)", borderRadius: "10px", background: today ? "rgba(242,169,22,.18)" : past ? "rgba(31,168,92,.1)" : "rgba(255,238,214,.04)", border: `1px solid ${today ? "#F2A916" : past ? "rgba(31,168,92,.3)" : "rgba(255,238,214,.07)"}` }}>
                <span style={{ fontSize: "clamp(7px,2.2vw,9px)", fontWeight: 800, color: today ? "#F4C95A" : past ? "#6FA582" : "#8c7866" }}>D{day}</span>
                <span style={{ width: "clamp(12px,3.5vw,15px)", height: "clamp(12px,3.5vw,15px)", borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#FCE2A0,#E8A21C)", margin: "3px 0 2px", opacity: 0.95, display: "inline-block" }} />
                <span style={{ fontSize: "clamp(9px,2.8vw,11px)", fontWeight: 800, color: today ? "#FBEFE0" : past ? "#9FC2AC" : "#A8927C" }}>{rw}</span>
              </div>
            );
          })}
        </div>

        <button
          onClick={onClaim}
          style={{ width: "100%", marginTop: "18px", padding: "15px", border: "none", borderRadius: "15px", cursor: "pointer", fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: "16px", color: dailyClaimed ? "#8c7866" : "#06140b", background: dailyClaimed ? "rgba(255,238,214,.06)" : "linear-gradient(135deg,#34C46E,#1FA85C)", boxShadow: dailyClaimed ? "none" : "0 12px 26px -10px rgba(31,168,92,.7)" }}>
          {dailyClaimed ? "Already claimed today" : `Claim ${todayReward} cowries`}
        </button>
        <button onClick={onClose} style={{ width: "100%", marginTop: "9px", padding: "11px", border: "none", background: "transparent", color: "#8c7866", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
          Maybe later
        </button>
      </div>
    </div>
  );
}

/* ─── Root Page ──────────────────────────────────────────────────── */
export default function Home() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connect, connectors } = useConnect();

  // Mount guard: wagmi with ssr:false still server-renders in Next.js App Router.
  // The server has no wallet (isConnected=false) while the client may already be
  // connected, causing React hydration error #418. Render nothing until mounted.
  const [mounted, setMounted] = useState(false);

  const [screen, setScreen] = useState<Screen>("onboarding");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [gameId, setGameId] = useState<bigint | null>(null);
  const [cowries, setCowries] = useState(0);
  const [streak, setStreak] = useState(0);
  const [localWins, setLocalWins] = useState(0);
  const [lastReward, setLastReward] = useState(0);
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [won, setWon] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isMiniPay, setIsMiniPay] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mark as mounted so we skip the server-rendered shell entirely
  useEffect(() => { setMounted(true); }, []);

  // Auto-connect when running inside MiniPay (wallet is injected automatically)
  useEffect(() => {
    if (typeof window !== "undefined" && (window.ethereum as { isMiniPay?: boolean } | undefined)?.isMiniPay) {
      setIsMiniPay(true);
      const connector = connectors[0];
      if (connector) connect({ connector });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate to lobby once wallet connects
  useEffect(() => {
    if (isConnected && screen === "onboarding") setScreen("lobby");
  }, [isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate back to landing when wallet disconnects (button or external)
  useEffect(() => {
    if (!isConnected && mounted && screen !== "onboarding") {
      setScreen("onboarding");
      setGameId(null);
      setOverlay(null);
    }
  }, [isConnected, mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load per-wallet data from localStorage once address is known
  useEffect(() => {
    if (!address || !mounted) return;
    const key = `padi:${address.toLowerCase()}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const data = JSON.parse(raw);
      setCowries(data.cowries ?? 0);
      setStreak(data.streak ?? 0);
      setLocalWins(data.localWins ?? 0);
      setDailyClaimed(data.lastClaim === new Date().toDateString());
    } catch {}
  }, [address, mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist cowries / streak / daily claim whenever they change
  useEffect(() => {
    if (!address || !mounted) return;
    const key = `padi:${address.toLowerCase()}`;
    localStorage.setItem(key, JSON.stringify({
      cowries,
      streak,
      localWins,
      lastClaim: dailyClaimed ? new Date().toDateString() : null,
    }));
  }, [cowries, streak, localWins, dailyClaimed, address, mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  function showToast(text: string, color: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, color });
    toastTimer.current = setTimeout(() => setToast(null), 1900);
  }

  function handleConnect() {
    const connector = connectors[0];
    if (connector) connect({ connector });
  }

  function handleEnterGame(id: bigint) {
    setGameId(id);
    setScreen("game");
  }

  function handleBack() {
    setScreen("lobby");
    setGameId(null);
  }

  function handleGameEnd(didWin: boolean) {
    const reward = didWin ? 250 : 25;
    setWon(didWin);
    setLastReward(reward);
    setCowries((c) => c + reward);
    if (didWin) {
      setStreak((s) => s + 1);
      setLocalWins((w) => w + 1);
    }
    setOverlay(didWin ? "win" : "lose");
  }

  function handleClaimDaily() {
    if (dailyClaimed) { setOverlay(null); return; }
    const cur = Math.min(Math.max(streak, 1), 7);
    const reward = DAILY_REWARDS[cur - 1];
    setCowries((c) => c + reward);
    setStreak((s) => s + 1);
    setDailyClaimed(true);
    setOverlay(null);
    showToast(`+${reward} cowries claimed!`, "#F2A916");
  }

  function handleNavigation(to: "lobby" | "daily" | "ranks") {
    if (to === "daily") { setOverlay("daily"); return; }
    setScreen(to);
  }

  const isApp = screen === "lobby" || screen === "game" || screen === "ranks";

  if (!mounted) return null;

  return (
    <div className="app-shell">

      {/* Toast */}
      {toast && (
        <div style={{ position: "absolute", top: "14px", left: "50%", zIndex: 60, display: "flex", alignItems: "center", gap: "9px", background: "rgba(26,15,7,.96)", backdropFilter: "blur(10px)", border: `1px solid ${toast.color}`, borderRadius: "999px", padding: "9px 16px 9px 12px", boxShadow: "0 14px 34px -12px #000", animation: "slideToast .25s ease-out", transform: "translateX(-50%)" }}>
          <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: toast.color, boxShadow: `0 0 9px ${toast.color}`, display: "inline-block" }} />
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#FBEFE0" }}>{toast.text}</span>
        </div>
      )}

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto" }} className="no-scrollbar">
        {screen === "onboarding" && (
          <LandingPage onConnect={handleConnect} isConnecting={isConnecting} isMiniPay={isMiniPay} />
        )}

        {isApp && (
          <>
            <AppBar address={address} cowries={cowries} streak={streak} onDisconnect={() => { setScreen("onboarding"); setGameId(null); setOverlay(null); }} />
            <div style={{ padding: `4px clamp(14px,4.5vw,22px) 88px` }}>
              {screen === "lobby" && (
                <Lobby
                  cowries={cowries}
                  streak={streak}
                  localWins={localWins}
                  dailyClaimed={dailyClaimed}
                  onEnterGame={handleEnterGame}
                  onOpenDaily={() => setOverlay("daily")}
                  onViewRanks={() => setScreen("ranks")}
                  showToast={showToast}
                />
              )}
              {screen === "game" && gameId !== null && (
                <GameBoard
                  gameId={gameId}
                  onBack={handleBack}
                  onGameEnd={handleGameEnd}
                  showToast={showToast}
                />
              )}
              {screen === "ranks" && (
                <Leaderboard onBack={() => setScreen("lobby")} localWins={localWins} />
              )}
            </div>
          </>
        )}
      </div>

      {/* Bottom Nav — only in app screens, not during active game */}
      {isApp && screen !== "game" && (
        <BottomNav screen={screen} onNavigate={handleNavigation} />
      )}

      {/* Overlays */}
      {(overlay === "win" || overlay === "lose") && (
        <WinOverlay
          won={won}
          lastReward={lastReward}
          onPlayAgain={() => { setOverlay(null); setScreen("lobby"); setGameId(null); }}
          onClose={() => { setOverlay(null); setScreen("lobby"); setGameId(null); }}
        />
      )}
      {overlay === "daily" && (
        <DailyOverlay
          streak={streak}
          dailyClaimed={dailyClaimed}
          onClaim={handleClaimDaily}
          onClose={() => setOverlay(null)}
        />
      )}
    </div>
  );
}
