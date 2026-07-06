"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAccount, useReadContract, useReadContracts, usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import { PADI_ADDRESS, PADI_ABI } from "@/lib/contracts";

const GAME_CREATED_EVENT = parseAbiItem(
  "event GameCreated(uint256 indexed gameId, address indexed player, uint8 aiCount)",
);

const MEDAL_COLORS = ["#F2A916", "#CBB89A", "#C97B3A"];

// Look back this many blocks when scanning for players (~115 days on Celo at 5s/block)
const SCAN_DEPTH = 2_000_000n;

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function Leaderboard({ onBack, localWins = 0 }: { onBack: () => void; localWins?: number }) {
  const { address } = useAccount();
  const contract = PADI_ADDRESS;
  const publicClient = usePublicClient();

  const [players, setPlayers]   = useState<`0x${string}`[]>([]);
  const [scanning, setScanning] = useState(true);

  const { data: prize, refetch: refetchPrize } = useReadContract({
    address: contract, abi: PADI_ABI, functionName: "weeklyPrizePool",
    query: { refetchInterval: 30_000 },
  });
  const { data: totalGamesCount } = useReadContract({
    address: contract, abi: PADI_ABI, functionName: "totalGames",
    query: { refetchInterval: 30_000 },
  });

  // ── Scan GameCreated events to build the unique-player set ───────
  useEffect(() => {
    if (!publicClient) return;
    let cancelled = false;
    (async () => {
      setScanning(true);
      try {
        const latest = await publicClient.getBlockNumber();
        const fromBlock = latest > SCAN_DEPTH ? latest - SCAN_DEPTH : 0n;
        const logs = await publicClient.getLogs({
          address: contract,
          event: GAME_CREATED_EVENT,
          fromBlock,
          toBlock: "latest",
        });
        if (cancelled) return;
        const seen = new Set<string>();
        const unique: `0x${string}`[] = [];
        for (const log of logs) {
          const p = log.args?.player;
          if (p && !seen.has(p.toLowerCase())) {
            seen.add(p.toLowerCase());
            unique.push(p);
          }
        }
        // Always include the connected wallet even if they haven't played yet
        if (address && !seen.has(address.toLowerCase())) {
          unique.push(address);
        }
        setPlayers(unique);
      } catch (err) {
        console.error("Leaderboard scan error:", err);
        // Fallback: just show current user
        if (address) setPlayers([address]);
      } finally {
        if (!cancelled) setScanning(false);
      }
    })();
    return () => { cancelled = true; };
  }, [publicClient, contract, address]);

  // ── Batch-read totalWins for every player ────────────────────────
  const { data: winsData, refetch: refetchWins } = useReadContracts({
    contracts: players.map((addr) => ({
      address: contract as `0x${string}`,
      abi: PADI_ABI,
      functionName: "totalWins" as const,
      args: [addr] as const,
    })),
    query: {
      enabled: players.length > 0,
      refetchInterval: 30_000,
    },
  });

  // ── Build sorted leaderboard ─────────────────────────────────────
  const entries = players
    .map((addr, i) => {
      const isYou = addr.toLowerCase() === address?.toLowerCase();
      const onChainWins = winsData?.[i]?.result != null ? Number(winsData[i].result) : 0;
      // For the current user: take the higher of local (free+wager) vs on-chain (wager only).
      // This way free wins count AND wager wins from other devices are never lost.
      const wins = isYou ? Math.max(localWins, onChainWins) : onChainWins;
      return { address: addr, wins, isYou, label: isYou ? "You" : shortAddr(addr) };
    })
    .sort((a, b) => b.wins - a.wins || (a.isYou ? 1 : 0) - (b.isYou ? 1 : 0));

  const prizeDisplay = prize ? (Number(prize) / 1e18).toFixed(2) : "0.00";
  const totalDisplay = totalGamesCount ? Number(totalGamesCount) : 0;

  function handleRefresh() {
    refetchPrize();
    refetchWins();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingTop: "2px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={onBack} style={{ background: "rgba(255,238,214,.06)", border: "1px solid rgba(247,179,43,.12)", color: "#C9B49C", fontSize: "13px", fontWeight: 600, borderRadius: "999px", padding: "7px 13px", cursor: "pointer" }}>
            ←
          </button>
          <span style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "22px", color: "#FBEFE0" }}>Leaderboard</span>
        </div>
        <button onClick={handleRefresh} style={{ background: "rgba(255,238,214,.05)", border: "1px solid rgba(247,179,43,.12)", color: "#A8927C", fontSize: "12px", fontWeight: 600, borderRadius: "999px", padding: "6px 13px", cursor: "pointer" }}>
          ↻ Refresh
        </button>
      </div>

      {/* Prize pool banner — no fake reset timer */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: "easeOut" }}
        style={{ borderRadius: "18px", padding: "18px", background: "linear-gradient(135deg,#3a2012,#221107)", border: "1px solid rgba(242,169,22,.22)" }}
      >
        <p style={{ margin: 0, color: "#C99A2E", fontSize: "11px", fontWeight: 800, letterSpacing: "1px" }}>PRIZE POOL</p>
        <p style={{ margin: "5px 0 0", fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "30px", color: "#F4C95A", lineHeight: 1, animation: "prizeGlow 2.8s ease-in-out infinite" }}>
          {prizeDisplay} <span style={{ fontSize: "14px", color: "#C99A2E", fontWeight: 700 }}>USDM</span>
        </p>
        <p style={{ margin: "6px 0 0", color: "#8c7866", fontSize: "12px" }}>Grows with every wager · paid out to winners</p>
      </motion.div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        {[
          { val: totalDisplay, label: "Total Games", color: "#FBEFE0" },
          { val: Math.max(localWins, entries.find(e => e.isYou)?.wins ?? 0), label: "Your Wins", color: "#EF4B3C" },
        ].map(({ val, label, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, delay: 0.1 + i * 0.09, ease: [0.22, 1, 0.36, 1] }}
            style={{ background: "rgba(255,238,214,.04)", border: "1px solid rgba(247,179,43,.1)", borderRadius: "16px", padding: "13px", textAlign: "center" }}
          >
            <p style={{ margin: 0, fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "22px", color }}>{val}</p>
            <p style={{ margin: "2px 0 0", color: "#8c7866", fontSize: "11px", fontWeight: 600 }}>{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Leaderboard rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {scanning && entries.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "28px", color: "#A8927C", fontSize: "14px" }}>
            <span style={{ width: "18px", height: "18px", borderRadius: "50%", border: "2.5px solid rgba(242,169,22,.3)", borderTopColor: "#F2A916", animation: "spin .8s linear infinite", display: "inline-block" }} />
            Loading players…
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: "28px", textAlign: "center", color: "#6f5d4c", fontSize: "14px" }}>
            No games played yet — be the first!
          </div>
        ) : (
          entries.map((p, idx) => {
            const top = idx < 3;
            return (
              <motion.div
                key={p.address}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.055, ease: "easeOut" }}
                style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "14px", background: p.isYou ? "rgba(239,75,60,.12)" : "rgba(255,238,214,.035)", border: `1px solid ${p.isYou ? "rgba(239,75,60,.4)" : "rgba(247,179,43,.08)"}` }}
              >
                <span style={{ width: "24px", textAlign: "center", fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "16px", color: top ? MEDAL_COLORS[idx] : "#8c7866" }}>{idx + 1}</span>
                <span style={{ width: "34px", height: "34px", borderRadius: "50%", background: p.isYou ? "#EF4B3C" : "rgba(255,238,214,.1)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "13px", fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", flexShrink: 0 }}>
                  {p.label[0].toUpperCase()}
                </span>
                <span style={{ flex: 1, fontWeight: 700, fontSize: "14px", color: p.isYou ? "#FBEFE0" : "#D8C4AC", fontFamily: "monospace" }}>
                  {p.label}
                </span>
                <span style={{ fontWeight: 700, fontSize: "13px", color: p.isYou ? "#EF8C7E" : "#A8927C" }}>
                  {p.wins} win{p.wins !== 1 ? "s" : ""}
                </span>
              </motion.div>
            );
          })
        )}
      </div>

      {/* How pool grows */}
      <div style={{ background: "rgba(255,238,214,.03)", border: "1px solid rgba(247,179,43,.08)", borderRadius: "16px", padding: "14px", fontSize: "12px", color: "#8c7866", lineHeight: 1.6 }}>
        <p style={{ margin: "0 0 6px", fontWeight: 700, color: "#A8927C" }}>How the pot grows</p>
        <p style={{ margin: "2px 0" }}>• 0.5% of every won wager → pool</p>
        <p style={{ margin: "2px 0" }}>• 100% of lost wagers (AI wins) → pool</p>
        <p style={{ margin: "2px 0" }}>• Anyone can donate via addToPrizePool</p>
      </div>
    </div>
  );
}
