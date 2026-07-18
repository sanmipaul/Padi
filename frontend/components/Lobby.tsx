"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { PADI_ADDRESS, PADI_ABI, ERC20_ABI, USDM_ADDRESS, PVP_STATE } from "@/lib/contracts";

const WAGER_PRESETS = ["0.10", "0.25", "1.00"];

export interface PvpJoinInfo { gameId: bigint; wager: bigint; player1: string }

interface LobbyProps {
  cowries: number;
  streak: number;
  localWins: number;
  winStreak: number;
  gamesPlayed?: number;
  dailyClaimed: boolean;
  initialJoinId?: string;
  onEnterGame: (id: bigint) => void;
  onEnterPvp: (gameId: bigint, mySeat: 0 | 1, wager: bigint, opponent: string) => void;
  onOpenDaily: () => void;
  onViewRanks: () => void;
  showToast: (text: string, color: string) => void;
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} style={{ width: 46, height: 26, borderRadius: 999, border: "none", cursor: "pointer", padding: 3, display: "flex", justifyContent: on ? "flex-end" : "flex-start", background: on ? "#34E0C4" : "rgba(255,255,255,.12)", transition: "all .2s", flexShrink: 0 }}>
      <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", display: "block", boxShadow: "0 2px 4px rgba(0,0,0,.3)" }} />
    </button>
  );
}

