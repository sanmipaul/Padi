"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { PADI_ADDRESS, PADI_ABI, ERC20_ABI, USDM_ADDRESS } from "@/lib/contracts";

const fadeUp  = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };
const scaleIn = { initial: { opacity: 0, scale: 0.88 }, animate: { opacity: 1, scale: 1 } };

const COLORS = ["#EF4B3C", "#1FA85C", "#3D6BFF", "#F2A916"];
const NAMES = ["You", "Chidi", "Amaka", "Tunde"];
const WAGER_PRESETS = ["0.10", "0.25", "1.00"];

interface LobbyProps {
  cowries: number;
  streak: number;
  localWins: number;
  dailyClaimed: boolean;
  onEnterGame: (id: bigint) => void;
  onOpenDaily: () => void;
  onViewRanks: () => void;
  showToast: (text: string, color: string) => void;
}

export default function Lobby({ cowries, streak, localWins, dailyClaimed, onEnterGame, onOpenDaily, onViewRanks, showToast }: LobbyProps) {
  const { address } = useAccount();
  const contract = PADI_ADDRESS;

  const [aiCount, setAiCount] = useState(1);
  const [wagerOn, setWagerOn] = useState(false);
  const [wager, setWager] = useState("0.25");
  const [pendingWager, setPendingWager] = useState(0n);

  const { data: prizePool } = useReadContract({ address: contract, abi: PADI_ABI, functionName: "weeklyPrizePool" });
  const { data: totalGamesCount } = useReadContract({ address: contract, abi: PADI_ABI, functionName: "totalGames" });
  const { data: myGames } = useReadContract({ address: contract, abi: PADI_ABI, functionName: "getPlayerGames", args: address ? [address] : undefined });
  const { data: wins } = useReadContract({ address: contract, abi: PADI_ABI, functionName: "totalWins", args: address ? [address] : undefined });

  // isPending = true while wallet popup is open (before tx hash is returned)
  const { writeContract: approve, data: approveTx, isPending: approveSubmitting, error: approveError } = useWriteContract();
  const { writeContract: create,  data: createTx,  isPending: createSubmitting,  error: createError  } = useWriteContract();

  // isLoading = true while waiting for the tx to be mined
  const { isSuccess: approveOk, isLoading: approveWaiting } = useWaitForTransactionReceipt({ hash: approveTx });
  const { isSuccess: createOk,  isLoading: createWaiting, data: createReceipt } = useWaitForTransactionReceipt({ hash: createTx });

  const busy = approveSubmitting || approveWaiting || createSubmitting || createWaiting;

  const prizeDisplay  = prizePool        ? (Number(prizePool) / 1e18).toFixed(2) : "0.00";
  const winsDisplay   = wins             ? Number(wins)             : 0;
  const gamesDisplay  = myGames          ? myGames.length           : 0;


  // Show error toasts so the user always knows what went wrong
  useEffect(() => {
    if (approveError) showToast("Approval failed — try again.", "#EF4B3C");
  }, [approveError]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (createError) showToast("Transaction failed — try again.", "#EF4B3C");
  }, [createError]); // eslint-disable-line react-hooks/exhaustive-deps

  // After USDM approval, send the createGame tx
  useEffect(() => {
    if (approveOk && pendingWager > 0n && !createTx) {
      showToast("Creating game…", "#1FA85C");
      create({ address: contract, abi: PADI_ABI, functionName: "createGame", args: [aiCount, pendingWager] });
    }
  }, [approveOk]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate into the game once the receipt is confirmed
  useEffect(() => {
    if (createOk && createReceipt) {
      // keccak256("GameCreated(uint256,address,uint8)") — must match exactly to avoid
      // picking up the USDM Transfer log that comes first in staked games
      const GAME_CREATED_TOPIC = "0xdd0abcdffc76581d11646898ee4d7f269ca1e0c0b622d072d343100dad83ecb1";
      const log = createReceipt.logs.find(
        (l) => l.topics[0]?.toLowerCase() === GAME_CREATED_TOPIC
      );
      if (log?.topics[1]) {
        onEnterGame(BigInt(log.topics[1]));
      } else {
        showToast("Game created! Pick it from your list below.", "#F2A916");
      }
    }
  }, [createOk, createReceipt]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleCreate() {
    if (busy) return;
    if (wagerOn) {
      const wagerBN = parseUnits(wager, 18);
      setPendingWager(wagerBN);
      showToast("Approving USDM…", "#F2A916");
      approve({ address: USDM_ADDRESS as `0x${string}`, abi: ERC20_ABI, functionName: "approve", args: [contract, wagerBN] });
    } else {
      showToast("Confirm in your wallet…", "#1FA85C");
      create({ address: contract, abi: PADI_ABI, functionName: "createGame", args: [aiCount, 0n] });
    }
  }

  const btnLabel = (() => {
    if (approveSubmitting) return "Check your wallet…";
    if (approveWaiting)    return "Approving USDM…";
    if (createSubmitting)  return "Check your wallet…";
    if (createWaiting)     return "Creating game…";
    return `Start game · ${wagerOn ? `stake ${wager} USDM` : "free"}`;
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "13px" }}>

      {/* Prize Pool Banner */}
      <div style={{ borderRadius: "22px", padding: "20px", position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#3a2012,#221107)", border: "1px solid rgba(242,169,22,.24)" }}>
        <div style={{ position: "absolute", right: "-30px", top: "-30px", width: "150px", height: "150px", background: "repeating-conic-gradient(from 0deg,#F2A916 0 11deg,transparent 11deg 22deg)", opacity: 0.1, borderRadius: "50%" }} />
        <p style={{ margin: 0, color: "#C99A2E", fontSize: "11px", fontWeight: 800, letterSpacing: "1.5px" }}>WEEKLY PRIZE POOL</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px", margin: "6px 0 0", position: "relative" }}>
          <span className="prize-amount" style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "clamp(32px,10vw,42px)", color: "#F4C95A", textShadow: "0 0 24px rgba(242,169,22,.35)", lineHeight: 1 }}>{prizeDisplay}</span>
          <span style={{ color: "#C99A2E", fontWeight: 700, fontSize: "15px" }}>USDM</span>
        </div>
        <button onClick={onViewRanks} style={{ marginTop: "14px", background: "rgba(242,169,22,.16)", border: "1px solid rgba(242,169,22,.34)", color: "#F4C95A", fontWeight: 700, fontSize: "13px", borderRadius: "999px", padding: "9px 16px", cursor: "pointer" }}>
          View leaderboard →
        </button>
      </div>

      {/* Daily Cowries Button */}
      <button onClick={onOpenDaily} style={{ display: "flex", alignItems: "center", gap: "13px", textAlign: "left", cursor: "pointer", background: dailyClaimed ? "rgba(255,238,214,.03)" : "rgba(31,168,92,.11)", border: `1px solid ${dailyClaimed ? "rgba(255,238,214,.08)" : "rgba(31,168,92,.3)"}`, borderRadius: "18px", padding: "13px 15px" }}>
        <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: dailyClaimed ? "rgba(255,238,214,.06)" : "rgba(31,168,92,.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ width: "18px", height: "18px", borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#FCE2A0,#E8A21C)", display: "inline-block" }} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: "15px", color: "#FBEFE0" }}>{dailyClaimed ? "Come back tomorrow" : "Daily cowries ready"}</p>
          <p style={{ margin: "2px 0 0", color: "#8FB99B", fontSize: "12px" }}>Day {streak} streak · tap to {dailyClaimed ? "view" : "claim"}</p>
        </div>
        <span style={{ background: dailyClaimed ? "rgba(255,255,255,.08)" : "#1FA85C", color: dailyClaimed ? "#9C9CB6" : "#06140b", fontWeight: 800, fontSize: "12px", borderRadius: "999px", padding: "7px 13px", flexShrink: 0 }}>
          {dailyClaimed ? "Done" : "Claim"}
        </span>
      </button>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
        {[
          { value: localWins,    label: "Wins",   color: "#EF4B3C" },
          { value: streak,       label: "Streak", color: "#F2A916" },
          { value: gamesDisplay, label: "Games",  color: "#FBEFE0" },
        ].map(({ value, label, color }) => (
          <div key={label} style={{ background: "rgba(255,238,214,.04)", border: "1px solid rgba(247,179,43,.1)", borderRadius: "16px", padding: "13px 8px", textAlign: "center" }}>
            <p style={{ margin: 0, fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "24px", color }}>{value}</p>
            <p style={{ margin: "1px 0 0", color: "#8c7866", fontSize: "11px", fontWeight: 600 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* New Game Card */}
      <div style={{ background: "rgba(255,238,214,.035)", border: "1px solid rgba(247,179,43,.12)", borderRadius: "22px", padding: "18px" }}>
        <p style={{ margin: "0 0 3px", fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "19px", color: "#FBEFE0" }}>New game</p>
        <p style={{ margin: "0 0 14px", color: "#A8927C", fontSize: "13px" }}>How many padis are you taking on?</p>

        {/* AI count selector */}
        <div style={{ display: "flex", gap: "10px" }}>
          {[1, 2, 3].map((n) => {
            const active = aiCount === n;
            const subs: Record<number, string> = { 1: "Solo padi", 2: "Two padis", 3: "Full house" };
            return (
              <button key={n} onClick={() => setAiCount(n)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", padding: "12px 4px", borderRadius: "14px", cursor: "pointer", background: active ? "rgba(239,75,60,.14)" : "rgba(255,238,214,.04)", border: `1px solid ${active ? "#EF4B3C" : "rgba(255,238,214,.09)"}` }}>
                <span style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "22px", color: active ? "#EF4B3C" : "#C9B49C" }}>{n}</span>
                <span style={{ fontSize: "10px", fontWeight: 600, color: active ? "#EF8C7E" : "#8c7866" }}>{subs[n]}</span>
              </button>
            );
          })}
        </div>

        {/* Selected padi chips */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "13px" }}>
          {Array.from({ length: aiCount }, (_, i) => i + 1).map((s) => (
            <div key={s} style={{ display: "inline-flex", alignItems: "center", gap: "7px", background: "rgba(255,238,214,.05)", border: "1px solid rgba(247,179,43,.12)", borderRadius: "999px", padding: "5px 13px 5px 5px", fontSize: "12px", fontWeight: 700, color: "#D8C4AC" }}>
              <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: COLORS[s], display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "10px", fontWeight: 800 }}>{NAMES[s][0]}</span>
              {NAMES[s]}
            </div>
          ))}
        </div>

        {/* Stake toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "18px", paddingTop: "16px", borderTop: "1px solid rgba(247,179,43,.1)" }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "#FBEFE0" }}>Stake USDM</p>
            <p style={{ margin: "1px 0 0", color: "#8c7866", fontSize: "12px" }}>Win 99% back if you sweep</p>
          </div>
          <button onClick={() => setWagerOn((v) => !v)} style={{ width: "48px", height: "28px", borderRadius: "999px", border: "none", cursor: "pointer", padding: "3px", display: "flex", justifyContent: wagerOn ? "flex-end" : "flex-start", background: wagerOn ? "#1FA85C" : "rgba(255,238,214,.12)", transition: "all .2s" }}>
            <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#fff", display: "block", boxShadow: "0 2px 4px rgba(0,0,0,.3)" }} />
          </button>
        </div>

        {/* Wager presets */}
        {wagerOn && (
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            {WAGER_PRESETS.map((v) => {
              const active = wager === v;
              return (
                <button key={v} onClick={() => setWager(v)} style={{ flex: 1, padding: "10px 4px", borderRadius: "12px", cursor: "pointer", fontSize: "13px", fontWeight: 700, background: active ? "rgba(242,169,22,.16)" : "rgba(255,238,214,.04)", border: `1px solid ${active ? "#F2A916" : "rgba(255,238,214,.09)"}`, color: active ? "#F4C95A" : "#A8927C" }}>
                  {v} USDM
                </button>
              );
            })}
          </div>
        )}

        {/* Start button */}
        <button
          onClick={handleCreate}
          disabled={busy}
          style={{ width: "100%", marginTop: "16px", padding: "16px", border: "none", borderRadius: "16px", background: busy ? "rgba(239,75,60,.45)" : "linear-gradient(135deg,#F2622E,#EF4B3C)", color: "#fff", fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "17px", cursor: busy ? "default" : "pointer", boxShadow: busy ? "none" : "0 12px 26px -10px rgba(239,75,60,.7)", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}
        >
          {busy && (
            <span style={{ width: "16px", height: "16px", borderRadius: "50%", border: "2.5px solid rgba(255,255,255,.4)", borderTopColor: "#fff", animation: "spin .7s linear infinite", display: "inline-block", flexShrink: 0 }} />
          )}
          {btnLabel}
        </button>
      </div>

      {/* Recent Games */}
      {myGames && myGames.length > 0 && (
        <div style={{ background: "rgba(255,238,214,.035)", border: "1px solid rgba(247,179,43,.1)", borderRadius: "18px", padding: "16px" }}>
          <p style={{ margin: "0 0 10px", color: "#A8927C", fontSize: "12px", fontWeight: 700, letterSpacing: "0.5px" }}>RECENT GAMES</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {[...myGames].reverse().slice(0, 8).map((id) => {
              const saveKey = `padi:gs:${id.toString()}`;
              const hasSave = typeof window !== "undefined" && !!localStorage.getItem(saveKey);
              return (
                <button key={id.toString()} onClick={() => onEnterGame(id)}
                  style={{ padding: "9px 16px", background: hasSave ? "rgba(31,168,92,.12)" : "rgba(255,238,214,.06)", border: `1px solid ${hasSave ? "rgba(31,168,92,.35)" : "rgba(247,179,43,.14)"}`, borderRadius: "999px", color: hasSave ? "#8FB99B" : "#D8C4AC", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                  {hasSave ? "▶ " : ""}Game #{id.toString()}
                </button>
              );
            })}
          </div>
          <p style={{ margin: "10px 0 0", color: "#5a4a3a", fontSize: "11px" }}>▶ = in progress · tap any to view or resume</p>
        </div>
      )}
    </div>
  );
}
