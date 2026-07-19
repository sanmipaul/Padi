"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { celo } from "wagmi/chains";
import { useActiveAccount } from "thirdweb/react";
import Lobby from "@/components/Lobby";
import GameBoard from "@/components/GameBoard";
import Leaderboard from "@/components/Leaderboard";
import PvPGameBoard, { type PvpMeta } from "@/components/PvPGameBoard";
import AuthModal from "@/components/AuthModal";

type Screen = "onboarding" | "lobby" | "game" | "pvp" | "ranks" | "matchmaking";
type Overlay = null | "win" | "lose" | "daily" | "cowries" | "profile" | "room";

interface ToastState { text: string; color: string }

const DAILY_REWARDS = [20, 40, 60, 80, 120, 160, 300];
const COLORS = ["#34E0C4", "#8B7CFF", "#FF5C8A", "#FFB23E"];

/* ── Background orbs + grid ─────────────────────────────────────── */
function BgLayer() {
  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", background: "#07070C" }} />
      <div style={{ position: "fixed", top: "-10%", left: "10%", width: "46vw", height: "46vw", maxWidth: 640, maxHeight: 640, zIndex: 0, pointerEvents: "none", background: "radial-gradient(circle,rgba(123,97,255,.2),transparent 62%)", filter: "blur(20px)", animation: "orbDrift1 14s ease-in-out infinite" }} />
      <div style={{ position: "fixed", top: "0%", right: "6%", width: "38vw", height: "38vw", maxWidth: 520, maxHeight: 520, zIndex: 0, pointerEvents: "none", background: "radial-gradient(circle,rgba(52,224,196,.14),transparent 60%)", filter: "blur(20px)", animation: "orbDrift2 18s ease-in-out infinite" }} />
      <div style={{ position: "fixed", bottom: "-8%", left: "40%", width: "40vw", height: "40vw", maxWidth: 560, maxHeight: 560, zIndex: 0, pointerEvents: "none", background: "radial-gradient(circle,rgba(255,92,138,.1),transparent 62%)", filter: "blur(20px)", animation: "orbDrift3 20s ease-in-out infinite" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: .45, backgroundImage: "linear-gradient(rgba(255,255,255,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.022) 1px,transparent 1px)", backgroundSize: "46px 46px" }} />
    </>
  );
}

/* ── Mini demo board for hero ────────────────────────────────────── */
function HeroBoard() {
  const DEMO_PIECES = [
    { seat: 0, col: 7, row: 9 }, { seat: 0, col: 6, row: 8 },
    { seat: 1, col: 8, row: 5 }, { seat: 1, col: 9, row: 8 },
    { seat: 2, col: 5, row: 6 }, { seat: 3, col: 7, row: 11 },
  ];
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const inCenter = r >= 6 && r <= 8 && c >= 6 && c <= 8;
      const isPath = !inCenter && ((r === 7 && c >= 0 && c <= 14) || (c === 7 && r >= 0 && r <= 14));
      let bg = "rgba(255,255,255,.045)";
      if (inCenter) bg = c === 7 && r === 7 ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.06)";
      else if (isPath) bg = "rgba(255,255,255,.1)";
      else if (r >= 9 && c <= 5) bg = "rgba(52,224,196,.2)";
      else if (r <= 5 && c >= 9) bg = "rgba(139,124,255,.2)";
      else if (r <= 5 && c <= 5) bg = "rgba(255,178,62,.2)";
      else if (r >= 9 && c >= 9) bg = "rgba(255,92,138,.2)";
      const piece = DEMO_PIECES.find(p => p.col === c && p.row === r);
      cells.push(
        <div key={`${c},${r}`} style={{ background: bg, borderRadius: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {piece && <div style={{ width: "70%", height: "70%", borderRadius: "50%", background: `radial-gradient(circle at 35% 30%,rgba(255,255,255,.8),${COLORS[piece.seat]} 62%)`, boxShadow: `0 2px 6px ${COLORS[piece.seat]}88` }} />}
        </div>
      );
    }
  }
  return (
    <div style={{ width: "100%", aspectRatio: "1/1", display: "grid", gridTemplateColumns: "repeat(15,1fr)", gridTemplateRows: "repeat(15,1fr)", gap: 1, padding: 6, background: "#0B0B14", borderRadius: 14, border: "1px solid rgba(255,255,255,.08)" }}>
      {cells}
    </div>
  );
}

