// USDM on Celo mainnet — same address as legacy cUSD, rebranded
export const USDM_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const;

// Fill in after deploying Padi.sol to Celo mainnet
export const PADI_ADDRESS = "" as `0x${string}`;

export const PADI_ABI = [
  {
    name: "createGame",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "aiCount", type: "uint8" },
      { name: "wagerAmount", type: "uint256" },
    ],
    outputs: [{ name: "gameId", type: "uint256" }],
  },
  {
    name: "rollDice",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "movePiece",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "pieceIdx", type: "uint8" },
    ],
    outputs: [],
  },
  {
    name: "getGame",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      { name: "player", type: "address" },
      { name: "pieces", type: "uint8[4][4]" },
      { name: "aiCount", type: "uint8" },
      { name: "currentSeat", type: "uint8" },
      { name: "lastDice", type: "uint8" },
      { name: "diceRolled", type: "bool" },
      { name: "state", type: "uint8" },
      { name: "wager", type: "uint256" },
      { name: "winner", type: "address" },
    ],
  },
  {
    name: "getPlayerGames",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "p", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "totalWins",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "weeklyPrizePool",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalGames",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "GameCreated",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "aiCount", type: "uint8", indexed: false },
    ],
  },
  {
    name: "DiceRolled",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "seat", type: "uint8", indexed: false },
      { name: "dice", type: "uint8", indexed: false },
    ],
  },
  {
    name: "PieceMoved",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "seat", type: "uint8", indexed: false },
      { name: "piece", type: "uint8", indexed: false },
      { name: "from", type: "uint8", indexed: false },
      { name: "to", type: "uint8", indexed: false },
    ],
  },
  {
    name: "GameFinished",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "winner", type: "address", indexed: true },
      { name: "prize", type: "uint256", indexed: false },
    ],
  },
] as const;

// Minimal ERC-20 ABI for USDM approve
export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;
