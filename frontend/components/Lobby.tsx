"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { PADI_ADDRESS, PADI_ABI, ERC20_ABI, USDM_ADDRESS, PVP_STATE } from "@/lib/contracts";

const fadeUp  = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };
const scaleIn = { initial: { opacity: 0, scale: 0.88 }, animate: { opacity: 1, scale: 1 } };

const COLORS = ["#EF4B3C", "#1FA85C", "#3D6BFF", "#F2A916"];
const NAMES  = ["You", "Chidi", "Amaka", "Tunde"];
const WAGER_PRESETS = ["0.10", "0.25", "1.00"];

export interface PvpJoinInfo { gameId: bigint; wager: bigint; player1: string }

interface LobbyProps {
  cowries: number;
  streak: number;
  localWins: number;
  winStreak: number;
  dailyClaimed: boolean;
  initialJoinId?: string;    // pre-filled from ?join= URL param
  onEnterGame: (id: bigint) => void;
  onEnterPvp: (gameId: bigint, mySeat: 0 | 1, wager: bigint, opponent: string) => void;
  onOpenDaily: () => void;
  onViewRanks: () => void;
  showToast: (text: string, color: string) => void;
}

export default function Lobby({
  cowries, streak, localWins, winStreak, dailyClaimed, initialJoinId,
  onEnterGame, onEnterPvp, onOpenDaily, onViewRanks, showToast,
}: LobbyProps) {
  const { address } = useAccount();
  const contract = PADI_ADDRESS;

  // ── mode tabs ─────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<"ai" | "pvp">(initialJoinId ? "pvp" : "ai");

  // ── AI game state ─────────────────────────────────────────────────────────
  const [aiCount, setAiCount] = useState(1);
  const [wagerOn, setWagerOn] = useState(false);
  const [wager, setWager]     = useState("0.25");
  const [pendingWager, setPendingWager] = useState(0n);

  // ── PvP state ─────────────────────────────────────────────────────────────
  const [pvpWagerOn, setPvpWagerOn] = useState(false);
  const [pvpWager, setPvpWager]     = useState("0.25");
  const [pvpGameId, setPvpGameId]   = useState<bigint | null>(null);
  const [joinId, setJoinId]         = useState(initialJoinId ?? "");
  const [copied, setCopied]         = useState(false);

  // ── Reads ─────────────────────────────────────────────────────────────────
  const { data: prizePool } = useReadContract({ address: contract, abi: PADI_ABI, functionName: "weeklyPrizePool" });
  const { data: myGames }   = useReadContract({ address: contract, abi: PADI_ABI, functionName: "getPlayerGames", args: address ? [address] : undefined });
  const { data: wins }      = useReadContract({ address: contract, abi: PADI_ABI, functionName: "totalWins", args: address ? [address] : undefined });

  // Poll the PvP game until opponent joins
  const { data: pvpData, refetch: refetchPvp } = useReadContract({
    address: contract, abi: PADI_ABI, functionName: "getPvpGame",
    args: pvpGameId != null ? [pvpGameId] : undefined,
    query: { enabled: pvpGameId != null, refetchInterval: 4_000 },
  });

  // ── AI write hooks ────────────────────────────────────────────────────────
  const { writeContract: approve, data: approveTx, isPending: approveSubmitting, error: approveError } = useWriteContract();
  const { writeContract: create,  data: createTx,  isPending: createSubmitting,  error: createError  } = useWriteContract();
  const { isSuccess: approveOk, isLoading: approveWaiting } = useWaitForTransactionReceipt({ hash: approveTx });
  const { isSuccess: createOk,  isLoading: createWaiting, data: createReceipt   } = useWaitForTransactionReceipt({ hash: createTx });

  // ── PvP write hooks ───────────────────────────────────────────────────────
  const { writeContract: createPvp,  data: pvpCreateTx, isPending: pvpCreateSubmitting, error: pvpCreateError } = useWriteContract();
  const { writeContract: approvePvp, data: pvpApproveTx, isPending: pvpApproveSubmitting, error: pvpApproveError } = useWriteContract();
  const { writeContract: joinPvp,    data: pvpJoinTx,   isPending: pvpJoinSubmitting,   error: pvpJoinError   } = useWriteContract();
  const { isSuccess: pvpApproveOk, isLoading: pvpApproveWaiting } = useWaitForTransactionReceipt({ hash: pvpApproveTx });
  const { isSuccess: pvpCreateOk, isLoading: pvpCreateWaiting, data: pvpCreateReceipt } = useWaitForTransactionReceipt({ hash: pvpCreateTx });
  const { isSuccess: pvpJoinOk, isLoading: pvpJoinWaiting, data: pvpJoinReceipt } = useWaitForTransactionReceipt({ hash: pvpJoinTx });

  const busy    = approveSubmitting || approveWaiting || createSubmitting || createWaiting;
  const pvpBusy = pvpApproveSubmitting || pvpApproveWaiting || pvpCreateSubmitting || pvpCreateWaiting || pvpJoinSubmitting || pvpJoinWaiting;

  const prizeDisplay = prizePool ? (Number(prizePool) / 1e18).toFixed(2) : "0.00";
  const gamesDisplay = myGames ? myGames.length : 0;

  // ── AI effects ────────────────────────────────────────────────────────────
  useEffect(() => { if (approveError) showToast("Approval failed.", "#EF4B3C"); }, [approveError]); // eslint-disable-line
  useEffect(() => { if (createError)  showToast("Transaction failed.", "#EF4B3C"); }, [createError]); // eslint-disable-line

  useEffect(() => {
    if (approveOk && pendingWager > 0n && !createTx) {
      showToast("Creating game…", "#1FA85C");
      create({ address: contract, abi: PADI_ABI, functionName: "createGame", args: [aiCount, pendingWager] });
    }
  }, [approveOk]); // eslint-disable-line

  useEffect(() => {
    if (createOk && createReceipt) {
      const TOPIC = "0xdd0abcdffc76581d11646898ee4d7f269ca1e0c0b622d072d343100dad83ecb1";
      const log = createReceipt.logs.find(l => l.topics[0]?.toLowerCase() === TOPIC);
      if (log?.topics[1]) onEnterGame(BigInt(log.topics[1]));
      else showToast("Game created! Pick it below.", "#F2A916");
    }
  }, [createOk, createReceipt]); // eslint-disable-line

  // ── PvP effects ───────────────────────────────────────────────────────────
  useEffect(() => { if (pvpCreateError || pvpApproveError || pvpJoinError) showToast("Transaction failed.", "#EF4B3C"); }, [pvpCreateError, pvpApproveError, pvpJoinError]); // eslint-disable-line

  // After approval, create the PvP game
  useEffect(() => {
    if (pvpApproveOk) {
      const wagerBN = parseUnits(pvpWager, 18);
      showToast("Creating challenge…", "#1FA85C");
      createPvp({ address: contract, abi: PADI_ABI, functionName: "createPvpGame", args: [wagerBN] });
    }
  }, [pvpApproveOk]); // eslint-disable-line

  // Extract PvP game ID from receipt
  useEffect(() => {
    if (pvpCreateOk && pvpCreateReceipt) {
      // keccak256("PvpGameCreated(uint256,address,uint256)")
      const TOPIC = "0x" + [...Array(64)].map(() => "0").join(""); // placeholder — we'll use log index
      // Find PvpGameCreated log: it's emitted by the PADI contract
      const log = pvpCreateReceipt.logs.find(l =>
        l.address.toLowerCase() === contract.toLowerCase() && l.topics.length >= 2
      );
      if (log?.topics[1]) {
        const gid = BigInt(log.topics[1]);
        setPvpGameId(gid);
        showToast("Challenge created! Share the link.", "#F2A916");
      }
    }
  }, [pvpCreateOk, pvpCreateReceipt]); // eslint-disable-line

  // PvP join success
  useEffect(() => {
    if (pvpJoinOk && pvpJoinReceipt && joinId) {
      const gid = BigInt(joinId);
      showToast("Joined! Starting game…", "#1FA85C");
      // The opponent address is not easily known here — will be read from chain
      // For now navigate with placeholder; PvPGameBoard will read it
      onEnterPvp(gid, 1, BigInt(0), "");
    }
  }, [pvpJoinOk, pvpJoinReceipt]); // eslint-disable-line

  // Watch for opponent joining our created game
  useEffect(() => {
    if (pvpData && pvpGameId != null) {
      const [p1, p2, w, state] = pvpData as [string, string, bigint, number, string, bigint];
      if (state === PVP_STATE.ACTIVE && p2 !== "0x0000000000000000000000000000000000000000") {
        showToast("Opponent joined! Starting game…", "#1FA85C");
        onEnterPvp(pvpGameId, 0, w, p2);
        setPvpGameId(null);
      }
    }
  }, [pvpData]); // eslint-disable-line

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleCreateAI() {
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

  function handleCreatePvp() {
    if (pvpBusy) return;
    if (pvpWagerOn) {
      const wagerBN = parseUnits(pvpWager, 18);
      showToast("Approving USDM…", "#F2A916");
      approvePvp({ address: USDM_ADDRESS as `0x${string}`, abi: ERC20_ABI, functionName: "approve", args: [contract, wagerBN] });
    } else {
      showToast("Creating challenge…", "#1FA85C");
      createPvp({ address: contract, abi: PADI_ABI, functionName: "createPvpGame", args: [0n] });
    }
  }

  function handleJoinPvp() {
    if (pvpBusy || !joinId) return;
    showToast("Confirm in your wallet…", "#1FA85C");
    joinPvp({ address: contract, abi: PADI_ABI, functionName: "joinPvpGame", args: [BigInt(joinId)] });
  }

  function copyInviteLink() {
    if (!pvpGameId) return;
    const link = `${window.location.origin}?join=${pvpGameId.toString()}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const aiLabel = (() => {
    if (approveSubmitting || pvpApproveSubmitting) return "Check your wallet…";
    if (approveWaiting || pvpApproveWaiting)       return "Approving USDM…";
    if (createSubmitting || pvpCreateSubmitting)    return "Check your wallet…";
    if (createWaiting || pvpCreateWaiting)         return "Starting game…";
    return wagerOn ? `Start · stake ${wager} USDM` : "Start free game";
  })();

  const pvpLabel = (() => {
    if (pvpApproveSubmitting) return "Check your wallet…";
    if (pvpApproveWaiting)    return "Approving USDM…";
    if (pvpCreateSubmitting)  return "Check your wallet…";
    if (pvpCreateWaiting)     return "Creating challenge…";
    if (pvpJoinSubmitting)    return "Check your wallet…";
    if (pvpJoinWaiting)       return "Joining game…";
    return pvpWagerOn ? `Challenge · stake ${pvpWager} USDM` : "Create free challenge";
  })();

  const streakBonus = winStreak >= 3;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "13px" }}>

      {/* Win streak bonus banner */}
      <AnimatePresence>
        {streakBonus && (
          <motion.div key="streak" initial={{ opacity: 0, y: -10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35 }}
            style={{ background: "linear-gradient(135deg,rgba(242,169,22,.18),rgba(239,75,60,.14))", border: "1px solid rgba(242,169,22,.4)", borderRadius: "16px", padding: "12px 15px", display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "22px" }}>🔥</span>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: "14px", color: "#F4C95A" }}>{winStreak}-win streak! 2× cowries active</p>
              <p style={{ margin: "1px 0 0", fontSize: "12px", color: "#C99A2E" }}>Keep winning to grow the multiplier</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prize Pool Banner */}
      <motion.div {...fadeUp} transition={{ duration: 0.45, ease: "easeOut" }} style={{ borderRadius: "22px", padding: "20px", position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#3a2012,#221107)", border: "1px solid rgba(242,169,22,.24)" }}>
        <div style={{ position: "absolute", right: "-30px", top: "-30px", width: "150px", height: "150px", background: "repeating-conic-gradient(from 0deg,#F2A916 0 11deg,transparent 11deg 22deg)", opacity: 0.1, borderRadius: "50%" }} />
        <p style={{ margin: 0, color: "#C99A2E", fontSize: "11px", fontWeight: 800, letterSpacing: "1.5px" }}>WEEKLY PRIZE POOL</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px", margin: "6px 0 0", position: "relative" }}>
          <span className="prize-amount" style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "clamp(32px,10vw,42px)", color: "#F4C95A", lineHeight: 1, animation: "prizeGlow 2.8s ease-in-out infinite" }}>{prizeDisplay}</span>
          <span style={{ color: "#C99A2E", fontWeight: 700, fontSize: "15px" }}>USDM</span>
        </div>
        <motion.button whileTap={{ scale: 0.96 }} onClick={onViewRanks} style={{ marginTop: "14px", background: "rgba(242,169,22,.16)", border: "1px solid rgba(242,169,22,.34)", color: "#F4C95A", fontWeight: 700, fontSize: "13px", borderRadius: "999px", padding: "9px 16px", cursor: "pointer" }}>
          View leaderboard →
        </motion.button>
      </motion.div>

      {/* Daily Cowries */}
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
        ].map(({ value, label, color }, i) => (
          <motion.div key={label} className="stat-card" {...scaleIn} transition={{ duration: 0.38, delay: 0.08 + i * 0.09, ease: [0.22, 1, 0.36, 1] }} style={{ background: "rgba(255,238,214,.04)", border: "1px solid rgba(247,179,43,.1)", borderRadius: "16px", padding: "13px 8px", textAlign: "center" }}>
            <p className="stat-value" style={{ margin: 0, fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "24px", color }}>{value}</p>
            <p style={{ margin: "1px 0 0", color: "#8c7866", fontSize: "11px", fontWeight: 600 }}>{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Mode selector */}
      <motion.div {...fadeUp} transition={{ duration: 0.4, delay: 0.14, ease: "easeOut" }} style={{ background: "rgba(255,238,214,.035)", border: "1px solid rgba(247,179,43,.12)", borderRadius: "22px", padding: "18px" }}>

        {/* Tab row */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
          {(["ai", "pvp"] as const).map((m) => {
            const active = mode === m;
            return (
              <motion.button key={m} onClick={() => setMode(m)} whileTap={{ scale: 0.96 }}
                style={{ flex: 1, padding: "10px", borderRadius: "14px", border: `1px solid ${active ? "#EF4B3C" : "rgba(255,238,214,.09)"}`, background: active ? "rgba(239,75,60,.14)" : "rgba(255,238,214,.04)", color: active ? "#EF4B3C" : "#8c7866", fontWeight: 800, fontSize: "13px", cursor: "pointer" }}>
                {m === "ai" ? "🤖 vs AI" : "⚔️ Challenge"}
              </motion.button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {mode === "ai" ? (
            <motion.div key="ai" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
              <p style={{ margin: "0 0 3px", fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "17px", color: "#FBEFE0" }}>Play vs AI</p>
              <p style={{ margin: "0 0 14px", color: "#A8927C", fontSize: "13px" }}>How many padis are you taking on?</p>

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

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "16px", paddingTop: "14px", borderTop: "1px solid rgba(247,179,43,.1)" }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "#FBEFE0" }}>Stake USDM</p>
                  <p style={{ margin: "1px 0 0", color: "#8c7866", fontSize: "12px" }}>Win 99% back if you sweep</p>
                </div>
                <button onClick={() => setWagerOn(v => !v)} style={{ width: "48px", height: "28px", borderRadius: "999px", border: "none", cursor: "pointer", padding: "3px", display: "flex", justifyContent: wagerOn ? "flex-end" : "flex-start", background: wagerOn ? "#1FA85C" : "rgba(255,238,214,.12)", transition: "all .2s" }}>
                  <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#fff", display: "block", boxShadow: "0 2px 4px rgba(0,0,0,.3)" }} />
                </button>
              </div>
              {wagerOn && (
                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                  {WAGER_PRESETS.map(v => (
                    <button key={v} onClick={() => setWager(v)} style={{ flex: 1, padding: "10px 4px", borderRadius: "12px", cursor: "pointer", fontSize: "13px", fontWeight: 700, background: wager === v ? "rgba(242,169,22,.16)" : "rgba(255,238,214,.04)", border: `1px solid ${wager === v ? "#F2A916" : "rgba(255,238,214,.09)"}`, color: wager === v ? "#F4C95A" : "#A8927C" }}>
                      {v} USDM
                    </button>
                  ))}
                </div>
              )}

              <motion.button onClick={handleCreateAI} disabled={busy} whileTap={busy ? {} : { scale: 0.97 }}
                style={{ width: "100%", marginTop: "14px", padding: "16px", border: "none", borderRadius: "16px", background: busy ? "rgba(239,75,60,.45)" : "linear-gradient(135deg,#F2622E,#EF4B3C)", color: "#fff", fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "17px", cursor: busy ? "default" : "pointer", boxShadow: busy ? "none" : "0 12px 26px -10px rgba(239,75,60,.7)", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                {busy && <span style={{ width: "16px", height: "16px", borderRadius: "50%", border: "2.5px solid rgba(255,255,255,.4)", borderTopColor: "#fff", animation: "spin .7s linear infinite", display: "inline-block", flexShrink: 0 }} />}
                {aiLabel}
              </motion.button>
            </motion.div>
          ) : (
            <motion.div key="pvp" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>

              {/* Create a challenge */}
              <p style={{ margin: "0 0 3px", fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "17px", color: "#FBEFE0" }}>Challenge a padi</p>
              <p style={{ margin: "0 0 14px", color: "#A8927C", fontSize: "13px" }}>Create a game, share the link — first to get all pieces home wins</p>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: "1px solid rgba(247,179,43,.1)" }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "#FBEFE0" }}>Stake USDM</p>
                  <p style={{ margin: "1px 0 0", color: "#8c7866", fontSize: "12px" }}>Winner takes 99% of combined pot</p>
                </div>
                <button onClick={() => setPvpWagerOn(v => !v)} style={{ width: "48px", height: "28px", borderRadius: "999px", border: "none", cursor: "pointer", padding: "3px", display: "flex", justifyContent: pvpWagerOn ? "flex-end" : "flex-start", background: pvpWagerOn ? "#1FA85C" : "rgba(255,238,214,.12)", transition: "all .2s" }}>
                  <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#fff", display: "block", boxShadow: "0 2px 4px rgba(0,0,0,.3)" }} />
                </button>
              </div>
              {pvpWagerOn && (
                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                  {WAGER_PRESETS.map(v => (
                    <button key={v} onClick={() => setPvpWager(v)} style={{ flex: 1, padding: "10px 4px", borderRadius: "12px", cursor: "pointer", fontSize: "13px", fontWeight: 700, background: pvpWager === v ? "rgba(242,169,22,.16)" : "rgba(255,238,214,.04)", border: `1px solid ${pvpWager === v ? "#F2A916" : "rgba(255,238,214,.09)"}`, color: pvpWager === v ? "#F4C95A" : "#A8927C" }}>
                      {v} USDM
                    </button>
                  ))}
                </div>
              )}

              {!pvpGameId ? (
                <motion.button onClick={handleCreatePvp} disabled={pvpBusy} whileTap={pvpBusy ? {} : { scale: 0.97 }}
                  style={{ width: "100%", marginTop: "14px", padding: "16px", border: "none", borderRadius: "16px", background: pvpBusy ? "rgba(61,107,255,.45)" : "linear-gradient(135deg,#4C7EFF,#3D6BFF)", color: "#fff", fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "17px", cursor: pvpBusy ? "default" : "pointer", boxShadow: pvpBusy ? "none" : "0 12px 26px -10px rgba(61,107,255,.7)", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                  {pvpBusy && <span style={{ width: "16px", height: "16px", borderRadius: "50%", border: "2.5px solid rgba(255,255,255,.4)", borderTopColor: "#fff", animation: "spin .7s linear infinite", display: "inline-block", flexShrink: 0 }} />}
                  {pvpLabel}
                </motion.button>
              ) : (
                /* Share link — game created, waiting for opponent */
                <div style={{ marginTop: "14px" }}>
                  <p style={{ margin: "0 0 8px", color: "#8FB99B", fontSize: "13px", fontWeight: 700 }}>✓ Challenge created! Share this link:</p>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <div style={{ flex: 1, background: "rgba(255,238,214,.05)", border: "1px solid rgba(247,179,43,.18)", borderRadius: "12px", padding: "10px 13px", fontSize: "12px", color: "#A8927C", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {typeof window !== "undefined" ? `${window.location.origin}?join=${pvpGameId.toString()}` : `?join=${pvpGameId.toString()}`}
                    </div>
                    <motion.button onClick={copyInviteLink} whileTap={{ scale: 0.93 }}
                      style={{ padding: "10px 14px", borderRadius: "12px", border: "none", background: copied ? "#1FA85C" : "rgba(255,238,214,.1)", color: copied ? "#fff" : "#FBEFE0", fontWeight: 700, fontSize: "13px", cursor: "pointer", flexShrink: 0 }}>
                      {copied ? "✓" : "Copy"}
                    </motion.button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "9px", marginTop: "10px" }}>
                    <span style={{ width: "16px", height: "16px", borderRadius: "50%", border: "2.5px solid rgba(242,169,22,.3)", borderTopColor: "#F2A916", animation: "spin .8s linear infinite", display: "inline-block", flexShrink: 0 }} />
                    <p style={{ margin: 0, color: "#A8927C", fontSize: "13px" }}>Waiting for your padi to join…</p>
                  </div>
                </div>
              )}

              {/* Join a challenge */}
              <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid rgba(247,179,43,.1)" }}>
                <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: "14px", color: "#FBEFE0" }}>Got a challenge link?</p>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="number"
                    placeholder="Enter game ID…"
                    value={joinId}
                    onChange={e => setJoinId(e.target.value)}
                    style={{ flex: 1, background: "rgba(255,238,214,.05)", border: "1px solid rgba(247,179,43,.18)", borderRadius: "12px", padding: "11px 13px", color: "#FBEFE0", fontSize: "14px", fontWeight: 600, outline: "none" }}
                  />
                  <motion.button onClick={handleJoinPvp} disabled={pvpBusy || !joinId} whileTap={{ scale: 0.95 }}
                    style={{ padding: "11px 18px", borderRadius: "12px", border: "none", background: !joinId || pvpBusy ? "rgba(31,168,92,.3)" : "#1FA85C", color: "#fff", fontWeight: 800, fontSize: "14px", cursor: !joinId || pvpBusy ? "default" : "pointer", flexShrink: 0 }}>
                    Join
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Recent Games */}
      {myGames && myGames.length > 0 && (
        <div style={{ background: "rgba(255,238,214,.035)", border: "1px solid rgba(247,179,43,.1)", borderRadius: "18px", padding: "16px" }}>
          <p style={{ margin: "0 0 10px", color: "#A8927C", fontSize: "12px", fontWeight: 700, letterSpacing: "0.5px" }}>RECENT GAMES</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {[...myGames].reverse().slice(0, 8).map((id, i) => {
              const saveKey = `padi:gs:${id.toString()}`;
              const hasSave = typeof window !== "undefined" && !!localStorage.getItem(saveKey);
              return (
                <motion.button
                  key={id.toString()}
                  onClick={() => onEnterGame(id)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.07, ease: "easeOut" }}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.95 }}
                  style={{ padding: "9px 16px", background: hasSave ? "rgba(31,168,92,.12)" : "rgba(255,238,214,.06)", border: `1px solid ${hasSave ? "rgba(31,168,92,.35)" : "rgba(247,179,43,.14)"}`, borderRadius: "999px", color: hasSave ? "#8FB99B" : "#D8C4AC", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                  {hasSave ? "▶ " : ""}Game #{id.toString()}
                </motion.button>
              );
            })}
          </div>
          <p style={{ margin: "10px 0 0", color: "#5a4a3a", fontSize: "11px" }}>▶ = in progress · tap any to view or resume</p>
        </div>
      )}
    </div>
  );
}
