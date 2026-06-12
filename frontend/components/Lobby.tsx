"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits } from "viem";
import { PADI_ADDRESS, PADI_ABI, ERC20_ABI, USDM_ADDRESS } from "@/lib/contracts";

const MIN_WAGER = 0.01;

export default function Lobby({ onEnterGame }: { onEnterGame: (gameId: bigint) => void }) {
  const { address } = useAccount();
  const contract = PADI_ADDRESS;

  const [aiCount, setAiCount] = useState(1);
  const [wager, setWager] = useState("");
  const [wagerError, setWagerError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingWager, setPendingWager] = useState(0n);

  const { data: prizePool } = useReadContract({ address: contract, abi: PADI_ABI, functionName: "weeklyPrizePool" });
  const { data: totalGamesCount } = useReadContract({ address: contract, abi: PADI_ABI, functionName: "totalGames" });
  const { data: myGames } = useReadContract({ address: contract, abi: PADI_ABI, functionName: "getPlayerGames", args: address ? [address] : undefined });
  const { data: wins } = useReadContract({ address: contract, abi: PADI_ABI, functionName: "totalWins", args: address ? [address] : undefined });

  const { writeContract: approve, data: approveTx } = useWriteContract();
  const { writeContract: create, data: createTx } = useWriteContract();
  const { isSuccess: approveOk, isLoading: approving } = useWaitForTransactionReceipt({ hash: approveTx });
  const { isSuccess: createOk, isLoading: creating, data: createReceipt } = useWaitForTransactionReceipt({ hash: createTx });

  const wagerNum = parseFloat(wager) || 0;
  const wagerBN = wagerNum > 0 ? parseUnits(wagerNum.toFixed(18), 18) : 0n;
  const busy = approving || creating;

  function validateWager(val: string) {
    const n = parseFloat(val);
    if (val && (isNaN(n) || n < 0)) setWagerError("Enter a valid amount");
    else if (n > 0 && n < MIN_WAGER) setWagerError(`Minimum ${MIN_WAGER} USDM`);
    else setWagerError(null);
  }

  function handleCreate() {
    if (wagerError) return;
    if (wagerBN > 0n) {
      setPendingWager(wagerBN);
      setStatus("Approving USDM...");
      approve({ address: USDM_ADDRESS as `0x${string}`, abi: ERC20_ABI, functionName: "approve", args: [contract, wagerBN] });
    } else {
      setStatus("Creating game...");
      create({ address: contract, abi: PADI_ABI, functionName: "createGame", args: [aiCount, 0n] });
    }
  }

  // After approval succeeds, create the game with the pending wager
  useEffect(() => {
    if (approveOk && pendingWager > 0n && !createTx) {
      setStatus("Creating game...");
      create({ address: contract, abi: PADI_ABI, functionName: "createGame", args: [aiCount, pendingWager] });
    }
  }, [approveOk]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate into game once created
  useEffect(() => {
    if (createOk && createReceipt) {
      const log = createReceipt.logs[0];
      if (log) { try { onEnterGame(BigInt(log.topics[1] || "0")); } catch { /* */ } }
    }
  }, [createOk, createReceipt]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-900 rounded-2xl p-3 text-center">
          <p className="text-[10px] text-gray-500 mb-1">Prize Pool</p>
          <p className="text-base font-bold text-yellow-400">{prizePool ? (Number(prizePool) / 1e18).toFixed(1) : "0"} USDM</p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-3 text-center">
          <p className="text-[10px] text-gray-500 mb-1">Your Wins</p>
          <p className="text-base font-bold text-red-400">{wins?.toString() ?? "0"}</p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-3 text-center">
          <p className="text-[10px] text-gray-500 mb-1">All Games</p>
          <p className="text-base font-bold text-gray-300">{totalGamesCount?.toString() ?? "0"}</p>
        </div>
      </div>

      <div className="bg-gray-900 rounded-2xl p-4 space-y-4">
        <p className="font-semibold text-white">New Game vs AI</p>

        <div>
          <p className="text-xs text-gray-400 mb-2">AI opponents</p>
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
          <p className="text-xs text-gray-400 mb-1">Wager (USDM) — optional</p>
          <input
            value={wager}
            onChange={e => { setWager(e.target.value); validateWager(e.target.value); }}
            placeholder="0 = free to play"
            type="number" min="0" step="0.01" inputMode="decimal"
            className={`w-full bg-gray-800 border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500 ${wagerError ? "border-red-500" : "border-gray-700"}`}
          />
          {wagerError
            ? <p className="text-xs text-red-400 mt-1">{wagerError}</p>
            : <p className="text-xs text-gray-600 mt-1">Win 99% back if you beat all AI</p>
          }
        </div>

        {status && <p className="text-xs text-yellow-400 animate-pulse">{status}</p>}

        <button onClick={handleCreate} disabled={busy || !!wagerError}
          className="w-full py-3.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl font-bold transition-colors">
          {busy ? (status ?? "Working...") : "🎲 Start Game"}
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