/* ── Landing Page ────────────────────────────────────────────────── */
function LandingPage({ onConnect, onGuest }: { onConnect: () => void; onGuest: () => void }) {

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Nav bar */}
      <div style={{ flexShrink: 0, backdropFilter: "blur(16px)", background: "rgba(7,7,12,.72)", borderBottom: "1px solid rgba(255,255,255,.07)", padding: "10px clamp(14px,4vw,32px)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#7B61FF", boxShadow: "0 0 12px #7B61FF", display: "inline-block" }} />
          <span style={{ fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "-.4px" }}>padi</span>
        </div>
        <motion.button onClick={onConnect} whileTap={{ scale: 0.97 }}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#8B7CFF,#5C6BFF)", color: "#fff", fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 13, boxShadow: "0 8px 22px -8px rgba(123,97,255,.7)" }}>
          Sign in
        </motion.button>
      </div>

      {/* Main — fills remaining height, centered */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", padding: "0 clamp(14px,4vw,40px)", gap: "clamp(20px,4vw,56px)" }}>

        {/* Left: copy + buttons */}
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 999, padding: "5px 12px", marginBottom: 14 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34E0C4", boxShadow: "0 0 7px #34E0C4", animation: "shimmer 1.6s infinite", display: "inline-block" }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".9px", color: "#B9B9D0" }}>ON-CHAIN LUDO · CELO</span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.48, delay: 0.06 }}
            style={{ fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: "clamp(28px,5.5vw,58px)", lineHeight: 1.04, letterSpacing: -1.5, margin: "0 0 10px", color: "#ECECF2" }}>
            Roll the dice.<br />Beat your padi.<br />
            <span style={{ background: "linear-gradient(120deg,#34E0C4,#7B61FF 55%,#FF5C8A)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Win crypto.</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.14 }}
            style={{ color: "#9C9CB6", fontSize: "clamp(13px,1.5vw,16px)", lineHeight: 1.55, margin: "0 0 18px", maxWidth: 420 }}>
            Classic Ludo on-chain — take on AI padis, race your tokens home, and win USDM from the weekly pot.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
            <motion.button onClick={onConnect} whileTap={{ scale: 0.97 }}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 22px", borderRadius: 12, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#8B7CFF,#5C6BFF)", color: "#fff", fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 15, boxShadow: "0 12px 28px -10px rgba(123,97,255,.7)", animation: "glowPulse 2.8s infinite" }}>
              Sign in
            </motion.button>
            <motion.button onClick={onGuest} whileTap={{ scale: 0.97 }}
              style={{ padding: "13px 20px", borderRadius: 12, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.12)", color: "#ECECF2", fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 15, cursor: "pointer" }}>
              Play as guest
            </motion.button>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }}
            style={{ display: "flex", flexWrap: "wrap", gap: 14, color: "#74748C", fontSize: 12, fontWeight: 600 }}>
            {["Free to play", "USDM stakes optional", "Non-custodial"].map(t => (
              <span key={t} style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ color: "#34E0C4" }}>✓</span>{t}</span>
            ))}
          </motion.div>

          {/* Mini stats — only on wider screens */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.34 }}
            style={{ display: "flex", gap: 16, marginTop: 20, flexWrap: "wrap" }}>
            {[["482.5 USDM", "weekly pot"], ["12k+", "players"], ["86k", "games"]].map(([val, label]) => (
              <div key={label} style={{ textAlign: "left" }}>
                <div style={{ fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: "clamp(15px,2vw,20px)", color: "#34E0C4" }}>{val}</div>
                <div style={{ fontSize: 11, color: "#74748C", fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Right: board preview — hidden on very small screens */}
        <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.1 }}
          style={{ flex: "0 0 auto", width: "min(42vw, min(45vh, 340px))", display: "flex", flexDirection: "column", position: "relative", animation: "floaty 7s ease-in-out .8s infinite" }}>
          <div style={{ position: "absolute", inset: "-10%", background: "radial-gradient(circle,rgba(123,97,255,.28),transparent 65%)", filter: "blur(18px)" }} />
          <div style={{ position: "relative", padding: 12, borderRadius: 22, background: "linear-gradient(160deg,rgba(255,255,255,.08),rgba(255,255,255,.02))", border: "1px solid rgba(255,255,255,.12)", boxShadow: "0 30px 70px -24px rgba(0,0,0,.9)" }}>
            <HeroBoard />
          </div>
          <div style={{ position: "absolute", top: -12, right: -8, display: "flex", alignItems: "center", gap: 6, background: "rgba(10,10,18,.94)", border: "1px solid rgba(52,224,196,.38)", borderRadius: 10, padding: "7px 10px" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#34E0C4", boxShadow: "0 0 8px #34E0C4", animation: "shimmer 1.6s infinite", display: "inline-block" }} />
            <div style={{ lineHeight: 1.1 }}>
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: ".7px", color: "#6FE6CF" }}>LIVE POT</div>
              <div style={{ fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 13, color: "#fff" }}>482.5 USDM</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Footer strip */}
      <div style={{ flexShrink: 0, padding: "8px clamp(14px,4vw,32px)", borderTop: "1px solid rgba(255,255,255,.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#4A4A5C", fontWeight: 600 }}>Built on Celo · Non-custodial</span>
        <span style={{ fontSize: 11, color: "#4A4A5C" }}>© 2025 Padi</span>
      </div>
    </div>
  );
}

