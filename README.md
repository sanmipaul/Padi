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
