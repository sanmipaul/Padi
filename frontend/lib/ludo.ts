// Ludo game logic helpers — used by the board UI

export const PLAYER_COLORS = ["#ef4444", "#22c55e", "#3b82f6", "#f59e0b"] as const;
export const PLAYER_NAMES = ["Red", "Green", "Blue", "Yellow"] as const;
export const PLAYER_LABELS = ["P1", "P2", "P3", "P4"] as const;

// Board square coordinates for rendering (52 main squares, 0-indexed)
// Returns [col, row] for a given board position (0-51)
export function boardSquareCoords(pos: number): [number, number] {
  // Standard Ludo board layout: 15x15 grid
  // Main path goes clockwise starting from bottom-left
  const path: [number, number][] = [
    // Bottom row going right (6,14)→(8,14) skip 9 → (14,8)
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
  return path[pos % 52] || [7, 7];
}

// Home stretch coordinates for each player
export function homeStretchCoords(player: number, step: number): [number, number] {
  const stretches: [number, number][][] = [
    [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],   // Red (P0)
    [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],        // Green (P1)
    [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],        // Blue (P2)
    [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],    // Yellow (P3)
  ];
  return stretches[player][step - 1] || [7, 7];
}

// Starting yard positions for each player's pieces (at base)
export function yardCoords(player: number, piece: number): [number, number] {
  const yards: [number, number][][] = [
    [[1,13],[3,13],[1,11],[3,11]],   // Red (bottom-left)
    [[1,1],[3,1],[1,3],[3,3]],       // Green (top-left)
    [[11,1],[13,1],[11,3],[13,3]],   // Blue (top-right)
    [[11,11],[13,11],[11,13],[13,13]], // Yellow (bottom-right)
  ];
  return yards[player][piece] || [7, 7];
}

// Get global board position for a player's relative position
export function getGlobalPos(player: number, relPos: number): number {
  if (relPos === 0) return -1; // at base
  if (relPos > 52) return -2; // in home stretch
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

// Simple AI: pick first valid piece
export function getAIMove(pieces: number[], dice: number): number {
  // Priority: move piece closest to home, enter board if 6
  let best = -1;
  let bestScore = -1;

  for (let i = 0; i < 4; i++) {
    const pos = pieces[i];
    if (pos === 59) continue; // already home
    if (pos === 0 && dice !== 6) continue; // can't enter
    const newPos = pos === 0 ? 1 : pos + dice;
    if (pos > 52 && newPos > 59) continue; // overshoot
    if (pos <= 52 && newPos > 52 && (newPos - 52) > 6) continue; // overshoot home stretch
    const score = pos === 0 ? 1 : pos; // prefer advancing further pieces
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}
