# Padi 🎲

On-chain Ludo game built for MiniPay on Celo. "Padi" is Nigerian Pidgin for "friend."

## Overview

Padi brings the classic Nigerian favourite — Ludo — onto the Celo blockchain. Games are **free to play**. Players can optionally wager cUSD for higher-stakes rooms. A weekly prize pool (funded by 0.5% of wager room fees) is distributed to top weekly players.

## Features

- Free-to-play rooms — no deposit required
- Optional wager rooms (cUSD stake per player)
- 2, 3, or 4 player support
- Full Ludo rules enforced on-chain
- Weekly prize pool for top players
- Auto-connect wallet (MiniPay-native)
- Mobile-first dark UI

## Stack

- **Frontend**: Next.js 14, TailwindCSS, wagmi v2, viem
- **Contracts**: Solidity 0.8.20, Hardhat, OpenZeppelin
- **Chain**: Celo mainnet / Alfajores testnet

## Game Rules

- Each player has 4 pieces starting at base
- Roll dice to move — roll a 6 to bring a piece out of base
- Land on opponent → send them home
- Safe squares protect pieces from being sent home
- First player to get all 4 pieces to finish wins
- Optional wager: winner takes pot minus 1% platform fee

## Project Structure

```
padi/
├── contracts/          # Hardhat project
│   ├── contracts/
│   │   └── Padi.sol    # Full on-chain game logic
│   └── scripts/
│       └── deploy.ts
└── frontend/           # Next.js app
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
# Contracts
cd contracts && npm install
npx hardhat compile
npx hardhat run scripts/deploy.ts --network alfajores

# Frontend — update PADI_ADDRESS in lib/contracts.ts after deploy
cd ../frontend && npm install
npm run dev
```
