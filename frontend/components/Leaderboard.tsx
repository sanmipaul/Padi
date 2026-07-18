"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAccount, useReadContract, useReadContracts, usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import { PADI_ADDRESS, PADI_ABI } from "@/lib/contracts";

const GAME_CREATED_EVENT = parseAbiItem(
  "event GameCreated(uint256 indexed gameId, address indexed player, uint8 aiCount)",
);

const MEDAL_COLORS = ["#FFB23E", "#C5C5D8", "#CD8B54"];
const SCAN_DEPTH = 2_000_000n;

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function Leaderboard({ onBack, localWins = 0 }: { onBack: () => void; localWins?: number }) {
  const { address } = useAccount();
  const contract = PADI_ADDRESS;
  const publicClient = usePublicClient();

  const [players, setPlayers] = useState<`0x${string}`[]>([]);
  const [scanning, setScanning] = useState(true);

  const { data: prize, refetch: refetchPrize } = useReadContract({
    address: contract, abi: PADI_ABI, functionName: "weeklyPrizePool",
    query: { refetchInterval: 30_000 },
  });
  const { data: totalGamesCount } = useReadContract({
    address: contract, abi: PADI_ABI, functionName: "totalGames",
    query: { refetchInterval: 30_000 },
  });

  useEffect(() => {
    if (!publicClient) return;
    let cancelled = false;
    (async () => {
      setScanning(true);
      try {
        const latest = await publicClient.getBlockNumber();
        const fromBlock = latest > SCAN_DEPTH ? latest - SCAN_DEPTH : 0n;
        const logs = await publicClient.getLogs({
          address: contract, event: GAME_CREATED_EVENT, fromBlock, toBlock: "latest",
        });
        if (cancelled) return;
        const seen = new Set<string>();
        const unique: `0x${string}`[] = [];
        for (const log of logs) {
          const p = log.args?.player;
          if (p && !seen.has(p.toLowerCase())) { seen.add(p.toLowerCase()); unique.push(p); }
        }
        if (address && !seen.has(address.toLowerCase())) unique.push(address);
        setPlayers(unique);
      } catch (err) {
        console.error("Leaderboard scan error:", err);
        if (address) setPlayers([address]);
      } finally {
        if (!cancelled) setScanning(false);
      }
    })();
    return () => { cancelled = true; };
  }, [publicClient, contract, address]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: winsData, refetch: refetchWins } = useReadContracts({
    contracts: players.map(addr => ({
      address: contract as `0x${string}`, abi: PADI_ABI,
      functionName: "totalWins" as const, args: [addr] as const,
    })),
    query: { enabled: players.length > 0, refetchInterval: 30_000 },
  });

  const entries = players
    .map((addr, i) => {
      const isYou = addr.toLowerCase() === address?.toLowerCase();
      const onChainWins = winsData?.[i]?.result != null ? Number(winsData[i].result) : 0;
      const wins = isYou ? Math.max(localWins, onChainWins) : onChainWins;
      return { address: addr, wins, isYou, label: isYou ? "You" : shortAddr(addr) };
    })
    .sort((a, b) => b.wins - a.wins || (a.isYou ? 1 : 0) - (b.isYou ? 1 : 0));

  const prizeDisplay = prize ? (Number(prize) / 1e18).toFixed(2) : "0.00";
  const totalDisplay = totalGamesCount ? Number(totalGamesCount) : 0;

  function handleRefresh() { refetchPrize(); refetchWins(); }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 2 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", color: "#9C9CB6", fontSize: 13, fontWeight: 600, borderRadius: 999, padding: "7px 13px", cursor: "pointer" }}>←</button>
          <span style={{ fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 22, color: "#ECECF2" }}>Leaderboard</span>
        </div>
        <button onClick={handleRefresh} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)", color: "#74748C", fontSize: 12, fontWeight: 600, borderRadius: 999, padding: "6px 13px", cursor: "pointer" }}>↻ Refresh</button>
      </div>

      {/* Prize pool banner */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42, ease: "easeOut" }}
        style={{ borderRadius: 18, padding: 20, background: "linear-gradient(135deg,rgba(123,97,255,.2),rgba(52,224,196,.1))", border: "1px solid rgba(123,97,255,.3)" }}>
        <p style={{ margin: "0 0 2px", color: "#6FE6CF", fontSize: 11, fontWeight: 800, letterSpacing: "1px" }}>WEEKLY PRIZE POOL</p>
        <p style={{ margin: 0, fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 30, color: "#34E0C4", lineHeight: 1, animation: "prizeGlow 2.8s ease-in-out infinite" }}>
          {prizeDisplay} <span style={{ fontSize: 14, color: "#5FE7D0", fontWeight: 700 }}>USDM</span>
        </p>
        <p style={{ margin: "6px 0 0", color: "#74748C", fontSize: 12 }}>Grows with every wager · paid out to winners</p>
      </motion.div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { val: totalDisplay, label: "Total Games", color: "#C5C5D8" },
          { val: Math.max(localWins, entries.find(e => e.isYou)?.wins ?? 0), label: "Your Wins", color: "#FF5C8A" },
        ].map(({ val, label, color }, i) => (
          <motion.div key={label} initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35, delay: 0.1 + i * 0.09, ease: [0.22, 1, 0.36, 1] }}
            style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: 14, textAlign: "center" }}>
            <p style={{ margin: 0, fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 22, color }}>{val}</p>
            <p style={{ margin: "2px 0 0", color: "#74748C", fontSize: 11, fontWeight: 600 }}>{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Leaderboard rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {scanning && entries.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: 28, color: "#74748C", fontSize: 14 }}>
            <span style={{ width: 18, height: 18, borderRadius: "50%", border: "2.5px solid rgba(139,124,255,.3)", borderTopColor: "#8B7CFF", animation: "spin .8s linear infinite", display: "inline-block" }} />
            Loading players…
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", color: "#4A4A5C", fontSize: 14 }}>No games played yet — be the first!</div>
        ) : (
          entries.map((p, idx) => {
            const top = idx < 3;
            return (
              <motion.div key={p.address} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.28, delay: idx * 0.055, ease: "easeOut" }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, background: p.isYou ? "rgba(139,124,255,.12)" : "rgba(255,255,255,.035)", border: `1px solid ${p.isYou ? "rgba(139,124,255,.38)" : "rgba(255,255,255,.07)"}` }}>
                <span style={{ width: 24, textAlign: "center", fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 15, color: top ? MEDAL_COLORS[idx] : "#4A4A5C" }}>{idx + 1}</span>
                <span style={{ width: 34, height: 34, borderRadius: "50%", background: p.isYou ? "linear-gradient(135deg,#8B7CFF,#5C6BFF)" : "rgba(255,255,255,.08)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                  {p.label[0].toUpperCase()}
                </span>
                <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14, color: p.isYou ? "#ECECF2" : "#9C9CB6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.label}
                </span>
                <span style={{ fontWeight: 700, fontSize: 13, color: p.isYou ? "#8B7CFF" : "#74748C" }}>
                  {p.wins} win{p.wins !== 1 ? "s" : ""}
                </span>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Info */}
      <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 16, padding: 14, fontSize: 12, color: "#74748C", lineHeight: 1.6 }}>
        <p style={{ margin: "0 0 6px", fontWeight: 700, color: "#9C9CB6" }}>How the pot grows</p>
        <p style={{ margin: "2px 0" }}>• 0.5% of every won wager → pool</p>
        <p style={{ margin: "2px 0" }}>• 100% of lost wagers (AI wins) → pool</p>
        <p style={{ margin: "2px 0" }}>• Anyone can donate via addToPrizePool</p>
      </div>
    </div>
  );
}
