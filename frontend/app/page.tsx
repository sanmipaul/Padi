"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import Lobby from "@/components/Lobby";
import GameBoard from "@/components/GameBoard";
import Leaderboard from "@/components/Leaderboard";

type Screen = "onboarding" | "lobby" | "game" | "ranks";
type Overlay = null | "win" | "lose" | "daily";

interface ToastState { text: string; color: string; }

const DAILY_REWARDS = [20, 40, 60, 80, 120, 160, 300];

const COLORS = ["#EF4B3C", "#1FA85C", "#3D6BFF", "#F2A916"];

function alpha(hex: string, a: number) {
  return hex + Math.round(a * 255).toString(16).padStart(2, "0");
}

/* ─── Onboarding ─────────────────────────────────────────────────── */
function OnboardingScreen({ onConnect, isConnecting, isMiniPay }: { onConnect: () => void; isConnecting: boolean; isMiniPay: boolean }) {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", paddingBottom: "28px" }}>
      {/* Rainbow stripe header */}
      <div style={{ height: "70px", background: "repeating-linear-gradient(135deg,#EF4B3C 0 16px,#F2A916 16px 32px,#1FA85C 32px 48px,#3D6BFF 48px 64px)", opacity: 0.9 }} />
      <div style={{ position: "absolute", top: "70px", left: 0, right: 0, height: "30px", background: "linear-gradient(180deg,rgba(29,18,8,0),#1d1208)" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 18% 30%,rgba(242,169,22,.13),transparent 26%),radial-gradient(circle at 88% 64%,rgba(61,107,255,.12),transparent 30%)", pointerEvents: "none" }} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "26px", padding: "6px 26px 0", position: "relative" }}>
        {/* Logo */}
        <div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "7px" }}>
            <span style={{ fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: "68px", lineHeight: 0.86, letterSpacing: "-3px", color: "#FBEFE0" }}>padi</span>
            <span style={{ width: "15px", height: "15px", borderRadius: "50%", background: "#EF4B3C", marginBottom: "15px", boxShadow: "0 0 18px #EF4B3C", animation: "floaty 3s ease-in-out infinite", display: "inline-block" }} />
          </div>
          <p style={{ color: "#C9B49C", fontSize: "16px", margin: "16px 0 0", lineHeight: 1.55, maxWidth: "310px" }}>
            Play Ludo with your AI <span style={{ color: "#F2A916", fontWeight: 700 }}>padi</span>. Roll the dice, chase them down, and send them packing — all on-chain.
          </p>
        </div>

        {/* Feature cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "11px" }}>
          {[
            { icon: "3", iconBg: "rgba(239,75,60,.16)", iconColor: "#EF4B3C", title: "Outsmart up to 3 AI padis", sub: "Chidi, Amaka & Tunde each play their own way", isBricolage: true },
            { icon: "★", iconBg: "rgba(242,169,22,.16)", iconColor: "#F2A916", title: "Win the weekly pot", sub: "Climb the board, share the USDM prize pool", isBricolage: false },
            { icon: "◎", iconBg: "rgba(31,168,92,.16)", iconColor: "#1FA85C", title: "Daily cowries & streaks", sub: "Come back each day, stack your rewards", isBricolage: false },
          ].map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "14px", background: "rgba(255,238,214,.045)", border: "1px solid rgba(247,179,43,.14)", borderRadius: "16px", padding: "13px 15px" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: f.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: f.iconColor, fontFamily: f.isBricolage ? "var(--font-bricolage), 'Bricolage Grotesque', sans-serif" : undefined, fontWeight: f.isBricolage ? 800 : 400, fontSize: "22px" }}>{f.icon}</span>
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "15px" }}>{f.title}</p>
                <p style={{ margin: "2px 0 0", color: "#A8927C", fontSize: "13px" }}>{f.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA — hidden inside MiniPay (wallet is implicit) */}
      <div style={{ padding: "0 26px" }}>
        {isMiniPay ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "9px", padding: "16px", background: "rgba(31,168,92,.12)", border: "1px solid rgba(31,168,92,.3)", borderRadius: "18px" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#1FA85C", boxShadow: "0 0 9px #1FA85C", display: "inline-block", animation: "floaty 2s ease-in-out infinite" }} />
            <span style={{ color: "#8FB99B", fontWeight: 700, fontSize: "15px" }}>Connecting MiniPay…</span>
          </div>
        ) : (
          <button
            onClick={onConnect}
            disabled={isConnecting}
            style={{ width: "100%", padding: "18px", border: "none", borderRadius: "18px", background: isConnecting ? "rgba(239,75,60,.5)" : "linear-gradient(135deg,#F2622E,#EF4B3C)", color: "#fff", fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: "18px", letterSpacing: ".3px", cursor: isConnecting ? "default" : "pointer", animation: isConnecting ? "none" : "glowPulse 2.8s ease-in-out infinite", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
            {isConnecting && <span style={{ width: "18px", height: "18px", borderRadius: "50%", border: "2.5px solid rgba(255,255,255,.4)", borderTopColor: "#fff", animation: "spin .7s linear infinite", display: "inline-block", flexShrink: 0 }} />}
            {isConnecting ? "Connecting…" : "Connect Wallet"}
          </button>
        )}
        <p style={{ textAlign: "center", color: "#7d6a58", fontSize: "12px", margin: "14px 0 0" }}>On-chain on Celo · Free to play · Optional USDM stakes</p>
      </div>
    </div>
  );
}

