#!/bin/bash
set -e

export GIT_AUTHOR_NAME="sanmipaul"
export GIT_AUTHOR_EMAIL="sanmipaul1@gmail.com"
export GIT_COMMITTER_NAME="sanmipaul"
export GIT_COMMITTER_EMAIL="sanmipaul1@gmail.com"

commit() {
  git add -A
  git commit -m "$1"
}

# ─── Commit 34: Leaderboard — add totalGames display ─────────────────────────
cat > frontend/components/Leaderboard.tsx << 'TSEOF'
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
  const { data: totalGamesCount } = useReadContract({ address: contract, abi: PADI_ABI, functionName: "totalGames" });
  const { data: myWins } = useReadContract({
    address: contract, abi: PADI_ABI, functionName: "totalWins",
    args: address ? [address] : undefined,
  });

  const wins = TOP.map(addr =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useReadContract({ address: contract, abi: PADI_ABI, functionName: "totalWins", args: [addr as `0x${string}`] })
  );
  const rows = TOP.map((addr, i) => ({ addr, wins: wins[i]?.data ? Number(wins[i].data) : 0 })).sort((a, b) => b.wins - a.wins);
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-4">
      {/* Prize pool banner */}
      <div className="bg-yellow-900/20 border border-yellow-700 rounded-2xl p-4 text-center">
        <p className="text-xs text-yellow-500 uppercase tracking-wide mb-1">Weekly Prize Pool</p>
        <p className="text-3xl font-bold text-yellow-400">
          {prize ? (Number(prize) / 1e18).toFixed(2) : "0.00"} USDM
        </p>
        <p className="text-xs text-gray-400 mt-1">Top players at week's end share this</p>
      </div>

      {/* Global stats */}
      <div className="bg-gray-900 rounded-2xl p-4 text-center">
        <p className="text-xs text-gray-500 mb-1">Total Games Played</p>
        <p className="text-2xl font-bold text-gray-300">{totalGamesCount?.toString() ?? "0"}</p>
      </div>

      {/* My stats */}
      {address && (
        <div className="bg-gray-900 rounded-2xl p-4 text-center">
          <p className="text-xs text-gray-500">Your wins vs AI</p>
          <p className="text-2xl font-bold text-red-400">{myWins?.toString() ?? "0"}</p>
        </div>
      )}

      {/* Top players */}
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
TSEOF
commit "Leaderboard.tsx: add totalGames display, split stats into separate cards"

# ─── Commit 35: tailwind — add dark mode config ───────────────────────────────
cat > frontend/tailwind.config.ts << 'TSEOF'
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["system-ui", "-apple-system", "sans-serif"],
        mono: ["ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
TSEOF
commit "tailwind.config.ts: enable dark mode class, add system font stacks"

# ─── Commit 36: globals.css — add mobile scrollbar and focus styles ───────────
cat > frontend/app/globals.css << 'CSSEOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-gray-950 text-white;
  -webkit-font-smoothing: antialiased;
}

/* Hide scrollbar on mobile game board */
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

/* Tap highlight removal for game buttons */
button { -webkit-tap-highlight-color: transparent; }
CSSEOF
commit "globals.css: add antialiasing, hide mobile scrollbar, remove tap highlight"

# ─── Commit 37: layout.tsx — add viewport meta for MiniPay ───────────────────
cat > frontend/app/layout.tsx << 'TSEOF'
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Padi",
  description: "On-chain Ludo vs AI. Roll with your padi on Celo.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
TSEOF
commit "layout.tsx: add viewport meta to prevent zoom, set dark class on html"

# ─── Commit 38: next.config.ts — add webpack fallbacks for viem ──────────────
cat > frontend/next.config.ts << 'TSEOF'
import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  webpack: (cfg) => {
    cfg.resolve.fallback = { fs: false, net: false, tls: false };
    return cfg;
  },
};

export default config;
TSEOF
commit "next.config.ts: add webpack fallbacks for Node builtins (viem compatibility)"

# ─── Commit 39: README rewrite for single-player and USDM ────────────────────
cat > README.md << 'MDEOF'
# Padi

On-chain Ludo vs AI for MiniPay on Celo. "Padi" is Nigerian Pidgin for "friend."

## What it is

A fully on-chain single-player Ludo game. You play against 1, 2, or 3 AI opponents. No waiting for other players. No servers. Every dice roll and AI move happens in the same transaction as your move.

## Token

Uses **USDM** (`0x765DE816845861e75A25fCA122bb6898B8B1282a`) on Celo mainnet. Free to play — optional wager for higher stakes.

## Stack

- **Frontend**: Next.js 14, TailwindCSS, wagmi v2, viem
- **Contracts**: Solidity 0.8.20, Hardhat, OpenZeppelin
- **Chain**: Celo mainnet (chainId 42220)

## Game Rules

- Each player (you + 1-3 AIs) has 4 pieces, all starting at base
- Roll a 6 to bring a piece onto the board
- First to get all 4 pieces to position 59 (home) wins
- Landing on an opponent sends them back to base (except on safe squares)
- Safe squares: positions 0, 8, 13, 21, 26, 34, 39, 47

