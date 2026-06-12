export const PLAYER_COLORS = ["#ef4444", "#22c55e", "#3b82f6", "#f59e0b"] as const;
export const PLAYER_NAMES = ["Red", "Green", "Blue", "Yellow"] as const;
export const PLAYER_LABELS = ["P1", "P2", "P3", "P4"] as const;

// Board path: [col, row] for each of the 52 main path squares (0-indexed)
export const BOARD_PATH: [number, number][] = [
  [6,14],[6,13],[6,12],[6,11],[6,10],[6,9],
  [5,8],[4,8],[3,8],[2,8],[1,8],[0,8],
  [0,7],
  [0,6],[1,6],[2,6],[3,6],[4,6],[5,6],
  [6,5],[6,4],[6,3],[6,2],[6,1],[6,0],
  [7,0],
  [8,0],[8,1],[8,2],[8,3],[8,4],[8,5],
  [9,6],[10,6],[11,6],[12,6],[13,6],[14,6],
  [14,7],
  [14,8],[13,8],[12,8],[11,8],[10,8],[9,8],
  [8,9],[8,10],[8,11],[8,12],[8,13],[8,14],
  [7,14],
];

export function boardSquareCoords(pos: number): [number, number] {
  return BOARD_PATH[pos % 52] || [7, 7];
}

export function homeStretchCoords(player: number, step: number): [number, number] {
  const stretches: [number, number][][] = [
    [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],   // Red (P0)
    [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],        // Green (P1)
    [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],        // Blue (P2)
    [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],    // Yellow (P3)
  ];
  return stretches[player]?.[step - 1] || [7, 7];
}

export function yardCoords(player: number, piece: number): [number, number] {
  const yards: [number, number][][] = [
    [[1,13],[3,13],[1,11],[3,11]],
    [[1,1],[3,1],[1,3],[3,3]],
    [[11,1],[13,1],[11,3],[13,3]],
    [[11,11],[13,11],[11,13],[13,13]],
  ];
  return yards[player]?.[piece] || [7, 7];
}

// Convert player-relative position to global board square index (0-51)
export function getGlobalPos(player: number, relPos: number): number {
  if (relPos === 0) return -1; // at base
  if (relPos > 52) return -2; // in home stretch or finished
  const startOffsets = [0, 13, 26, 39];
  return (startOffsets[player] + relPos - 1) % 52;
}

export function getPositionType(pos: number): "base" | "board" | "stretch" | "home" {
  if (pos === 0) return "base";
  if (pos <= 52) return "board";
  if (pos <= 58) return "stretch";
  return "home";
}

export const SAFE_SQUARES_GLOBAL = [0, 8, 13, 21, 26, 34, 39, 47];

export function isSafeSquare(globalPos: number): boolean {
  return SAFE_SQUARES_GLOBAL.includes(globalPos);
}

export function getPositionLabel(pos: number): string {
  if (pos === 0) return "Base";
  if (pos === 59) return "Home";
  if (pos > 52) return `H${pos - 52}`;
  return String(pos);
}

// Heuristic AI move picker (used in frontend preview only — actual AI is on-chain)
export function getAIMove(pieces: number[], dice: number): number {
  let best = -1;
  let bestScore = -1;
  for (let i = 0; i < 4; i++) {
    const pos = pieces[i];
    if (pos === 59) continue;
    if (pos === 0 && dice !== 6) continue;
    const newPos = pos === 0 ? 1 : pos + dice;
    if (pos > 52 && newPos > 59) continue;
    if (pos <= 52 && newPos > 52 && (newPos - 52) > 6) continue;
    const score = pos === 0 ? 1 : pos;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}