/* ─── App Bar ─────────────────────────────────────────────────────── */
function AppBar({ address, cowries, streak }: { address?: string; cowries: number; streak: number }) {
  const { disconnect } = useDisconnect();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 10px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "4px" }}>
        <span style={{ fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: "26px", letterSpacing: "-1px", color: "#FBEFE0" }}>padi</span>
        <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#EF4B3C", marginBottom: "6px", boxShadow: "0 0 8px #EF4B3C", display: "inline-block" }} />
      </div>
      <div style={{ display: "flex", gap: "9px" }}>
        {/* Streak */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(242,169,22,.13)", border: "1px solid rgba(242,169,22,.3)", borderRadius: "999px", padding: "6px 12px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#F2A916", boxShadow: "0 0 8px #F2A916", display: "inline-block" }} />
          <span style={{ color: "#F2A916", fontWeight: 800, fontSize: "13px" }}>{streak}</span>
          <span style={{ color: "#C99A2E", fontWeight: 600, fontSize: "11px" }}>day</span>
        </div>
        {/* Cowries + address */}
        <button
          onClick={() => disconnect()}
          title="Disconnect wallet"
          style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(255,238,214,.05)", border: "1px solid rgba(247,179,43,.18)", borderRadius: "999px", padding: "6px 12px", cursor: "pointer" }}>
          <span style={{ width: "14px", height: "14px", borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#FCE2A0,#E8A21C)", display: "inline-block", flexShrink: 0 }} />
          <span style={{ color: "#F4D8A8", fontWeight: 800, fontSize: "13px" }}>{cowries.toLocaleString()}</span>
          {address && (
            <span style={{ color: "#A8927C", fontWeight: 600, fontSize: "11px" }}>{address.slice(0, 4)}…{address.slice(-3)}</span>
          )}
        </button>
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
    <div style={{ display: "flex", flexShrink: 0, background: "rgba(18,11,5,.94)", backdropFilter: "blur(12px)", borderTop: "1px solid rgba(247,179,43,.13)", padding: "10px 30px 16px", zIndex: 30 }}>
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
      <div style={{ width: "100%", background: "linear-gradient(180deg,#241509,#180e06)", borderTop: "1px solid rgba(247,179,43,.2)", borderRadius: "26px 26px 0 0", padding: "24px 22px 30px", animation: "popIn .35s ease-out" }}>
        <div style={{ width: "40px", height: "4px", borderRadius: "4px", background: "rgba(247,179,43,.25)", margin: "0 auto 18px" }} />
        <p style={{ margin: 0, fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: "22px", color: "#FBEFE0", textAlign: "center" }}>Daily cowries</p>
        <p style={{ margin: "5px 0 18px", color: "#A8927C", fontSize: "13px", textAlign: "center" }}>Show up every day, grow your streak, stack rewards</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "6px" }}>
          {DAILY_REWARDS.map((rw, idx) => {
            const day = idx + 1;
            const past = day < cur;
            const today = day === cur;
            return (
              <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 2px 8px", borderRadius: "12px", background: today ? "rgba(242,169,22,.18)" : past ? "rgba(31,168,92,.1)" : "rgba(255,238,214,.04)", border: `1px solid ${today ? "#F2A916" : past ? "rgba(31,168,92,.3)" : "rgba(255,238,214,.07)"}` }}>
                <span style={{ fontSize: "9px", fontWeight: 800, color: today ? "#F4C95A" : past ? "#6FA582" : "#8c7866" }}>D{day}</span>
                <span style={{ width: "15px", height: "15px", borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#FCE2A0,#E8A21C)", margin: "4px 0 3px", opacity: 0.95, display: "inline-block" }} />
                <span style={{ fontSize: "11px", fontWeight: 800, color: today ? "#FBEFE0" : past ? "#9FC2AC" : "#A8927C" }}>{rw}</span>
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

  const [screen, setScreen] = useState<Screen>("onboarding");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [gameId, setGameId] = useState<bigint | null>(null);
  const [cowries, setCowries] = useState(1240);
  const [streak, setStreak] = useState(3);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [lastReward, setLastReward] = useState(0);
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [won, setWon] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isMiniPay, setIsMiniPay] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (didWin) setStreak((s) => s + 1);
    setGamesPlayed((g) => g + 1);
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

  return (
    <div style={{ width: "100%", maxWidth: "462px", margin: "0 auto", minHeight: "100dvh", position: "relative", display: "flex", flexDirection: "column", background: "linear-gradient(180deg,#1d1208 0%,#150d06 58%,#100a05 100%)", boxShadow: "0 0 90px rgba(0,0,0,.65)", overflow: "hidden" }}>

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
          <OnboardingScreen onConnect={handleConnect} isConnecting={isConnecting} isMiniPay={isMiniPay} />
        )}

        {isApp && (
          <>
            <AppBar address={address} cowries={cowries} streak={streak} />
            <div style={{ padding: "4px 20px 80px" }}>
              {screen === "lobby" && (
                <Lobby
                  cowries={cowries}
                  streak={streak}
                  dailyClaimed={dailyClaimed}
                  gamesPlayed={gamesPlayed}
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
                <Leaderboard onBack={() => setScreen("lobby")} />
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