## AI Strategy

AI opponents run entirely on-chain in the same transaction as your move:
- Greedy capture-first: AI prioritises landing on your pieces
- If no capture available, advances the furthest piece
- Uses `keccak256(block.prevrandao, gameId, nonce)` for dice rolls

## Wager

- Free to play by default (no deposit needed)
- Optional USDM wager — must approve before creating the game
- If you win: 99% returned, 0.5% to weekly prize pool, 0.5% platform fee
- If AI wins: full wager to weekly prize pool

## Project Structure

```
padi/
├── contracts/
│   ├── contracts/Padi.sol      # Full on-chain game + AI
│   └── scripts/deploy.ts
└── frontend/
    ├── app/
    ├── components/
    │   ├── Lobby.tsx
    │   ├── GameBoard.tsx
    │   └── Leaderboard.tsx
    └── lib/
        ├── wagmi.ts
        ├── contracts.ts
        └── ludo.ts
```

## Setup

```bash
# 1. Deploy contract
cd contracts
npm install
npx hardhat run scripts/deploy.ts --network celo

# 2. Update address
# Set PADI_ADDRESS in frontend/lib/contracts.ts

# 3. Run frontend
cd ../frontend
npm install
npm run dev
```

## MiniPay Integration

- Auto-connects wallet via `window.ethereum` injected by MiniPay
- No connect button needed
- Mainnet only (chainId 42220)
MDEOF
commit "README: rewrite for single-player model, USDM, mainnet-only, AI strategy docs"

# ─── Commit 40: add contracts .env.example ────────────────────────────────────
cat > contracts/.env.example << 'ENVEOF'
# Copy to .env and fill in your deployer private key
PRIVATE_KEY=0x
CELOSCAN_API_KEY=
ENVEOF
commit "contracts: add .env.example for deployment keys"

# ─── Commit 41: hardhat.config — add celoscan verify ─────────────────────────
cat > contracts/hardhat.config.ts << 'TSEOF'
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "0x" + "0".repeat(64);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    celo: {
      url: "https://forno.celo.org",
      chainId: 42220,
      accounts: [PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      celo: process.env.CELOSCAN_API_KEY ?? "",
    },
    customChains: [
      {
        network: "celo",
        chainId: 42220,
        urls: {
          apiURL: "https://api.celoscan.io/api",
          browserURL: "https://celoscan.io",
        },
      },
    ],
  },
};

export default config;
TSEOF
commit "hardhat.config.ts: add Celoscan verify config and optimizer settings"

# ─── Commit 42: GameBoard — extract BoardGrid component ──────────────────────
# Refactor: move board rendering into a separate sub-component inside file
cat > frontend/components/GameBoard.tsx << 'TSEOF'
"use client";

import { useAccount, useReadContract, useWriteContract } from "wagmi";
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

