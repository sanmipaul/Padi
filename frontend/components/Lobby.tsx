"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { PADI_ADDRESS, PADI_ABI, ERC20_ABI, USDM_ADDRESS } from "@/lib/contracts";

export default function Lobby({ onEnterGame }: { onEnterGame: (gameId: bigint) => void }) {
  const { address } = useAccount();
  const contract = PADI_ADDRESS;

  const [aiCount, setAiCount] = useState(1);
  const [wager, setWager] = useState("0");

  const { data: prizePool } = useReadContract({ address: contract, abi: PADI_ABI, functionName: "weeklyPrizePool" });
  const { data: myGames } = useReadContract({ address: contract, abi: PADI_ABI, functionName: "getPlayerGames", args: address ? [address] : undefined });
  const { data: wins } = useReadContract({ address: contract, abi: PADI_ABI, functionName: "totalWins", args: address ? [address] : undefined });

  const { writeContract: approve, data: approveTx } = useWriteContract();
  const { writeContract: create, data: createTx } = useWriteContract();
  const { isSuccess: approveOk } = useWaitForTransactionReceipt({ hash: approveTx });
  const { isSuccess: createOk, data: createReceipt } = useWaitForTransactionReceipt({ hash: createTx });

  const wagerBN = wager && Number(wager) > 0 ? parseUnits(wager, 18) : 0n;

  function handleCreate() {
    if (wagerBN > 0n) {
      approve({ address: USDM_ADDRESS as `0x${string}`, abi: ERC20_ABI, functionName: "approve", args: [contract, wagerBN] });
    } else {
      create({ address: contract, abi: PADI_ABI, functionName: "createGame", args: [aiCount, 0n] });
    }
  }

  if (approveOk) {
    create({ address: contract, abi: PADI_ABI, functionName: "createGame", args: [aiCount, wagerBN] });
  }

  if (createOk && createReceipt) {
    const log = createReceipt.logs[0];
    if (log) { try { onEnterGame(BigInt(log.topics[1] || "0")); } catch { /* */ } }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="flex-1 bg-gray-900 rounded-2xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Weekly Pool</p>
          <p className="text-xl font-bold text-yellow-400">{prizePool ? (Number(prizePool) / 1e18).toFixed(2) : "0.00"} USDM</p>
        </div>
        <div className="flex-1 bg-gray-900 rounded-2xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Your Wins</p>
          <p className="text-xl font-bold text-red-400">{wins?.toString() ?? "0"}</p>
        </div>
      </div>

      <div className="bg-gray-900 rounded-2xl p-4 space-y-4">
        <p className="font-semibold text-white">New Game vs AI</p>

        <div>
          <p className="text-xs text-gray-400 mb-2">Number of AI opponents</p>
          <div className="flex gap-2">
            {[1, 2, 3].map((n) => (
              <button key={n} onClick={() => setAiCount(n)}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl border transition-colors ${aiCount === n ? "border-red-500 bg-red-900/40 text-red-400" : "border-gray-700 text-gray-400"}`}>
                {n} AI
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-400 mb-1">Optional wager (USDM)</p>
          <input value={wager} onChange={e => setWager(e.target.value)} placeholder="0 = free to play" type="number" min="0"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500" />
          <p className="text-xs text-gray-600 mt-1">Win back your wager (minus 1% fee) if you beat all AI</p>
        </div>

        <button onClick={handleCreate} className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-colors">
          🎲 Start Game
        </button>
      </div>

      {myGames && myGames.length > 0 && (
        <div className="bg-gray-900 rounded-2xl p-4">
          <p className="text-xs text-gray-400 mb-3">Continue a Game</p>
          <div className="flex flex-wrap gap-2">
            {[...myGames].reverse().slice(0, 6).map((id) => (
              <button key={id.toString()} onClick={() => onEnterGame(id)}
                className="px-3 py-1.5 bg-gray-800 text-sm text-gray-300 rounded-lg hover:bg-gray-700">
                Game #{id.toString()}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
