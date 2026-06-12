"use client";

import { useAccount, useReadContract } from "wagmi";
import { PADI_ADDRESS, PADI_ABI } from "@/lib/contracts";

const TOP = [
  "0x0000000000000000000000000000000000000001",
  "0x0000000000000000000000000000000000000002",
  "0x0000000000000000000000000000000000000003",
];

export default function Leaderboard() {
  const { address } = useAccount();
  const contract = PADI_ADDRESS;

  const { data: prize } = useReadContract({ address: contract, abi: PADI_ABI, functionName: "weeklyPrizePool" });
  const { data: myWins } = useReadContract({ address: contract, abi: PADI_ABI, functionName: "totalWins", args: address ? [address] : undefined });

  const wins = TOP.map(addr =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useReadContract({ address: contract, abi: PADI_ABI, functionName: "totalWins", args: [addr as `0x${string}`] })
  );
  const rows = TOP.map((addr, i) => ({ addr, wins: wins[i]?.data ? Number(wins[i].data) : 0 })).sort((a, b) => b.wins - a.wins);
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-4">
      <div className="bg-yellow-900/20 border border-yellow-700 rounded-2xl p-4 text-center">
        <p className="text-xs text-yellow-500 uppercase tracking-wide mb-1">Weekly Prize Pool</p>
        <p className="text-3xl font-bold text-yellow-400">{prize ? (Number(prize) / 1e18).toFixed(2) : "0.00"} USDM</p>
        <p className="text-xs text-gray-400 mt-1">Top players at week's end share this</p>
      </div>

      {address && (
        <div className="bg-gray-900 rounded-2xl p-4 text-center">
          <p className="text-xs text-gray-500">Your wins vs AI</p>
          <p className="text-2xl font-bold text-red-400">{myWins?.toString() ?? "0"}</p>
        </div>
      )}

      <div className="bg-gray-900 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <p className="text-sm font-semibold text-white">All-Time Leaderboard</p>
        </div>
        {rows.every(r => r.wins === 0) ? (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">No wins recorded yet. Be the first!</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {rows.map(({ addr, wins }, i) => (
              <div key={addr} className="flex items-center gap-3 px-4 py-3">
                <span className="text-lg">{medals[i]}</span>
                <p className="flex-1 text-sm font-mono text-gray-300">{addr.slice(0, 6)}…{addr.slice(-4)}</p>
                <p className="text-white font-bold">{wins} <span className="text-xs text-gray-400">wins</span></p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