function buildGrid(
  pieces: readonly (readonly number[])[],
  totalSeats: number
): (Cell | null)[][] {
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

function BoardGrid({
  grid,
  canMove,
  onMove,
}: {
  grid: (Cell | null)[][];
  canMove: boolean;
  onMove: (pieceIdx: number) => void;
}) {
  return (
    <div className="w-full aspect-square bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(15, 1fr)", gridTemplateRows: "repeat(15, 1fr)", width: "100%", height: "100%", gap: "1px" }}>
        {Array.from({ length: 15 }, (_, row) =>
          Array.from({ length: 15 }, (_, col) => {
            const cell = grid[row][col];
            const inR = row <= 4 && col <= 4;
            const inG = row <= 4 && col >= 10;
            const inB = row >= 10 && col <= 4;
            const inY = row >= 10 && col >= 10;
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

            return (
              <div key={`${row}-${col}`}
                className={`${bg} flex items-center justify-center ${isSafe ? "ring-1 ring-inset ring-yellow-600/30" : ""}`}>
                {cell && (
                  <button
                    onClick={() => canMove && cell.seat === 0 && onMove(cell.pieceIdx)}
                    className="w-full h-full flex items-center justify-center"
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

  const { writeContract: roll } = useWriteContract();
  const { writeContract: move } = useWriteContract();

  if (!gameId) return (
    <div className="text-center py-12">
      <p className="text-gray-400 text-sm">No active game.</p>
      <button onClick={onBack} className="mt-3 text-red-400 text-sm">← Go to Lobby</button>
    </div>
  );

  if (!game) return <div className="text-center py-12 text-gray-500 text-sm">Loading game...</div>;

  const [, pieces, aiCount, currentSeat, lastDice, diceRolled, state, wager, winner] = game as [
    `0x${string}`,
    readonly (readonly number[])[],
    number, number, number, boolean, number, bigint, `0x${string}`
  ];

  const isMyTurn = currentSeat === 0 && state === 0;
  const canRoll = isMyTurn && !diceRolled;
  const canMove = isMyTurn && diceRolled;
  const totalSeats = 1 + aiCount;
  const grid = buildGrid(pieces, totalSeats);

  function doRoll() {
    roll({ address: contract, abi: PADI_ABI, functionName: "rollDice", args: [gameId!] });
    setTimeout(() => refetch(), 2000);
  }

  function doMove(pieceIdx: number) {
    move({ address: contract, abi: PADI_ABI, functionName: "movePiece", args: [gameId!, pieceIdx] });
    setTimeout(() => refetch(), 3000);
  }

  const statusMsg = state === 1
    ? winner && winner !== "0x0000000000000000000000000000000000000000"
      ? winner.toLowerCase() === address?.toLowerCase() ? "You won!" : "AI won"
      : "Game Over"
    : isMyTurn
    ? canRoll ? "Your turn — roll the dice!" : `Rolled ${lastDice} — pick a piece`
    : `AI ${currentSeat} is thinking...`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-xs text-gray-500">← Back</button>
        <span className="text-xs text-gray-600 font-mono">Game #{gameId.toString()}</span>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm font-medium text-white">{statusMsg}</p>
        {wager > 0n && <p className="text-xs text-yellow-400">🏆 {(Number(wager) / 1e18).toFixed(2)} USDM</p>}
      </div>

      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: totalSeats }, (_, s) => (
          <div key={s} className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAYER_COLORS[s] }} />
            <span className={s === currentSeat && state === 0 ? "text-white font-bold" : "text-gray-400"}>
              {SEAT_LABELS[s]}
            </span>
          </div>
        ))}
      </div>

      <BoardGrid grid={grid} canMove={canMove} onMove={doMove} />

      <div className="flex gap-3">
        <div className="flex-1 bg-gray-900 rounded-xl p-3 text-center">
          <p className="text-3xl font-bold">{lastDice || "—"}</p>
          <p className="text-xs text-gray-500 mt-0.5">dice</p>
        </div>
        <button onClick={doRoll} disabled={!canRoll}
          className={`flex-1 rounded-xl font-bold text-sm transition-all ${canRoll ? "bg-red-600 hover:bg-red-500 text-white" : "bg-gray-800 text-gray-600 cursor-not-allowed"}`}>
          {canRoll ? "🎲 Roll" : currentSeat !== 0 ? "AI moving..." : "Pick piece"}
        </button>
      </div>

      {canMove && (
        <div className="bg-gray-900 rounded-xl p-3">
          <p className="text-xs text-gray-400 mb-2">Your pieces — tap to move</p>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }, (_, i) => {
              const pos = Number(pieces[0]?.[i] ?? 0);
              const canMovePiece = pos !== 59 && (pos !== 0 || lastDice === 6);
              return (
                <button key={i} onClick={() => canMovePiece && doMove(i)}
                  disabled={!canMovePiece}
                  className={`py-2.5 rounded-lg text-sm font-bold text-white transition-colors ${
                    canMovePiece ? "bg-red-700 hover:bg-red-600" : "bg-gray-800 text-gray-600 cursor-not-allowed"
                  }`}>
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
            ? "bg-green-900/30 border-green-600"
            : "bg-gray-900 border-gray-700"
        }`}>
          <p className="font-bold text-lg">
            {winner && winner !== "0x0000000000000000000000000000000000000000"
              ? winner.toLowerCase() === address?.toLowerCase() ? "You won! 🎉" : "AI won this time"
              : "Game Over"}
          </p>
          {wager > 0n && winner?.toLowerCase() === address?.toLowerCase() && (
            <p className="text-green-400 text-sm mt-1">
              {(Number(wager) * 0.99 / 1e18).toFixed(4)} USDM returned to your wallet
            </p>
          )}
          <button onClick={onBack} className="mt-3 text-sm text-gray-400 hover:text-white">
            Play again →
          </button>
        </div>
      )}
    </div>
  );
}
TSEOF
commit "GameBoard.tsx: extract BoardGrid sub-component and buildGrid helper function"

# ─── Commit 43: Lobby — add game count from contract ─────────────────────────
cat > frontend/components/Lobby.tsx << 'TSEOF'
"use client";

import { useState } from "react";
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

  const { data: prizePool } = useReadContract({ address: contract, abi: PADI_ABI, functionName: "weeklyPrizePool" });
  const { data: totalGamesCount } = useReadContract({ address: contract, abi: PADI_ABI, functionName: "totalGames" });
  const { data: myGames } = useReadContract({
    address: contract, abi: PADI_ABI, functionName: "getPlayerGames",
    args: address ? [address] : undefined,
  });
  const { data: wins } = useReadContract({
    address: contract, abi: PADI_ABI, functionName: "totalWins",
    args: address ? [address] : undefined,
  });

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
    else if (n > 0 && n < MIN_WAGER) setWagerError(`Minimum wager is ${MIN_WAGER} USDM`);
    else setWagerError(null);
  }

  function handleCreate() {
    if (wagerError) return;
    if (wagerBN > 0n) {
      setStatus("Approving USDM...");
      approve({ address: USDM_ADDRESS as `0x${string}`, abi: ERC20_ABI, functionName: "approve", args: [contract, wagerBN] });
    } else {
      setStatus("Creating game...");
      create({ address: contract, abi: PADI_ABI, functionName: "createGame", args: [aiCount, 0n] });
    }
  }

  if (approveOk && !createTx) {
    setStatus("Creating game...");
    create({ address: contract, abi: PADI_ABI, functionName: "createGame", args: [aiCount, wagerBN] });
  }

  if (createOk && createReceipt) {
    const log = createReceipt.logs[0];
    if (log) { try { onEnterGame(BigInt(log.topics[1] || "0")); } catch { /* */ } }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-900 rounded-2xl p-3 text-center">
          <p className="text-[10px] text-gray-500 mb-1">Prize Pool</p>
          <p className="text-base font-bold text-yellow-400">
            {prizePool ? (Number(prizePool) / 1e18).toFixed(1) : "0"} USDM
          </p>
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
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl border transition-colors ${
                  aiCount === n ? "border-red-500 bg-red-900/40 text-red-400" : "border-gray-700 text-gray-400"
                }`}>
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
TSEOF
commit "Lobby.tsx: add total games counter, compact 3-col stats row"

# ─── Commit 44: GameBoard — add pending tx indicator ─────────────────────────
cat > frontend/components/GameBoard.tsx << 'TSEOF'
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

function BoardGrid({ grid, canMove, onMove }: { grid: (Cell | null)[][]; canMove: boolean; onMove: (idx: number) => void }) {
  return (
    <div className="w-full aspect-square bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(15, 1fr)", gridTemplateRows: "repeat(15, 1fr)", width: "100%", height: "100%", gap: "1px" }}>
        {Array.from({ length: 15 }, (_, row) =>
          Array.from({ length: 15 }, (_, col) => {
            const cell = grid[row][col];
            const inR = row <= 4 && col <= 4;
            const inG = row <= 4 && col >= 10;
            const inB = row >= 10 && col <= 4;
            const inY = row >= 10 && col >= 10;
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
            return (
              <div key={`${row}-${col}`}
                className={`${bg} flex items-center justify-center ${isSafe ? "ring-1 ring-inset ring-yellow-600/30" : ""}`}>
                {cell && (
                  <button onClick={() => canMove && cell.seat === 0 && onMove(cell.pieceIdx)}
                    className="w-full h-full flex items-center justify-center"
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
    ? canRoll ? "Your turn — roll the dice!" : `Rolled ${lastDice} — pick a piece`
    : `AI ${currentSeat} is thinking...`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-xs text-gray-500">← Back</button>
        <span className="text-xs text-gray-600 font-mono">Game #{gameId.toString()}</span>
      </div>

      <div className="flex justify-between items-center">
        <p className={`text-sm font-medium ${txPending ? "text-yellow-400 animate-pulse" : "text-white"}`}>
          {statusMsg}
        </p>
        {wager > 0n && <p className="text-xs text-yellow-400">🏆 {(Number(wager) / 1e18).toFixed(2)} USDM</p>}
      </div>

      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: totalSeats }, (_, s) => (
          <div key={s} className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAYER_COLORS[s] }} />
            <span className={s === currentSeat && state === 0 ? "text-white font-bold" : "text-gray-400"}>
              {SEAT_LABELS[s]}
            </span>
          </div>
        ))}
      </div>

      <BoardGrid grid={grid} canMove={canMove} onMove={doMove} />

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
          <p className="text-xs text-gray-400 mb-2">Your pieces — tap to move</p>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }, (_, i) => {
              const pos = Number(pieces[0]?.[i] ?? 0);
              const canMovePiece = pos !== 59 && (pos !== 0 || lastDice === 6);
              return (
                <button key={i} onClick={() => canMovePiece && doMove(i)} disabled={!canMovePiece}
                  className={`py-2.5 rounded-lg text-sm font-bold text-white transition-colors ${canMovePiece ? "bg-red-700 hover:bg-red-600" : "bg-gray-800 text-gray-600 cursor-not-allowed"}`}>
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
TSEOF
commit "GameBoard.tsx: add tx pending indicator, disable controls while tx in flight"

# ─── Commit 45: add .eslintrc ─────────────────────────────────────────────────
cat > frontend/.eslintrc.json << 'JSON'
{
  "extends": ["next/core-web-vitals"],
  "rules": {
    "react-hooks/exhaustive-deps": "warn",
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
  }
}
JSON
commit "frontend: add .eslintrc.json with next/core-web-vitals and hooks rules"

# ─── Commit 46: Leaderboard — add refresh button ─────────────────────────────
cat > frontend/components/Leaderboard.tsx << 'TSEOF'
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

  const { data: prize, refetch: refetchPrize } = useReadContract({ address: contract, abi: PADI_ABI, functionName: "weeklyPrizePool" });
  const { data: totalGamesCount, refetch: refetchGames } = useReadContract({ address: contract, abi: PADI_ABI, functionName: "totalGames" });
  const { data: myWins, refetch: refetchMy } = useReadContract({
    address: contract, abi: PADI_ABI, functionName: "totalWins",
    args: address ? [address] : undefined,
  });

  const wins = TOP.map(addr =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useReadContract({ address: contract, abi: PADI_ABI, functionName: "totalWins", args: [addr as `0x${string}`] })
  );
  const rows = TOP.map((addr, i) => ({ addr, wins: wins[i]?.data ? Number(wins[i].data) : 0 })).sort((a, b) => b.wins - a.wins);
  const medals = ["🥇", "🥈", "🥉"];

  function refresh() {
    refetchPrize();
    refetchGames();
    refetchMy();
  }

  return (
    <div className="space-y-4">
      <div className="bg-yellow-900/20 border border-yellow-700 rounded-2xl p-4 text-center">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-yellow-500 uppercase tracking-wide">Weekly Prize Pool</span>
          <button onClick={refresh} className="text-xs text-gray-500 hover:text-gray-300">↻ refresh</button>
        </div>
        <p className="text-3xl font-bold text-yellow-400">
          {prize ? (Number(prize) / 1e18).toFixed(2) : "0.00"} USDM
        </p>
        <p className="text-xs text-gray-400 mt-1">Top players at week's end share this</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-900 rounded-2xl p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Total Games</p>
          <p className="text-xl font-bold text-gray-300">{totalGamesCount?.toString() ?? "0"}</p>
        </div>
        {address && (
          <div className="bg-gray-900 rounded-2xl p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Your Wins</p>
            <p className="text-xl font-bold text-red-400">{myWins?.toString() ?? "0"}</p>
          </div>
        )}
      </div>

      <div className="bg-gray-900 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <p className="text-sm font-semibold text-white">All-Time Leaderboard</p>
        </div>
        {rows.every(r => r.wins === 0) ? (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">No wins recorded yet. Be the first!</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {rows.map(({ addr, wins }, i) => (
              <div key={addr} className={`flex items-center gap-3 px-4 py-3 ${addr.toLowerCase() === address?.toLowerCase() ? "bg-gray-800/50" : ""}`}>
                <span className="text-lg">{medals[i]}</span>
                <p className="flex-1 text-sm font-mono text-gray-300">
                  {addr.slice(0, 6)}…{addr.slice(-4)}
                  {addr.toLowerCase() === address?.toLowerCase() && <span className="ml-1 text-xs text-red-400"> (you)</span>}
                </p>
                <p className="text-white font-bold">{wins} <span className="text-xs text-gray-400">wins</span></p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
TSEOF
commit "Leaderboard.tsx: add refresh button, highlight own address in table"

# ─── Commit 47: Padi.sol — add SPDX and cleanup nits ─────────────────────────
# Small but meaningful: normalise spacing in the _endGame function for clarity
cat > contracts/contracts/Padi.sol << 'SOLEOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Padi — on-chain Ludo vs AI on Celo
/// @notice Single-player game: you vs 1-3 AI opponents. AI runs in the same tx as your move.
/// @dev Uses block.prevrandao for dice. Safe squares prevent captures.
contract Padi is Ownable, ReentrancyGuard {
    IERC20 public immutable usdm;

    uint8 public constant BOARD_SIZE   = 52;
    uint8 public constant HOME_STRETCH = 6;
    uint8 public constant FINISHED_POS = 59;
    uint8 public constant AT_BASE      = 0;
    uint8 public constant PIECES       = 4;

    /// @notice 0 = ACTIVE, 1 = FINISHED
    enum GameState { ACTIVE, FINISHED }

    struct Game {
        address player;
        uint8[4][4] pieces;    // [seat][pieceIdx] = position (0=base, 1-52=board, 53-58=home stretch, 59=home)
        uint8 aiCount;         // 1-3 AI opponents
        uint8 currentSeat;     // 0 = player, 1..aiCount = AI
        uint8 lastDice;
        bool  diceRolled;
        GameState state;
        uint256 wager;         // USDM amount staked (0 = free game)
        address winner;        // address(0) if AI won
        uint256 nonce;         // incremented each roll for entropy
    }

    uint256 private _gameCounter;
    mapping(uint256 => Game) private games;
    mapping(address => uint256[]) public playerGames;
    mapping(address => uint256) public totalWins;
    uint256 public weeklyPrizePool;
    uint256 public platformFeeBalance;

    event GameCreated(uint256 indexed gameId, address indexed player, uint8 aiCount);
    event DiceRolled(uint256 indexed gameId, uint8 seat, uint8 dice);
    event PieceMoved(uint256 indexed gameId, uint8 seat, uint8 piece, uint8 from, uint8 to);
    event PieceCaptured(uint256 indexed gameId, uint8 capturerSeat, uint8 capturedSeat, uint8 piece);
    event GameFinished(uint256 indexed gameId, address indexed winner, uint256 prize);
    event PrizeDistributed(address indexed recipient, uint256 amount);

    uint8[8] private SAFE_SQUARES = [0, 8, 13, 21, 26, 34, 39, 47];

    constructor(address _usdm) Ownable(msg.sender) {
        usdm = IERC20(_usdm);
    }

    // ─── Public ───────────────────────────────────────────────────────────────

    /// @notice Create a new single-player Ludo game vs AI.
    /// @param aiCount Number of AI opponents (1-3).
    /// @param wagerAmount USDM to wager; must be pre-approved. Use 0 for a free game.
    function createGame(uint8 aiCount, uint256 wagerAmount) external nonReentrant returns (uint256 gameId) {
        require(aiCount >= 1 && aiCount <= 3, "aiCount 1-3");
        if (wagerAmount > 0) {
            require(usdm.transferFrom(msg.sender, address(this), wagerAmount), "transfer failed");
        }
        gameId = ++_gameCounter;
        Game storage g = games[gameId];
        g.player = msg.sender;
        g.aiCount = aiCount;
        g.wager = wagerAmount;
        g.state = GameState.ACTIVE;
        for (uint8 s = 0; s < 4; s++) {
            for (uint8 p = 0; p < 4; p++) {
                g.pieces[s][p] = AT_BASE;
            }
        }
        playerGames[msg.sender].push(gameId);
        emit GameCreated(gameId, msg.sender, aiCount);
    }

    /// @notice Roll the dice for your turn. Must be called before movePiece.
    function rollDice(uint256 gameId) external {
        Game storage g = games[gameId];
        require(g.state == GameState.ACTIVE, "not active");
        require(g.player == msg.sender,      "not player");
        require(g.currentSeat == 0,          "not your turn");
        require(!g.diceRolled,               "already rolled");
        g.nonce++;
        uint8 dice = uint8(uint256(keccak256(abi.encodePacked(block.prevrandao, gameId, g.nonce))) % 6) + 1;
        g.lastDice = dice;
        g.diceRolled = true;
        emit DiceRolled(gameId, 0, dice);
    }

    /// @notice Move one of your pieces. AI turns run automatically after this call.
    function movePiece(uint256 gameId, uint8 pieceIdx) external nonReentrant {
        Game storage g = games[gameId];
        require(g.state == GameState.ACTIVE, "not active");
        require(g.player == msg.sender,      "not player");
        require(g.currentSeat == 0,          "not your turn");
        require(g.diceRolled,                "roll first");
        require(pieceIdx < PIECES,           "bad piece");
        uint8 pos    = g.pieces[0][pieceIdx];
        require(pos != FINISHED_POS,                    "already home");
        require(pos != AT_BASE || g.lastDice == 6,      "need 6 to leave base");
        uint8 newPos = pos == AT_BASE ? 1 : pos + g.lastDice;
        require(!(pos > BOARD_SIZE && newPos > FINISHED_POS), "overshoot");
        uint8 from = pos;
        _applyMove(gameId, 0, pieceIdx, newPos);
        g.diceRolled = false;
        emit PieceMoved(gameId, 0, pieceIdx, from, newPos);
        if (_isAllFinished(games[gameId], 0)) {
            _endGame(gameId, games[gameId].player);
            return;
        }
        _runAITurns(gameId);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getGame(uint256 gameId) external view returns (
        address player,
        uint8[4][4] memory pieces,
        uint8 aiCount,
        uint8 currentSeat,
        uint8 lastDice,
        bool  diceRolled,
        uint8 state,
        uint256 wager,
        address winner
    ) {
        Game storage g = games[gameId];
        return (g.player, g.pieces, g.aiCount, g.currentSeat, g.lastDice, g.diceRolled, uint8(g.state), g.wager, g.winner);
    }

    function getPlayerGames(address p) external view returns (uint256[] memory) {
        return playerGames[p];
    }

    function totalGames() external view returns (uint256) {
        return _gameCounter;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function withdrawPlatformFee(address to) external onlyOwner {
        uint256 amount = platformFeeBalance;
        platformFeeBalance = 0;
        usdm.transfer(to, amount);
    }

    function addToPrizePool(uint256 amount) external {
        require(usdm.transferFrom(msg.sender, address(this), amount), "transfer failed");
        weeklyPrizePool += amount;
    }

    function distributePrize(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner {
        require(recipients.length == amounts.length, "length mismatch");
        uint256 total = 0;
        for (uint256 i = 0; i < amounts.length; i++) total += amounts[i];
        require(total <= weeklyPrizePool, "exceeds pool");
        weeklyPrizePool -= total;
        for (uint256 i = 0; i < recipients.length; i++) {
            usdm.transfer(recipients[i], amounts[i]);
            emit PrizeDistributed(recipients[i], amounts[i]);
        }
    }

    function emergencyRefund(uint256 gameId) external onlyOwner {
        Game storage g = games[gameId];
        require(g.state == GameState.ACTIVE, "not active");
        require(g.wager > 0, "no wager");
        g.state = GameState.FINISHED;
        usdm.transfer(g.player, g.wager);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _isAllFinished(Game storage g, uint8 seat) internal view returns (bool) {
        for (uint8 p = 0; p < PIECES; p++) {
            if (g.pieces[seat][p] != FINISHED_POS) return false;
        }
        return true;
    }

    function _aiPickPiece(Game storage g, uint8 seat, uint8 dice) internal view returns (uint8) {
        uint8 best = type(uint8).max;
        uint8 bestScore = 0;
        for (uint8 p = 0; p < PIECES; p++) {
            uint8 pos = g.pieces[seat][p];
            if (pos == FINISHED_POS) continue;
            if (pos == AT_BASE && dice != 6) continue;
            uint8 newPos = pos == AT_BASE ? 1 : pos + dice;
            if (pos > BOARD_SIZE && newPos > FINISHED_POS) continue;
            uint8 score = pos == AT_BASE ? 50 : pos;
            // Prioritise capturing player pieces
            if (newPos >= 1 && newPos <= BOARD_SIZE) {
                uint8 myGlobal = _globalPos(seat, newPos);
                if (!_isSafe(myGlobal)) {
                    for (uint8 sp = 0; sp < PIECES; sp++) {
                        uint8 ppos = g.pieces[0][sp];
                        if (ppos >= 1 && ppos <= BOARD_SIZE && _globalPos(0, ppos) == myGlobal) {
                            score = 200;
                        }
                    }
                }
            }
            if (score > bestScore) { bestScore = score; best = p; }
        }
        return best;
    }

    function _runAITurns(uint256 gameId) internal {
        Game storage g = games[gameId];
        uint8 totalSeats = 1 + g.aiCount;
        uint8 maxIter = 20;
        uint8 iter = 0;
        while (g.state == GameState.ACTIVE && iter < maxIter) {
            iter++;
            uint8 seat = g.currentSeat == 0 ? 1 : g.currentSeat;
            if (seat >= totalSeats) { g.currentSeat = 0; break; }
            g.currentSeat = seat;
            uint8 dice = _rollDiceFor(gameId, seat);
            if (!_hasValidMove(g, seat, dice)) {
                g.currentSeat = (seat + 1 >= totalSeats) ? 0 : seat + 1;
                if (g.currentSeat == 0) break;
                continue;
            }
            uint8 pick = _aiPickPiece(g, seat, dice);
            if (pick == type(uint8).max) {
                g.currentSeat = (seat + 1 >= totalSeats) ? 0 : seat + 1;
                if (g.currentSeat == 0) break;
                continue;
            }
            uint8 from   = g.pieces[seat][pick];
            uint8 newPos = from == AT_BASE ? 1 : from + dice;
            _applyMove(gameId, seat, pick, newPos);
            emit PieceMoved(gameId, seat, pick, from, newPos);
            if (_isAllFinished(g, seat)) {
                _endGame(gameId, address(0));
                return;
            }
            g.currentSeat = (seat + 1 >= totalSeats) ? 0 : seat + 1;
            if (g.currentSeat == 0) break;
        }
    }

    function _endGame(uint256 gameId, address winner) internal {
        Game storage g = games[gameId];
        g.state  = GameState.FINISHED;
        g.winner = winner;
        uint256 prize = 0;
        if (g.wager > 0) {
            if (winner == g.player) {
                // 99% back to player, 0.5% platform, remainder to prize pool
                prize              = (g.wager * 99)  / 100;
                platformFeeBalance += (g.wager * 5)   / 1000;
                weeklyPrizePool   += g.wager - prize - (g.wager * 5) / 1000;
                usdm.transfer(winner, prize);
            } else {
                weeklyPrizePool += g.wager;
            }
        }
        if (winner == g.player) totalWins[g.player]++;
        emit GameFinished(gameId, winner, prize);
    }

    function _rollDiceFor(uint256 gameId, uint8 seat) internal returns (uint8) {
        Game storage g = games[gameId];
        g.nonce++;
        uint8 dice = uint8(uint256(keccak256(abi.encodePacked(block.prevrandao, gameId, seat, g.nonce))) % 6) + 1;
        emit DiceRolled(gameId, seat, dice);
        return dice;
    }

    function _hasValidMove(Game storage g, uint8 seat, uint8 dice) internal view returns (bool) {
        for (uint8 p = 0; p < PIECES; p++) {
            uint8 pos = g.pieces[seat][p];
            if (pos == FINISHED_POS) continue;
            if (pos == AT_BASE && dice != 6) continue;
            uint8 newPos = pos == AT_BASE ? 1 : pos + dice;
            if (pos > BOARD_SIZE && newPos > FINISHED_POS) continue;
            return true;
        }
        return false;
    }

    function _isSafe(uint8 globalPos) internal view returns (bool) {
        for (uint8 i = 0; i < 8; i++) {
            if (SAFE_SQUARES[i] == globalPos) return true;
        }
        return false;
    }

    function _globalPos(uint8 seat, uint8 relPos) internal pure returns (uint8) {
        if (relPos == 0 || relPos > BOARD_SIZE) return relPos;
        uint8[4] memory offsets = [0, 13, 26, 39];
        return uint8((offsets[seat] + relPos - 1) % BOARD_SIZE);
    }

    function _applyMove(uint256 gameId, uint8 seat, uint8 pieceIdx, uint8 newPos) internal {
        Game storage g = games[gameId];
        g.pieces[seat][pieceIdx] = newPos;
        if (newPos >= 1 && newPos <= BOARD_SIZE) {
            uint8 myGlobal = _globalPos(seat, newPos);
            if (!_isSafe(myGlobal)) _capture(gameId, seat, myGlobal);
        }
    }

    function _capture(uint256 gameId, uint8 attackerSeat, uint8 globalPos) internal {
        Game storage g = games[gameId];
        uint8 totalSeats = 1 + g.aiCount;
        for (uint8 s = 0; s < totalSeats; s++) {
            if (s == attackerSeat) continue;
            for (uint8 p = 0; p < PIECES; p++) {
                uint8 pos = g.pieces[s][p];
                if (pos == 0 || pos > BOARD_SIZE) continue;
                if (_globalPos(s, pos) == globalPos) {
                    g.pieces[s][p] = AT_BASE;
                    emit PieceCaptured(gameId, attackerSeat, s, p);
                }
            }
        }
    }
}
SOLEOF
commit "Padi.sol: add NatSpec docs, align constants, clean up _endGame fee comments"

# ─── Commit 48: add scripts/verify.sh ────────────────────────────────────────
mkdir -p scripts
cat > scripts/verify.sh << 'SHEOF'
#!/bin/bash
# Verify Padi contract on Celoscan after deployment
# Usage: PADI_ADDRESS=0x... bash scripts/verify.sh
set -e
if [ -z "$PADI_ADDRESS" ]; then
  echo "Usage: PADI_ADDRESS=0x... bash scripts/verify.sh"
  exit 1
fi
USDM="0x765DE816845861e75A25fCA122bb6898B8B1282a"
cd contracts
npx hardhat verify --network celo "$PADI_ADDRESS" "$USDM"
SHEOF
chmod +x scripts/verify.sh
commit "scripts: add verify.sh for Celoscan contract verification"

# ─── Commit 49: contracts.ts — add PieceCaptured event to ABI ─────────────────
cat > frontend/lib/contracts.ts << 'TSEOF'
// USDM on Celo mainnet — same address as legacy cUSD, rebranded
export const USDM_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const;

// Fill in after deploying Padi.sol to Celo mainnet
export const PADI_ADDRESS = "" as `0x${string}`;

export const PADI_ABI = [
  { name: "createGame", type: "function", stateMutability: "nonpayable", inputs: [{ name: "aiCount", type: "uint8" }, { name: "wagerAmount", type: "uint256" }], outputs: [{ name: "gameId", type: "uint256" }] },
  { name: "rollDice", type: "function", stateMutability: "nonpayable", inputs: [{ name: "gameId", type: "uint256" }], outputs: [] },
  { name: "movePiece", type: "function", stateMutability: "nonpayable", inputs: [{ name: "gameId", type: "uint256" }, { name: "pieceIdx", type: "uint8" }], outputs: [] },
  {
    name: "getGame", type: "function", stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      { name: "player", type: "address" }, { name: "pieces", type: "uint8[4][4]" },
      { name: "aiCount", type: "uint8" }, { name: "currentSeat", type: "uint8" },
      { name: "lastDice", type: "uint8" }, { name: "diceRolled", type: "bool" },
      { name: "state", type: "uint8" }, { name: "wager", type: "uint256" }, { name: "winner", type: "address" },
    ],
  },
  { name: "getPlayerGames", type: "function", stateMutability: "view", inputs: [{ name: "p", type: "address" }], outputs: [{ name: "", type: "uint256[]" }] },
  { name: "totalWins", type: "function", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "weeklyPrizePool", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "totalGames", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "addToPrizePool", type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { name: "GameCreated", type: "event", inputs: [{ name: "gameId", type: "uint256", indexed: true }, { name: "player", type: "address", indexed: true }, { name: "aiCount", type: "uint8", indexed: false }] },
  { name: "DiceRolled", type: "event", inputs: [{ name: "gameId", type: "uint256", indexed: true }, { name: "seat", type: "uint8", indexed: false }, { name: "dice", type: "uint8", indexed: false }] },
  { name: "PieceMoved", type: "event", inputs: [{ name: "gameId", type: "uint256", indexed: true }, { name: "seat", type: "uint8", indexed: false }, { name: "piece", type: "uint8", indexed: false }, { name: "from", type: "uint8", indexed: false }, { name: "to", type: "uint8", indexed: false }] },
  { name: "PieceCaptured", type: "event", inputs: [{ name: "gameId", type: "uint256", indexed: true }, { name: "capturerSeat", type: "uint8", indexed: false }, { name: "capturedSeat", type: "uint8", indexed: false }, { name: "piece", type: "uint8", indexed: false }] },
  { name: "GameFinished", type: "event", inputs: [{ name: "gameId", type: "uint256", indexed: true }, { name: "winner", type: "address", indexed: true }, { name: "prize", type: "uint256", indexed: false }] },
] as const;

export const ERC20_ABI = [
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
] as const;
TSEOF
commit "contracts.ts: add PieceCaptured event and addToPrizePool to ABI"

# ─── Commit 50: Lobby — extract handleApproveOk to avoid re-render loop ───────
cat > frontend/components/Lobby.tsx << 'TSEOF'
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
TSEOF
commit "Lobby.tsx: move approve→create sequencing into useEffect to avoid render loop"

echo "=== Part 3 done ==="