function Spinner() {
  return <span style={{ width: 15, height: 15, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,.4)", borderTopColor: "#fff", animation: "spin .7s linear infinite", display: "inline-block", flexShrink: 0 }} />;
}

export default function Lobby({
  cowries, streak, localWins, winStreak, gamesPlayed = 0, dailyClaimed, initialJoinId,
  onEnterGame, onEnterPvp, onOpenDaily, onViewRanks, showToast,
}: LobbyProps) {
  const { address } = useAccount();
  const contract = PADI_ADDRESS;

  const [mode, setMode] = useState<"ai" | "pvp">(initialJoinId ? "pvp" : "ai");
  const [aiCount, setAiCount] = useState(1);
  const [wagerOn, setWagerOn] = useState(false);
  const [wager, setWager] = useState("0.25");
  const [pendingWager, setPendingWager] = useState(0n);
  const [pvpWagerOn, setPvpWagerOn] = useState(false);
  const [pvpWager, setPvpWager] = useState("0.25");
  const [pvpGameId, setPvpGameId] = useState<bigint | null>(null);
  const [joinId, setJoinId] = useState(initialJoinId ?? "");
  const [copied, setCopied] = useState(false);

  const { data: prizePool } = useReadContract({ address: contract, abi: PADI_ABI, functionName: "weeklyPrizePool" });
  const { data: myGames } = useReadContract({ address: contract, abi: PADI_ABI, functionName: "getPlayerGames", args: address ? [address] : undefined });
  const { data: pvpData } = useReadContract({
    address: contract, abi: PADI_ABI, functionName: "getPvpGame",
    args: pvpGameId != null ? [pvpGameId] : undefined,
    query: { enabled: pvpGameId != null, refetchInterval: 4_000 },
  });

  const { writeContract: approve, data: approveTx, isPending: approveSubmitting, error: approveError } = useWriteContract();
  const { writeContract: create, data: createTx, isPending: createSubmitting, error: createError } = useWriteContract();
  const { isSuccess: approveOk, isLoading: approveWaiting } = useWaitForTransactionReceipt({ hash: approveTx });
  const { isSuccess: createOk, isLoading: createWaiting, data: createReceipt } = useWaitForTransactionReceipt({ hash: createTx });

  const { writeContract: createPvp, data: pvpCreateTx, isPending: pvpCreateSubmitting, error: pvpCreateError } = useWriteContract();
  const { writeContract: approvePvp, data: pvpApproveTx, isPending: pvpApproveSubmitting, error: pvpApproveError } = useWriteContract();
  const { writeContract: joinPvp, data: pvpJoinTx, isPending: pvpJoinSubmitting, error: pvpJoinError } = useWriteContract();
  const { isSuccess: pvpApproveOk, isLoading: pvpApproveWaiting } = useWaitForTransactionReceipt({ hash: pvpApproveTx });
  const { isSuccess: pvpCreateOk, isLoading: pvpCreateWaiting, data: pvpCreateReceipt } = useWaitForTransactionReceipt({ hash: pvpCreateTx });
  const { isSuccess: pvpJoinOk, isLoading: pvpJoinWaiting, data: pvpJoinReceipt } = useWaitForTransactionReceipt({ hash: pvpJoinTx });

  const busy = approveSubmitting || approveWaiting || createSubmitting || createWaiting;
  const pvpBusy = pvpApproveSubmitting || pvpApproveWaiting || pvpCreateSubmitting || pvpCreateWaiting || pvpJoinSubmitting || pvpJoinWaiting;

  const prizeDisplay = prizePool ? (Number(prizePool) / 1e18).toFixed(2) : "0.00";

  useEffect(() => { if (approveError) showToast("Approval failed.", "#FF5C8A"); }, [approveError]); // eslint-disable-line
  useEffect(() => { if (createError) showToast("Transaction failed.", "#FF5C8A"); }, [createError]); // eslint-disable-line
  useEffect(() => { if (pvpCreateError || pvpApproveError || pvpJoinError) showToast("Transaction failed.", "#FF5C8A"); }, [pvpCreateError, pvpApproveError, pvpJoinError]); // eslint-disable-line

  useEffect(() => {
    if (approveOk && pendingWager > 0n && !createTx) {
      showToast("Creating game…", "#34E0C4");
      create({ address: contract, abi: PADI_ABI, functionName: "createGame", args: [aiCount, pendingWager] });
    }
  }, [approveOk]); // eslint-disable-line

  useEffect(() => {
    if (createOk && createReceipt) {
      const TOPIC = "0xdd0abcdffc76581d11646898ee4d7f269ca1e0c0b622d072d343100dad83ecb1";
      const log = createReceipt.logs.find(l => l.topics[0]?.toLowerCase() === TOPIC);
      if (log?.topics[1]) onEnterGame(BigInt(log.topics[1]));
      else showToast("Game created!", "#FFB23E");
    }
  }, [createOk, createReceipt]); // eslint-disable-line

  useEffect(() => {
    if (pvpApproveOk) {
      const wagerBN = parseUnits(pvpWager, 18);
      showToast("Creating challenge…", "#34E0C4");
      createPvp({ address: contract, abi: PADI_ABI, functionName: "createPvpGame", args: [wagerBN] });
    }
  }, [pvpApproveOk]); // eslint-disable-line

  useEffect(() => {
    if (pvpCreateOk && pvpCreateReceipt) {
      const log = pvpCreateReceipt.logs.find(l =>
        l.address.toLowerCase() === contract.toLowerCase() && l.topics.length >= 2
      );
      if (log?.topics[1]) {
        setPvpGameId(BigInt(log.topics[1]));
        showToast("Challenge created! Share the link.", "#FFB23E");
      }
    }
  }, [pvpCreateOk, pvpCreateReceipt]); // eslint-disable-line

  useEffect(() => {
    if (pvpJoinOk && pvpJoinReceipt && joinId) {
      const gid = BigInt(joinId);
      showToast("Joined! Starting game…", "#34E0C4");
      onEnterPvp(gid, 1, BigInt(0), "");
    }
  }, [pvpJoinOk, pvpJoinReceipt]); // eslint-disable-line

  useEffect(() => {
    if (pvpData && pvpGameId != null) {
      const [p1, p2, w, state] = pvpData as [string, string, bigint, number, string, bigint];
      if (state === PVP_STATE.ACTIVE && p2 !== "0x0000000000000000000000000000000000000000") {
        showToast("Opponent joined! Starting game…", "#34E0C4");
        onEnterPvp(pvpGameId, 0, w, p2);
        setPvpGameId(null);
      }
    }
  }, [pvpData]); // eslint-disable-line

  function handleCreateAI() {
    if (busy) return;
    if (wagerOn) {
      const wagerBN = parseUnits(wager, 18);
      setPendingWager(wagerBN);
      showToast("Approving USDM…", "#FFB23E");
      approve({ address: USDM_ADDRESS as `0x${string}`, abi: ERC20_ABI, functionName: "approve", args: [contract, wagerBN] });
    } else {
      showToast("Confirm in your wallet…", "#34E0C4");
      create({ address: contract, abi: PADI_ABI, functionName: "createGame", args: [aiCount, 0n] });
    }
  }

  function handleCreatePvp() {
    if (pvpBusy) return;
    if (pvpWagerOn) {
      const wagerBN = parseUnits(pvpWager, 18);
      showToast("Approving USDM…", "#FFB23E");
      approvePvp({ address: USDM_ADDRESS as `0x${string}`, abi: ERC20_ABI, functionName: "approve", args: [contract, wagerBN] });
    } else {
      showToast("Creating challenge…", "#34E0C4");
      createPvp({ address: contract, abi: PADI_ABI, functionName: "createPvpGame", args: [0n] });
    }
  }

  function handleJoinPvp() {
    if (pvpBusy || !joinId) return;
    showToast("Confirm in your wallet…", "#34E0C4");
    joinPvp({ address: contract, abi: PADI_ABI, functionName: "joinPvpGame", args: [BigInt(joinId)] });
  }

  function copyInviteLink() {
    if (!pvpGameId) return;
    const link = `${window.location.origin}?join=${pvpGameId.toString()}`;
    navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  const aiLabel = (() => {
    if (approveSubmitting) return "Check your wallet…";
    if (approveWaiting) return "Approving USDM…";
    if (createSubmitting) return "Check your wallet…";
    if (createWaiting) return "Starting game…";
    return wagerOn ? `Start · stake ${wager} USDM` : "Start free game";
  })();

  const pvpLabel = (() => {
    if (pvpApproveSubmitting) return "Check your wallet…";
    if (pvpApproveWaiting) return "Approving USDM…";
    if (pvpCreateSubmitting) return "Check your wallet…";
    if (pvpCreateWaiting) return "Creating challenge…";
    if (pvpJoinSubmitting) return "Check your wallet…";
    if (pvpJoinWaiting) return "Joining game…";
    return pvpWagerOn ? `Challenge · stake ${pvpWager} USDM` : "Create free challenge";
  })();

  const AI_PADIS = [
    { name: "Chidi", color: "#8B7CFF", sub: "Strategist" },
    { name: "Amaka", color: "#FF5C8A", sub: "Aggressor" },
    { name: "Tunde", color: "#FFB23E", sub: "Trickster" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Win streak bonus */}
      <AnimatePresence>
        {winStreak >= 3 && (
          <motion.div key="streak" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.32 }}
            style={{ background: "linear-gradient(135deg,rgba(255,178,62,.16),rgba(255,92,138,.12))", border: "1px solid rgba(255,178,62,.38)", borderRadius: 18, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>🔥</span>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: "#FFB23E" }}>{winStreak}-win streak! 2× cowries active</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#C99A2E" }}>Keep winning to grow the multiplier</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div>
        <h1 style={{ fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: "clamp(24px,4vw,30px)", letterSpacing: -1, margin: "0 0 4px" }}>Your parlour</h1>
        <p style={{ color: "#74748C", fontSize: 14, margin: 0 }}>Pick your game mode and roll the dice.</p>
      </div>

      {/* Prize banner + daily in a row on wider screens */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
        {/* Prize pool */}
        <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg,rgba(123,97,255,.22),rgba(52,224,196,.1))", border: "1px solid rgba(123,97,255,.32)", borderRadius: 20, padding: "18px 20px" }}>
          <div style={{ position: "absolute", right: -24, top: -24, width: 110, height: 110, background: "radial-gradient(circle,rgba(52,224,196,.2),transparent 65%)", borderRadius: "50%" }} />
          <p style={{ margin: "0 0 2px", color: "#6FE6CF", fontSize: 10, fontWeight: 800, letterSpacing: "1.4px" }}>WEEKLY PRIZE POOL</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
            <span style={{ fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: "clamp(28px,6vw,36px)", color: "#34E0C4", lineHeight: 1, animation: "prizeGlow 2.8s ease-in-out infinite" }}>{prizeDisplay}</span>
            <span style={{ color: "#5FE7D0", fontWeight: 700, fontSize: 14 }}>USDM</span>
          </div>
          <motion.button whileTap={{ scale: 0.96 }} onClick={onViewRanks} style={{ marginTop: 12, background: "rgba(52,224,196,.14)", border: "1px solid rgba(52,224,196,.3)", color: "#34E0C4", fontWeight: 700, fontSize: 12, borderRadius: 999, padding: "7px 14px", cursor: "pointer" }}>
            Leaderboard →
          </motion.button>
        </div>

        {/* Daily cowries */}
        <button onClick={onOpenDaily} style={{ display: "flex", alignItems: "center", gap: 13, textAlign: "left", cursor: "pointer", background: dailyClaimed ? "rgba(255,255,255,.03)" : "rgba(52,224,196,.1)", border: `1px solid ${dailyClaimed ? "rgba(255,255,255,.08)" : "rgba(52,224,196,.28)"}`, borderRadius: 20, padding: "18px 20px" }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: dailyClaimed ? "rgba(255,255,255,.06)" : "rgba(52,224,196,.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ width: 17, height: 17, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#fff,#34E0C4 62%)", display: "inline-block" }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: "#ECECF2" }}>{dailyClaimed ? "Come back tomorrow" : "Daily cowries ready"}</p>
            <p style={{ margin: "2px 0 0", color: "#74748C", fontSize: 12 }}>Day {streak} streak · tap to {dailyClaimed ? "view" : "claim"}</p>
          </div>
          <span style={{ background: dailyClaimed ? "rgba(255,255,255,.06)" : "#34E0C4", color: dailyClaimed ? "#74748C" : "#06140f", fontWeight: 800, fontSize: 12, borderRadius: 999, padding: "6px 12px", flexShrink: 0 }}>
            {dailyClaimed ? "Done" : "Claim"}
          </span>
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {[
          { value: localWins, label: "Wins", color: "#FF5C8A" },
          { value: streak, label: "Streak", color: "#FFB23E" },
          { value: gamesPlayed, label: "Games", color: "#8B7CFF" },
        ].map(({ value, label, color }) => (
          <div key={label} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: "12px 8px", textAlign: "center" }}>
            <p style={{ margin: 0, fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: "clamp(20px,5vw,26px)", color }}>{value}</p>
            <p style={{ margin: "2px 0 0", color: "#74748C", fontSize: 11, fontWeight: 600 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Mode selector card */}
      <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 22, padding: 20 }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["ai", "pvp"] as const).map(m => {
            const active = mode === m;
            const col = m === "ai" ? "#8B7CFF" : "#34E0C4";
            return (
              <motion.button key={m} onClick={() => setMode(m)} whileTap={{ scale: 0.96 }}
                style={{ flex: 1, padding: "10px 8px", borderRadius: 13, border: `1px solid ${active ? col : "rgba(255,255,255,.09)"}`, background: active ? `rgba(${m === "ai" ? "139,124,255" : "52,224,196"},.14)` : "transparent", color: active ? col : "#74748C", fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all .2s" }}>
                {m === "ai" ? "vs AI Padis" : "vs Real Players"}
              </motion.button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {mode === "ai" ? (
            <motion.div key="ai" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <p style={{ margin: "0 0 4px", fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 18 }}>Pick your padis</p>
              <p style={{ margin: "0 0 16px", color: "#74748C", fontSize: 13 }}>Choose how many AI opponents you're taking on.</p>

              {/* Padi selector */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
                {AI_PADIS.slice(0, 3).map(({ name, color, sub }, idx) => {
                  const n = idx + 1;
                  const active = aiCount === n;
                  return (
                    <button key={n} onClick={() => setAiCount(n)}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "14px 6px", borderRadius: 15, cursor: "pointer", background: active ? `rgba(${color === "#8B7CFF" ? "139,124,255" : color === "#FF5C8A" ? "255,92,138" : "255,178,62"},.16)` : "rgba(255,255,255,.04)", border: `1px solid ${active ? color : "rgba(255,255,255,.09)"}`, transition: "all .2s" }}>
                      <span style={{ width: 34, height: 34, borderRadius: "50%", background: `radial-gradient(circle at 35% 30%,#fff,${color} 62%)`, display: "inline-block", boxShadow: active ? `0 0 14px ${color}88` : "none" }} />
                      <span style={{ fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14, color: active ? color : "#C5C5D8" }}>{name}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: active ? color : "#74748C" }}>{sub}</span>
                    </button>
                  );
                })}
              </div>

              {/* Wager toggle */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.07)" }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#ECECF2" }}>Stake USDM</p>
                  <p style={{ margin: "2px 0 0", color: "#74748C", fontSize: 12 }}>Win 99% back if you sweep</p>
                </div>
                <Toggle on={wagerOn} onChange={setWagerOn} />
              </div>
              {wagerOn && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  {WAGER_PRESETS.map(v => (
                    <button key={v} onClick={() => setWager(v)} style={{ flex: 1, padding: "10px 4px", borderRadius: 11, cursor: "pointer", fontSize: 13, fontWeight: 700, background: wager === v ? "rgba(139,124,255,.16)" : "rgba(255,255,255,.04)", border: `1px solid ${wager === v ? "#8B7CFF" : "rgba(255,255,255,.09)"}`, color: wager === v ? "#8B7CFF" : "#9C9CB6" }}>
                      {v} USDM
                    </button>
                  ))}
                </div>
              )}

              <motion.button onClick={handleCreateAI} disabled={busy} whileTap={busy ? {} : { scale: 0.97 }}
                style={{ width: "100%", marginTop: 14, padding: 16, border: "none", borderRadius: 15, background: busy ? "rgba(139,124,255,.45)" : "linear-gradient(135deg,#8B7CFF,#5C6BFF)", color: "#fff", fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 16, cursor: busy ? "default" : "pointer", boxShadow: busy ? "none" : "0 12px 26px -10px rgba(123,97,255,.7)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                {busy && <Spinner />}
                {aiLabel}
              </motion.button>
            </motion.div>
          ) : (
            <motion.div key="pvp" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>

              {/* Create challenge */}
              <p style={{ margin: "0 0 4px", fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 18 }}>Create a private room</p>
              <p style={{ margin: "0 0 14px", color: "#74748C", fontSize: 13 }}>Share the link with your padi — first to get all tokens home wins.</p>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,.07)" }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#ECECF2" }}>Stake USDM</p>
                  <p style={{ margin: "2px 0 0", color: "#74748C", fontSize: 12 }}>Winner takes 99% of combined pot</p>
                </div>
                <Toggle on={pvpWagerOn} onChange={setPvpWagerOn} />
              </div>
              {pvpWagerOn && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  {WAGER_PRESETS.map(v => (
                    <button key={v} onClick={() => setPvpWager(v)} style={{ flex: 1, padding: "10px 4px", borderRadius: 11, cursor: "pointer", fontSize: 13, fontWeight: 700, background: pvpWager === v ? "rgba(52,224,196,.14)" : "rgba(255,255,255,.04)", border: `1px solid ${pvpWager === v ? "#34E0C4" : "rgba(255,255,255,.09)"}`, color: pvpWager === v ? "#34E0C4" : "#9C9CB6" }}>
                      {v} USDM
                    </button>
                  ))}
                </div>
              )}

              {!pvpGameId ? (
                <motion.button onClick={handleCreatePvp} disabled={pvpBusy} whileTap={pvpBusy ? {} : { scale: 0.97 }}
                  style={{ width: "100%", marginTop: 14, padding: 16, border: "none", borderRadius: 15, background: pvpBusy ? "rgba(52,224,196,.35)" : "linear-gradient(135deg,#34E0C4,#22C2A8)", color: pvpBusy ? "#aaa" : "#06140f", fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 16, cursor: pvpBusy ? "default" : "pointer", boxShadow: pvpBusy ? "none" : "0 12px 26px -10px rgba(52,224,196,.6)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                  {pvpBusy && <Spinner />}
                  {pvpLabel}
                </motion.button>
              ) : (
                <div style={{ marginTop: 14 }}>
                  <p style={{ margin: "0 0 8px", color: "#5FE7D0", fontSize: 13, fontWeight: 700 }}>✓ Room created! Share this link:</p>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ flex: 1, background: "rgba(52,224,196,.06)", border: "1px solid rgba(52,224,196,.22)", borderRadius: 11, padding: "10px 13px", fontSize: 12, color: "#74748C", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {typeof window !== "undefined" ? `${window.location.origin}?join=${pvpGameId.toString()}` : `?join=${pvpGameId.toString()}`}
                    </div>
                    <motion.button onClick={copyInviteLink} whileTap={{ scale: 0.93 }}
                      style={{ padding: "10px 14px", borderRadius: 11, border: "none", background: copied ? "#34E0C4" : "rgba(255,255,255,.08)", color: copied ? "#06140f" : "#ECECF2", fontWeight: 700, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>
                      {copied ? "✓" : "Copy"}
                    </motion.button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 10 }}>
                    <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2.5px solid rgba(52,224,196,.3)", borderTopColor: "#34E0C4", animation: "spin .8s linear infinite", display: "inline-block", flexShrink: 0 }} />
                    <p style={{ margin: 0, color: "#74748C", fontSize: 13 }}>Waiting for your padi to join…</p>
                  </div>
                </div>
              )}

              {/* Join */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.07)" }}>
                <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: 14, color: "#ECECF2" }}>Have an invite link?</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="number" placeholder="Enter game ID…" value={joinId} onChange={e => setJoinId(e.target.value)}
                    style={{ flex: 1, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 11, padding: "11px 13px", color: "#ECECF2", fontSize: 14, fontWeight: 600, outline: "none", fontFamily: "var(--font-manrope),'Manrope',sans-serif" }} />
                  <motion.button onClick={handleJoinPvp} disabled={pvpBusy || !joinId} whileTap={{ scale: 0.95 }}
                    style={{ padding: "11px 18px", borderRadius: 11, border: "none", background: !joinId || pvpBusy ? "rgba(52,224,196,.3)" : "#34E0C4", color: !joinId || pvpBusy ? "#888" : "#06140f", fontWeight: 700, fontSize: 14, cursor: !joinId || pvpBusy ? "default" : "pointer", flexShrink: 0 }}>
                    Join
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Recent games */}
      {myGames && myGames.length > 0 && (
        <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, padding: 16 }}>
          <p style={{ margin: "0 0 10px", color: "#74748C", fontSize: 11, fontWeight: 700, letterSpacing: ".5px" }}>RECENT GAMES</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[...myGames].reverse().slice(0, 8).map((id, i) => {
              const hasSave = typeof window !== "undefined" && !!localStorage.getItem(`padi:gs:${id.toString()}`);
              return (
                <motion.button key={id.toString()} onClick={() => onEnterGame(id)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, delay: i * 0.07 }} whileTap={{ scale: 0.95 }}
                  style={{ padding: "8px 14px", background: hasSave ? "rgba(52,224,196,.1)" : "rgba(255,255,255,.05)", border: `1px solid ${hasSave ? "rgba(52,224,196,.32)" : "rgba(255,255,255,.1)"}`, borderRadius: 999, color: hasSave ? "#34E0C4" : "#C5C5D8", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {hasSave ? "▶ " : ""}Game #{id.toString()}
                </motion.button>
              );
            })}
          </div>
          <p style={{ margin: "8px 0 0", color: "#4A4A5C", fontSize: 11 }}>▶ = in progress · tap to resume</p>
        </div>
      )}
    </div>
  );
}
