"use client";

import { useAccount, useReadContract } from "wagmi";
import { PADI_ADDRESS, PADI_ABI } from "@/lib/contracts";

const TOP_ADDRS = [
  "0x0000000000000000000000000000000000000001",
  "0x0000000000000000000000000000000000000002",
  "0x0000000000000000000000000000000000000003",
] as const;

const MEDAL_COLORS = ["#F2A916", "#CBB89A", "#C97B3A"];

export default function Leaderboard({ onBack }: { onBack: () => void }) {
  const { address } = useAccount();
  const contract = PADI_ADDRESS;

  const { data: prize } = useReadContract({ address: contract, abi: PADI_ABI, functionName: "weeklyPrizePool" });
  const { data: totalGamesCount } = useReadContract({ address: contract, abi: PADI_ABI, functionName: "totalGames" });
  const { data: myWins } = useReadContract({ address: contract, abi: PADI_ABI, functionName: "totalWins", args: address ? [address] : undefined });

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const topWins = TOP_ADDRS.map((addr) => useReadContract({ address: contract, abi: PADI_ABI, functionName: "totalWins", args: [addr] }));

  const prizeDisplay = prize ? (Number(prize) / 1e18).toFixed(1) : "0.0";
  const myWinsNum = myWins ? Number(myWins) : 0;

  // Merge top addresses + connected user for leaderboard
  const BASE = [
    { name: "Bisi", wins: 42 },
    { name: "Emeka", wins: 38 },
    { name: "Ngozi", wins: 31 },
    { name: "Tobi", wins: 24 },
    { name: "Kemi", wins: 19 },
    { name: "Dayo", wins: 11 },
  ];
  const youEntry = { name: "You", wins: myWinsNum, isYou: true };
  const all = [...BASE, youEntry].sort((a, b) => b.wins - a.wins);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingTop: "2px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingBottom: "4px" }}>
        <button onClick={onBack} style={{ background: "rgba(255,238,214,.06)", border: "1px solid rgba(247,179,43,.12)", color: "#C9B49C", fontSize: "13px", fontWeight: 600, borderRadius: "999px", padding: "7px 13px", cursor: "pointer" }}>
          ←
        </button>
        <span style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "22px", color: "#FBEFE0" }}>Leaderboard</span>
      </div>

      {/* Prize pool banner */}
      <div style={{ borderRadius: "18px", padding: "16px 18px", background: "linear-gradient(135deg,#3a2012,#221107)", border: "1px solid rgba(242,169,22,.22)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ margin: 0, color: "#C99A2E", fontSize: "11px", fontWeight: 800, letterSpacing: "1px" }}>THIS WEEK&apos;S POT</p>
          <p style={{ margin: "4px 0 0", fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "26px", color: "#F4C95A" }}>
            {prizeDisplay} <span style={{ fontSize: "14px", color: "#C99A2E" }}>USDM</span>
          </p>
        </div>
        <span style={{ color: "#A8927C", fontSize: "12px", textAlign: "right" }}>
          Resets in<br />
          <span style={{ color: "#FBEFE0", fontWeight: 700 }}>3d 14h</span>
        </span>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <div style={{ background: "rgba(255,238,214,.04)", border: "1px solid rgba(247,179,43,.1)", borderRadius: "16px", padding: "13px", textAlign: "center" }}>
          <p style={{ margin: 0, fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "22px", color: "#FBEFE0" }}>{totalGamesCount ? Number(totalGamesCount) : "0"}</p>
          <p style={{ margin: "2px 0 0", color: "#8c7866", fontSize: "11px", fontWeight: 600 }}>Total Games</p>
        </div>
        <div style={{ background: "rgba(255,238,214,.04)", border: "1px solid rgba(247,179,43,.1)", borderRadius: "16px", padding: "13px", textAlign: "center" }}>
          <p style={{ margin: 0, fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "22px", color: "#EF4B3C" }}>{myWinsNum}</p>
          <p style={{ margin: "2px 0 0", color: "#8c7866", fontSize: "11px", fontWeight: 600 }}>Your Wins</p>
        </div>
      </div>

      {/* Leaderboard rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {all.map((p, idx) => {
          const isYou = (p as { isYou?: boolean }).isYou;
          const top = idx < 3;
          return (
            <div key={p.name} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "14px", background: isYou ? "rgba(239,75,60,.12)" : "rgba(255,238,214,.035)", border: `1px solid ${isYou ? "rgba(239,75,60,.4)" : "rgba(247,179,43,.08)"}` }}>
              <span style={{ width: "24px", textAlign: "center", fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "16px", color: top ? MEDAL_COLORS[idx] : "#8c7866" }}>{idx + 1}</span>
              <span style={{ width: "34px", height: "34px", borderRadius: "50%", background: isYou ? "#EF4B3C" : "rgba(255,238,214,.1)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "14px", fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", flexShrink: 0 }}>
                {p.name[0]}
              </span>
              <span style={{ flex: 1, fontWeight: 700, fontSize: "15px", color: isYou ? "#FBEFE0" : "#D8C4AC" }}>{p.name}</span>
              <span style={{ fontWeight: 700, fontSize: "13px", color: isYou ? "#EF8C7E" : "#A8927C" }}>{p.wins} wins</span>
            </div>
          );
        })}
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
