"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { PADI_ADDRESS, PADI_ABI } from "@/lib/contracts";
import { boardSquareCoords, homeStretchCoords, PLAYER_COLORS } from "@/lib/ludo";

const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const PIECE_BASE: Record<number, [number, number][]> = {
  0: [[1,1],[2,1],[1,2],[2,2]],
  1: [[12,1],[13,1],[12,2],[13,2]],
  2: [[1,12],[2,12],[1,13],[2,13]],
  3: [[12,12],[13,12],[12,13],[13,13]],
};

const SEAT_LABELS = ["You", "AI 1", "AI 2", "AI 3"];

type Cell = { seat: number; pieceIdx: number };

function buildGrid(pieces: readonly (readonly number[])[], totalSeats: number): (Cell | null)[][] {
  const grid: (Cell | null)[][] = Array.from({ length: 15 }, () => Array(15).fill(null));
  for (let s = 0; s < totalSeats; s++) {
    for (let i = 0; i < 4; i++) {
      const pos = Number(pieces[s]?.[i] ?? 0);
      if (pos === 0) {
        const [col, row] = PIECE_BASE[s]?.[i] ?? [7, 7];
        if (grid[row][col] === null) grid[row][col] = { seat: s, pieceIdx: i };
      } else if (pos >= 1 && pos <= 52) {
        const [col, row] = boardSquareCoords(pos - 1);
        if (grid[row][col] === null) grid[row][col] = { seat: s, pieceIdx: i };
      } else if (pos >= 53 && pos <= 58) {
        const [col, row] = homeStretchCoords(s, pos - 52);
        if (grid[row][col] === null) grid[row][col] = { seat: s, pieceIdx: i };
      }
    }
  }
  return grid;
}

function canMovePiece(pos: number, dice: number): boolean {
  if (pos === 59) return false;
  if (pos === 0 && dice !== 6) return false;
  const newPos = pos === 0 ? 1 : pos + dice;
  if (pos > 52 && newPos > 59) return false;
  return true;
}