/* ── App Bar ─────────────────────────────────────────────────────── */
function AppBar({ address, cowries, dailyClaimed, screen, onLogoClick, onLeaderboard, onCowriesClick, onProfile }: {
  address?: string; cowries: number; dailyClaimed: boolean; screen: Screen;
  onLogoClick: () => void; onLeaderboard: () => void; onCowriesClick: () => void; onProfile: () => void;
}) {
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 20, backdropFilter: "blur(16px)", background: "rgba(7,7,12,.72)", borderBottom: "1px solid rgba(255,255,255,.07)", flexShrink: 0 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "12px clamp(16px,4vw,40px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <button onClick={onLogoClick} style={{ display: "flex", alignItems: "center", gap: 9, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#7B61FF", boxShadow: "0 0 14px #7B61FF", display: "inline-block" }} />
          <span style={{ fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 20, letterSpacing: "-.5px", color: "#ECECF2" }}>padi</span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <button onClick={onLeaderboard} style={{ background: screen === "ranks" ? "rgba(123,97,255,.16)" : "rgba(255,255,255,.05)", border: `1px solid ${screen === "ranks" ? "rgba(123,97,255,.4)" : "rgba(255,255,255,.1)"}`, color: "#ECECF2", fontFamily: "var(--font-manrope),'Manrope',sans-serif", fontWeight: 600, fontSize: 13, borderRadius: 10, padding: "8px 14px", cursor: "pointer" }}>Leaderboard</button>
          <button onClick={onCowriesClick} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 11, padding: "6px 12px", cursor: "pointer" }}>
            <span style={{ width: 14, height: 14, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#fff,#34E0C4 62%)", display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 13, color: "#34E0C4" }}>{cowries.toLocaleString()}</span>
            {!dailyClaimed && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#FFB23E", boxShadow: "0 0 7px #FFB23E", animation: "badgePulse 1.4s infinite", marginLeft: 2, display: "inline-block" }} />}
          </button>
          <button onClick={onProfile} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 11, padding: "6px 12px", cursor: "pointer" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#34E0C4", boxShadow: "0 0 7px #34E0C4", display: "inline-block" }} />
            <span style={{ fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 13, color: "#C5C5D8", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Guest"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Win/Lose Overlay ────────────────────────────────────────────── */
function WinOverlay({ won, lastReward, onPlayAgain, onClose }: { won: boolean; lastReward: number; onPlayAgain: () => void; onClose: () => void }) {
  const confetti = Array.from({ length: 46 }, (_, i) => {
    const cols = ["#34E0C4", "#8B7CFF", "#FF5C8A", "#FFB23E", "#5C6BFF"];
    return <div key={i} style={{ position: "absolute", top: -20, left: `${Math.random() * 100}%`, width: `${6 + Math.random() * 8}px`, height: `${(6 + Math.random() * 8) * .62}px`, background: cols[i % cols.length], borderRadius: 2, animation: `confettiFall ${2.4 + Math.random() * 1.8}s linear ${Math.random() * .7}s infinite`, opacity: .92 }} />;
  });
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(5,5,9,.82)", backdropFilter: "blur(8px)", padding: 24 }}>
      {won && <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>{confetti}</div>}
      <motion.div initial={{ opacity: 0, scale: 0.82 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.42, ease: [0.2, 1.3, 0.4, 1] }}
        style={{ position: "relative", width: "100%", maxWidth: 400, background: "linear-gradient(180deg,rgba(22,22,34,.98),rgba(12,12,20,.98))", border: "1px solid rgba(255,255,255,.12)", borderRadius: 26, padding: "34px 26px 26px", textAlign: "center", boxShadow: "0 40px 90px -24px #000" }}>
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.15, duration: 0.4, ease: [0.2, 1.3, 0.4, 1] }}
          style={{ width: 70, height: 70, margin: "0 auto 16px", borderRadius: "50%", background: won ? "rgba(52,224,196,.18)" : "rgba(255,92,138,.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>
          {won ? "★" : "↺"}
        </motion.div>
        <div style={{ fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 34, color: won ? "#34E0C4" : "#FF5C8A", lineHeight: 1, letterSpacing: -1 }}>{won ? "You win!" : "Padi wins"}</div>
        <p style={{ margin: "12px auto 0", color: "#9C9CB6", fontSize: 14.5, maxWidth: 280, lineHeight: 1.5 }}>{won ? "You walked your last token home. Cowries incoming!" : "Tough one — your padi reached home first. Run it back."}</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, margin: "20px 0", background: "rgba(52,224,196,.1)", border: "1px solid rgba(52,224,196,.28)", borderRadius: 14, padding: 14 }}>
          <span style={{ width: 22, height: 22, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#fff,#34E0C4 62%)", display: "inline-block" }} />
          <span style={{ fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 20, color: "#34E0C4" }}>+{lastReward} cowries</span>
        </div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={onPlayAgain} style={{ width: "100%", padding: 16, border: "none", borderRadius: 14, background: "linear-gradient(135deg,#8B7CFF,#5C6BFF)", color: "#fff", fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 16, cursor: "pointer", boxShadow: "0 14px 30px -10px rgba(123,97,255,.7)" }}>Play again</motion.button>
        <button onClick={onClose} style={{ width: "100%", marginTop: 10, padding: 13, border: "1px solid rgba(255,255,255,.12)", borderRadius: 14, background: "transparent", color: "#B9B9D0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Back to lobby</button>
      </motion.div>
    </div>
  );
}

/* ── Daily Overlay ───────────────────────────────────────────────── */
function DailyOverlay({ streak, dailyClaimed, onClaim, onClose }: { streak: number; dailyClaimed: boolean; onClaim: () => void; onClose: () => void }) {
  const cur = Math.min(Math.max(streak, 1), 7);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(5,5,9,.8)", backdropFilter: "blur(7px)", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 430, background: "linear-gradient(180deg,rgba(22,22,34,.98),rgba(12,12,20,.98))", border: "1px solid rgba(255,255,255,.12)", borderRadius: 24, padding: "26px 24px 24px", animation: "popIn .35s ease-out", boxShadow: "0 40px 90px -24px #000" }}>
        <p style={{ margin: 0, fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 23, textAlign: "center" }}>Daily cowries</p>
        <p style={{ margin: "6px 0 20px", color: "#9C9CB6", fontSize: 13.5, textAlign: "center" }}>Show up every day, grow your streak, stack rewards</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 7 }}>
          {DAILY_REWARDS.map((rw, idx) => {
            const day = idx + 1; const past = day < cur; const today = day === cur;
            return (
              <motion.div key={idx} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: idx * 0.045, ease: [0.22, 1, 0.36, 1] }}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "11px 2px 9px", borderRadius: 12, background: today ? "rgba(52,224,196,.16)" : past ? "rgba(52,224,196,.07)" : "rgba(255,255,255,.04)", border: `1px solid ${today ? "#34E0C4" : past ? "rgba(52,224,196,.24)" : "rgba(255,255,255,.07)"}` }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: today ? "#5FE7D0" : past ? "#4FB7A6" : "#74748C" }}>D{day}</span>
                <span style={{ width: 15, height: 15, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#fff,#34E0C4 62%)", margin: "5px 0 4px", display: "inline-block" }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: today ? "#ECECF2" : past ? "#8FBDB3" : "#9C9CB6" }}>{rw}</span>
              </motion.div>
            );
          })}
        </div>
        <button onClick={onClaim} style={{ width: "100%", marginTop: 18, padding: 15, border: "none", borderRadius: 14, cursor: "pointer", fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 16, color: dailyClaimed ? "#74748C" : "#06140f", background: dailyClaimed ? "rgba(255,255,255,.06)" : "linear-gradient(135deg,#34E0C4,#22C2A8)", boxShadow: dailyClaimed ? "none" : "0 12px 26px -10px rgba(52,224,196,.6)" }}>
          {dailyClaimed ? "Already claimed today" : `Claim ${DAILY_REWARDS[cur - 1]} cowries`}
        </button>
        <button onClick={onClose} style={{ width: "100%", marginTop: 9, padding: 11, border: "none", background: "transparent", color: "#74748C", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Maybe later</button>
      </div>
    </div>
  );
}

/* ── Cowries Overlay ─────────────────────────────────────────────── */
function CowriesOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(5,5,9,.8)", backdropFilter: "blur(7px)", padding: 24 }}>
      <motion.div initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        style={{ width: "100%", maxWidth: 400, background: "linear-gradient(180deg,rgba(22,22,34,.98),rgba(12,12,20,.98))", border: "1px solid rgba(255,255,255,.12)", borderRadius: 22, padding: "26px 24px", boxShadow: "0 40px 90px -24px #000" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(52,224,196,.14)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <span style={{ width: 22, height: 22, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#fff,#34E0C4 62%)", display: "inline-block" }} />
        </div>
        <p style={{ margin: 0, fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 21, textAlign: "center" }}>What are cowries?</p>
        <p style={{ margin: "8px 0 18px", color: "#9C9CB6", fontSize: 13.5, textAlign: "center", lineHeight: 1.55 }}>Your free, on-house currency — no wallet or cash needed.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { icon: "+", color: "#34E0C4", text: "Earn them by winning matches and claiming daily streak rewards." },
            { icon: "★", color: "#8B7CFF", text: "Spend them to unlock new padi opponents, board skins and climb the cowries leaderboard." },
            { icon: "i", color: "#FFB23E", text: "They're just for bragging rights — no cash value, can't be bought or withdrawn." },
          ].map(({ icon, color, text }) => (
            <div key={icon} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "rgba(255,255,255,.04)", borderRadius: 13, padding: 12 }}>
              <span style={{ color, fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{icon}</span>
              <span style={{ fontSize: 13, color: "#C5C5D8", lineHeight: 1.5 }}>{text}</span>
            </div>
          ))}
        </div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={onClose} style={{ width: "100%", marginTop: 18, padding: 14, border: "none", borderRadius: 13, background: "linear-gradient(135deg,#8B7CFF,#5C6BFF)", color: "#fff", fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Got it</motion.button>
      </motion.div>
    </div>
  );
}

/* ── Profile Overlay ─────────────────────────────────────────────── */
function ProfileOverlay({ address, isGuest, username, onSave, onDisconnect, onClose }: {
  address?: string; isGuest: boolean; username: string;
  onSave: (u: string) => void; onDisconnect: () => void; onClose: () => void;
}) {
  const [val, setVal] = useState(username);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(5,5,9,.8)", backdropFilter: "blur(7px)", padding: 24 }}>
      <motion.div initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        style={{ width: "100%", maxWidth: 400, background: "linear-gradient(180deg,rgba(22,22,34,.98),rgba(12,12,20,.98))", border: "1px solid rgba(255,255,255,.12)", borderRadius: 22, padding: "26px 24px", boxShadow: "0 40px 90px -24px #000" }}>
        <p style={{ margin: "0 0 4px", fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 21, textAlign: "center" }}>Your profile</p>
        <p style={{ margin: "0 0 18px", color: "#74748C", fontSize: 12.5, textAlign: "center" }}>{address ? `${address.slice(0, 10)}…${address.slice(-6)}` : isGuest ? "Guest player · this device" : "Not connected"}</p>
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#9C9CB6", marginBottom: 6 }}>Username</label>
        <input value={val} onChange={e => setVal(e.target.value)} placeholder="Pick a username" maxLength={16}
          style={{ width: "100%", padding: "13px 14px", borderRadius: 12, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.14)", color: "#ECECF2", fontFamily: "var(--font-manrope),'Manrope',sans-serif", fontSize: 15, fontWeight: 600, outline: "none", boxSizing: "border-box" }} />
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => onSave(val.trim().slice(0, 16))} style={{ width: "100%", marginTop: 14, padding: 14, border: "none", borderRadius: 13, background: "linear-gradient(135deg,#8B7CFF,#5C6BFF)", color: "#fff", fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Save username</motion.button>
        <button onClick={onDisconnect} style={{ width: "100%", marginTop: 10, padding: 13, border: "1px solid rgba(239,75,60,.3)", borderRadius: 13, background: "rgba(239,75,60,.08)", color: "#FF7070", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>Disconnect wallet</button>
        <button onClick={onClose} style={{ width: "100%", marginTop: 8, padding: 11, border: "none", background: "transparent", color: "#74748C", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Close</button>
      </motion.div>
    </div>
  );
}

/* ── Root Page ──────────────────────────────────────────────────── */
export default function Home() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const twAccount = useActiveAccount(); // Thirdweb active wallet (separate from wagmi state)
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const [mounted, setMounted] = useState(false);
  const [screen, setScreen] = useState<Screen>("onboarding");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [gameId, setGameId] = useState<bigint | null>(null);
  const [localAiCount, setLocalAiCount] = useState<number | null>(null);
  const [pvpMeta, setPvpMeta] = useState<PvpMeta | null>(null);
  const [cowries, setCowries] = useState(0);
  const [streak, setStreak] = useState(0);
  const [localWins, setLocalWins] = useState(0);
  const [winStreak, setWinStreak] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [lastReward, setLastReward] = useState(0);
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [won, setWon] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [username, setUsername] = useState("");
  const [autoJoinId, setAutoJoinId] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const joinParam = params.get("join");
      if (joinParam) setAutoJoinId(joinParam);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && (window.ethereum as { isMiniPay?: boolean } | undefined)?.isMiniPay) {
      // MiniPay injects window.ethereum — use the injected connector, not Thirdweb's
      const injectedConn = connectors.find(c => c.id === "injected") ?? connectors[connectors.length - 1];
      if (injectedConn) connect({ connector: injectedConn });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isConnected && chainId !== celo.id) switchChain({ chainId: celo.id });
  }, [isConnected, chainId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // ConnectEmbed updates Thirdweb state (twAccount) without touching wagmi.
    // Watch both so either connection path navigates to lobby.
    const authed = isConnected || !!twAccount;
    if (authed && screen === "onboarding") {
      setShowAuthModal(false);
      setScreen("lobby");
    }
  }, [isConnected, twAccount]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const authed = isConnected || !!twAccount;
    if (!authed && !isGuest && mounted && screen !== "onboarding") {
      setScreen("onboarding"); setGameId(null); setOverlay(null);
    }
  }, [isConnected, twAccount, isGuest, mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const addr = address ?? twAccount?.address;
    if (!addr || !mounted) return;
    const key = `padi:${addr.toLowerCase()}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const data = JSON.parse(raw);
      setCowries(data.cowries ?? 0);
      setStreak(data.streak ?? 0);
      setLocalWins(data.localWins ?? 0);
      setGamesPlayed(data.gamesPlayed ?? 0);
      setUsername(data.username ?? "");
      setDailyClaimed(data.lastClaim === new Date().toDateString());
    } catch {}
  }, [address, twAccount, mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const addr = address ?? twAccount?.address;
    if (!addr || !mounted) return;
    localStorage.setItem(`padi:${addr.toLowerCase()}`, JSON.stringify({ cowries, streak, localWins, gamesPlayed, username, lastClaim: dailyClaimed ? new Date().toDateString() : null }));
  }, [cowries, streak, localWins, gamesPlayed, username, dailyClaimed, address, twAccount, mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Guest localStorage
  useEffect(() => {
    if (!isGuest || !mounted) return;
    try {
      const data = JSON.parse(localStorage.getItem("padi:guest") ?? "{}");
      setCowries(data.cowries ?? 1240); setStreak(data.streak ?? 0); setLocalWins(data.localWins ?? 0); setGamesPlayed(data.gamesPlayed ?? 0);
    } catch {}
  }, [isGuest, mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  function showToast(text: string, color: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, color });
    toastTimer.current = setTimeout(() => setToast(null), 1900);
  }

  function handleConnect() { setShowAuthModal(true); }
  function handleGuest() { setShowAuthModal(false); setIsGuest(true); setScreen("lobby"); showToast("Playing as guest — progress saves on this device", "#34E0C4"); }
  function handleEnterGame(id: bigint) { setLocalAiCount(null); setGameId(id); setScreen("game"); }
  function handleEnterLocalGame(aiCount: number) { setLocalAiCount(aiCount); setGameId(0n); setScreen("game"); }
  function handleEnterPvp(gid: bigint, mySeat: 0 | 1, wager: bigint, opponent: string) { setPvpMeta({ gameId: gid, mySeat, wager, opponentAddress: opponent }); setScreen("pvp"); }
  function handleBack() { setScreen("lobby"); setGameId(null); setLocalAiCount(null); setPvpMeta(null); }

  function handleGameEnd(didWin: boolean) {
    const reward = didWin ? 250 : 25;
    setWon(didWin);
    setLastReward(reward);
    setCowries(c => c + reward);
    setGamesPlayed(g => g + 1);
    if (didWin) { setStreak(s => s + 1); setLocalWins(w => w + 1); setWinStreak(s => s + 1); }
    else setWinStreak(0);
    setOverlay(didWin ? "win" : "lose");
  }

  function handleClaimDaily() {
    if (dailyClaimed) { setOverlay(null); return; }
    const cur = Math.min(Math.max(streak, 1), 7);
    const reward = DAILY_REWARDS[cur - 1];
    setCowries(c => c + reward);
    setStreak(s => s + 1);
    setDailyClaimed(true);
    setOverlay(null);
    showToast(`+${reward} cowries claimed!`, "#FFB23E");
  }

  const effectiveAddress = address ?? twAccount?.address;
  const displayName = username || (effectiveAddress ? `${effectiveAddress.slice(0, 6)}…${effectiveAddress.slice(-4)}` : isGuest ? "Guest player" : "—");
  const isApp = ["lobby", "game", "pvp", "ranks", "matchmaking"].includes(screen);

  if (!mounted) return null;

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      <BgLayer />
      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} onGuest={handleGuest} />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div key="toast" initial={{ opacity: 0, y: -18, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: -10, x: "-50%" }}
            style={{ position: "fixed", top: 14, left: "50%", zIndex: 60, display: "flex", alignItems: "center", gap: 9, background: "rgba(14,14,22,.96)", backdropFilter: "blur(10px)", border: `1px solid ${toast.color}`, borderRadius: 13, padding: "10px 16px", boxShadow: "0 18px 40px -14px #000" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: toast.color, boxShadow: `0 0 9px ${toast.color}`, display: "inline-block" }} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Landing */}
      <AnimatePresence>
        {screen === "onboarding" && (
          <motion.div key="landing" style={{ position: "absolute", inset: 0, zIndex: 1, overflow: "hidden" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <LandingPage onConnect={handleConnect} onGuest={handleGuest} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* App shell */}
      {isApp && (
        <div className="app-shell" style={{ position: "absolute", inset: 0, zIndex: 1 }}>
          <AppBar
            address={effectiveAddress}
            cowries={cowries}
            dailyClaimed={dailyClaimed}
            screen={screen}
            onLogoClick={() => setScreen("lobby")}
            onLeaderboard={() => setScreen(screen === "ranks" ? "lobby" : "ranks")}
            onCowriesClick={() => setOverlay("daily")}
            onProfile={() => setOverlay("profile")}
          />

          {/* Content area — fills remaining height, scrolls internally but hides bar */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0 }} className="no-scrollbar">
            <div style={{
              maxWidth: screen === "ranks" ? 680 : 860,
              margin: "0 auto",
              padding: screen === "game" || screen === "pvp"
                ? "10px 12px 10px"
                : "12px clamp(12px,3vw,28px) 20px",
              height: screen === "game" || screen === "pvp" ? "100%" : undefined,
            }}>
              <AnimatePresence mode="wait">
                {screen === "lobby" && (
                  <motion.div key="lobby" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                    <Lobby
                      cowries={cowries} streak={streak} localWins={localWins}
                      winStreak={winStreak} gamesPlayed={gamesPlayed}
                      dailyClaimed={dailyClaimed}
                      initialJoinId={autoJoinId ?? undefined}
                      onEnterGame={handleEnterGame}
                      onEnterLocalGame={handleEnterLocalGame}
                      onEnterPvp={handleEnterPvp}
                      onOpenDaily={() => setOverlay("daily")}
                      onViewRanks={() => setScreen("ranks")}
                      showToast={showToast}
                    />
                  </motion.div>
                )}
                {screen === "game" && gameId !== null && (
                  <motion.div key="game" style={{ height: "100%" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                    <GameBoard gameId={gameId} localAiCount={localAiCount ?? undefined} onBack={handleBack} onGameEnd={handleGameEnd} showToast={showToast} />
                  </motion.div>
                )}
                {screen === "pvp" && pvpMeta !== null && (
                  <motion.div key="pvp" style={{ height: "100%" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                    <PvPGameBoard meta={pvpMeta} onBack={handleBack} onGameEnd={handleGameEnd} showToast={showToast} />
                  </motion.div>
                )}
                {screen === "ranks" && (
                  <motion.div key="ranks" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
                    <Leaderboard onBack={() => setScreen("lobby")} localWins={localWins} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}

      {/* Overlays */}
      <AnimatePresence>
        {(overlay === "win" || overlay === "lose") && (
          <WinOverlay won={won} lastReward={lastReward}
            onPlayAgain={() => { setOverlay(null); setScreen("lobby"); setGameId(null); setPvpMeta(null); }}
            onClose={() => { setOverlay(null); setScreen("lobby"); setGameId(null); setPvpMeta(null); }} />
        )}
        {overlay === "daily" && (
          <DailyOverlay streak={streak} dailyClaimed={dailyClaimed} onClaim={handleClaimDaily} onClose={() => setOverlay(null)} />
        )}
        {overlay === "cowries" && <CowriesOverlay onClose={() => setOverlay(null)} />}
        {overlay === "profile" && (
          <ProfileOverlay address={effectiveAddress} isGuest={isGuest} username={username}
            onSave={u => { if (u) { setUsername(u); showToast("Username saved", "#34E0C4"); } setOverlay(null); }}
            onDisconnect={() => { disconnect(); setOverlay(null); setScreen("onboarding"); }}
            onClose={() => setOverlay(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