function BoardGrid({
  grid, canMove, dice, onMove, playerPieces
}: {
  grid: (Cell | null)[][];
  canMove: boolean;
  dice: number;
  onMove: (idx: number) => void;
  playerPieces: readonly number[];
}) {
  return (
    <div className="w-full aspect-square bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(15, 1fr)", gridTemplateRows: "repeat(15, 1fr)", width: "100%", height: "100%", gap: "1px" }}>
        {Array.from({ length: 15 }, (_, row) =>
          Array.from({ length: 15 }, (_, col) => {
            const cell = grid[row][col];
            const inR = row <= 4 && col <= 4, inG = row <= 4 && col >= 10;
            const inB = row >= 10 && col <= 4, inY = row >= 10 && col >= 10;
            const isCenter = row >= 6 && row <= 8 && col >= 6 && col <= 8;
            let bg = "bg-gray-800";
            if (isCenter) bg = "bg-gray-700";
            else if (inR) bg = "bg-red-950";
            else if (inG) bg = "bg-green-950";
            else if (inB) bg = "bg-blue-950";
            else if (inY) bg = "bg-yellow-950";
            const isSafe = (() => {
              for (const sq of SAFE) {
                if (sq === 0) continue;
                const [sc, sr] = boardSquareCoords(sq - 1);
                if (sc === col && sr === row) return true;
              }
              return false;
            })();
            const isMovable = canMove && cell?.seat === 0 && canMovePiece(Number(playerPieces[cell.pieceIdx] ?? 0), dice);
            return (
              <div key={`${row}-${col}`}
                className={`${bg} flex items-center justify-center ${isSafe ? "ring-1 ring-inset ring-yellow-600/30" : ""} ${isMovable ? "ring-2 ring-white/40" : ""}`}>
                {cell && (
                  <button
                    onClick={() => isMovable && onMove(cell.pieceIdx)}
                    className={`w-full h-full flex items-center justify-center ${isMovable ? "animate-pulse" : ""}`}
                    style={{ backgroundColor: PLAYER_COLORS[cell.seat] + "cc" }}>
                    <span className="text-[6px] font-bold text-white">{cell.pieceIdx + 1}</span>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function GameBoard({ gameId, onBack }: { gameId: bigint | null; onBack: () => void }) {
  const { address } = useAccount();
  const contract = PADI_ADDRESS;

  const { data: game, refetch } = useReadContract({
    address: contract, abi: PADI_ABI, functionName: "getGame",
    args: gameId !== null ? [gameId] : undefined,
    query: { refetchInterval: 3000 },
  });

  const { writeContract: roll, data: rollTx } = useWriteContract();
  const { writeContract: move, data: moveTx } = useWriteContract();
  const { isLoading: rollPending } = useWaitForTransactionReceipt({ hash: rollTx });
  const { isLoading: movePending } = useWaitForTransactionReceipt({ hash: moveTx });
  const txPending = rollPending || movePending;

  if (!gameId) return (
    <div className="text-center py-12">
      <p className="text-gray-400 text-sm">No active game.</p>
      <button onClick={onBack} className="mt-3 text-red-400 text-sm">← Go to Lobby</button>
    </div>
  );

  if (!game) return <div className="text-center py-12 text-gray-500 text-sm">Loading game...</div>;

  const [, pieces, aiCount, currentSeat, lastDice, diceRolled, state, wager, winner] = game as [
    `0x${string}`, readonly (readonly number[])[], number, number, number, boolean, number, bigint, `0x${string}`
  ];

  const isMyTurn = currentSeat === 0 && state === 0;
  const canRoll = isMyTurn && !diceRolled && !txPending;
  const canMove = isMyTurn && diceRolled && !txPending;
  const totalSeats = 1 + aiCount;
  const grid = buildGrid(pieces, totalSeats);
  const playerPieces = pieces[0] ?? [];

  function doRoll() {
    roll({ address: contract, abi: PADI_ABI, functionName: "rollDice", args: [gameId!] });
    setTimeout(() => refetch(), 2500);
  }

  function doMove(pieceIdx: number) {
    move({ address: contract, abi: PADI_ABI, functionName: "movePiece", args: [gameId!, pieceIdx] });
    setTimeout(() => refetch(), 3500);
  }

  const statusMsg = txPending
    ? "Transaction pending..."
    : state === 1
    ? winner && winner !== "0x0000000000000000000000000000000000000000"
      ? winner.toLowerCase() === address?.toLowerCase() ? "You won!" : "AI won"
      : "Game Over"
    : isMyTurn
    ? canRoll ? "Your turn — roll!" : `Rolled ${lastDice} — pick a piece`
    : `AI ${currentSeat} is moving...`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-xs text-gray-500">← Back</button>
        <span className="text-xs text-gray-600 font-mono">Game #{gameId.toString()}</span>
      </div>

      <div className="flex justify-between items-center">
        <p className={`text-sm font-medium ${txPending ? "text-yellow-400 animate-pulse" : "text-white"}`}>{statusMsg}</p>
        {wager > 0n && <p className="text-xs text-yellow-400">🏆 {(Number(wager) / 1e18).toFixed(2)} USDM</p>}
      </div>

      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: totalSeats }, (_, s) => (
          <div key={s} className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAYER_COLORS[s] }} />
            <span className={s === currentSeat && state === 0 ? "text-white font-bold" : "text-gray-400"}>{SEAT_LABELS[s]}</span>
          </div>
        ))}
      </div>

      <BoardGrid grid={grid} canMove={canMove} dice={lastDice} onMove={doMove} playerPieces={playerPieces} />

      <div className="flex gap-3">
        <div className="flex-1 bg-gray-900 rounded-xl p-3 text-center">
          <p className="text-3xl font-bold">{lastDice || "—"}</p>
          <p className="text-xs text-gray-500 mt-0.5">dice</p>
        </div>
        <button onClick={doRoll} disabled={!canRoll}
          className={`flex-1 rounded-xl font-bold text-sm transition-all ${canRoll ? "bg-red-600 hover:bg-red-500 text-white" : "bg-gray-800 text-gray-600 cursor-not-allowed"}`}>
          {txPending ? "⏳ Pending..." : canRoll ? "🎲 Roll" : currentSeat !== 0 ? "AI moving..." : "Pick piece"}
        </button>
      </div>

      {canMove && (
        <div className="bg-gray-900 rounded-xl p-3">
          <p className="text-xs text-gray-400 mb-2">Your pieces</p>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }, (_, i) => {
              const pos = Number(playerPieces[i] ?? 0);
              const movable = canMovePiece(pos, lastDice);
              return (
                <button key={i} onClick={() => movable && doMove(i)} disabled={!movable}
                  className={`py-2.5 rounded-lg text-sm font-bold text-white transition-colors ${movable ? "bg-red-700 hover:bg-red-600 ring-1 ring-red-400" : "bg-gray-800 text-gray-600 cursor-not-allowed"}`}>
                  {pos === 0 ? "⌂" : pos === 59 ? "✓" : pos}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {state === 1 && (
        <div className={`rounded-xl p-4 text-center border ${
          winner && winner !== "0x0000000000000000000000000000000000000000" && winner.toLowerCase() === address?.toLowerCase()
            ? "bg-green-900/30 border-green-600" : "bg-gray-900 border-gray-700"
        }`}>
          <p className="font-bold text-lg">
            {winner && winner !== "0x0000000000000000000000000000000000000000"
              ? winner.toLowerCase() === address?.toLowerCase() ? "You won! 🎉" : "AI won this time"
              : "Game Over"}
          </p>
          {wager > 0n && winner?.toLowerCase() === address?.toLowerCase() && (
            <p className="text-green-400 text-sm mt-1">{(Number(wager) * 0.99 / 1e18).toFixed(4)} USDM returned</p>
          )}
          <button onClick={onBack} className="mt-3 text-sm text-gray-400 hover:text-white">Play again →</button>
        </div>
      )}
    </div>
  );
}
