// Client-side Ludo game engine — mirrors Padi.sol logic exactly
// so the browser can play the full game without any on-chain calls.

export const BOARD_SIZE   = 52;
export const FINISHED_POS = 59;
export const AT_BASE      = 0;
export const PIECES       = 4;
export const SAFE_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
export const SEAT_OFFSETS: readonly [number, number, number, number] = [0, 13, 26, 39];

export type PieceRow  = [number, number, number, number];
export type AllPieces = [PieceRow, PieceRow, PieceRow, PieceRow];

export interface GameState {
  pieces:      AllPieces;
  aiCount:     number;
  currentSeat: number;
  lastDice:    number;
  diceRolled:  boolean;
  finished:    boolean;
  playerWon:   boolean | null;
}

// ── Construction ──────────────────────────────────────────────────────────

export function createInitialState(aiCount: number): GameState {
  return {
    pieces:      [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
    aiCount,
    currentSeat: 0,
    lastDice:    0,
    diceRolled:  false,
    finished:    false,
    playerWon:   null,
  };
}

// ── Dice ──────────────────────────────────────────────────────────────────

export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

// ── Position helpers (mirror Solidity _globalPos / _isSafe) ──────────────

export function globalPos(seat: number, relPos: number): number {
  if (relPos === 0 || relPos > BOARD_SIZE) return relPos;
  return (SEAT_OFFSETS[seat] + relPos - 1) % BOARD_SIZE;
}

export function isSafeSquare(gPos: number): boolean {
  return SAFE_SQUARES.has(gPos);
}

// ── Move validation ───────────────────────────────────────────────────────

export function isPieceMovable(pos: number, dice: number): boolean {
  if (pos === FINISHED_POS) return false;
  if (pos === AT_BASE && dice !== 6) return false;
  const next = pos === AT_BASE ? 1 : pos + dice;
  if (pos > BOARD_SIZE && next > FINISHED_POS) return false;
  return true;
}

export function hasValidMove(pieces: PieceRow, dice: number): boolean {
  return pieces.some(pos => isPieceMovable(pos, dice));
}

export function isAllFinished(pieces: PieceRow): boolean {
  return pieces.every(p => p === FINISHED_POS);
}

// ── Internals ─────────────────────────────────────────────────────────────

function deepCopy(state: GameState): GameState {
  return {
    ...state,
    pieces: state.pieces.map(row => [...row]) as AllPieces,
  };
}

function capture(pieces: AllPieces, attackerSeat: number, gPos: number, totalSeats: number): void {
  for (let s = 0; s < totalSeats; s++) {
    if (s === attackerSeat) continue;
    for (let p = 0; p < PIECES; p++) {
      const pos = pieces[s][p];
      if (pos === 0 || pos > BOARD_SIZE) continue;
      if (globalPos(s, pos) === gPos) pieces[s][p] = AT_BASE;
    }
  }
}

function applyMove(pieces: AllPieces, seat: number, idx: number, newPos: number, totalSeats: number): void {
  pieces[seat][idx] = newPos;
  if (newPos >= 1 && newPos <= BOARD_SIZE) {
    const gPos = globalPos(seat, newPos);
    if (!isSafeSquare(gPos)) capture(pieces, seat, gPos, totalSeats);
  }
}

function aiPickPiece(pieces: AllPieces, seat: number, dice: number): number {
  let best = 255, bestScore = -1;
  for (let p = 0; p < PIECES; p++) {
    const pos = pieces[seat][p];
    if (!isPieceMovable(pos, dice)) continue;
    const newPos = pos === AT_BASE ? 1 : pos + dice;
    // Home-stretch pieces score highest, board pieces score by distance, yard last
    let score = pos === AT_BASE ? 1 : pos > BOARD_SIZE ? 100 + pos : pos;
    if (newPos >= 1 && newPos <= BOARD_SIZE) {
      const myG = globalPos(seat, newPos);
      if (!isSafeSquare(myG)) {
        // Bonus for capturing the player's piece
        for (let pp = 0; pp < PIECES; pp++) {
          const pPos = pieces[0][pp];
          if (pPos >= 1 && pPos <= BOARD_SIZE && globalPos(0, pPos) === myG) score = 200;
        }
      }
    }
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best;
}

function runAITurnsTracked(state: GameState): { dice: number; moved: boolean } {
  const totalSeats = 1 + state.aiCount;
  let firstDice = 0;
  let moved = false;
  let maxIter = 20;
  while (!state.finished && maxIter-- > 0) {
    const seat = state.currentSeat === 0 ? 1 : state.currentSeat;
    if (seat >= totalSeats) { state.currentSeat = 0; break; }
    state.currentSeat = seat;
    const dice = rollDice();
    if (firstDice === 0) firstDice = dice;
    if (!hasValidMove(state.pieces[seat], dice)) {
      state.currentSeat = (seat + 1 >= totalSeats) ? 0 : seat + 1;
      if (state.currentSeat === 0) break;
      continue;
    }
    const pick = aiPickPiece(state.pieces, seat, dice);
    if (pick === 255) {
      state.currentSeat = (seat + 1 >= totalSeats) ? 0 : seat + 1;
      if (state.currentSeat === 0) break;
      continue;
    }
    const from = state.pieces[seat][pick];
    applyMove(state.pieces, seat, pick, from === AT_BASE ? 1 : from + dice, totalSeats);
    moved = true;
    if (isAllFinished(state.pieces[seat])) {
      state.finished  = true;
      state.playerWon = false;
      return { dice: firstDice, moved };
    }
    state.currentSeat = (seat + 1 >= totalSeats) ? 0 : seat + 1;
    if (state.currentSeat === 0) break;
  }
  return { dice: firstDice, moved };
}

function runAITurns(state: GameState): void { runAITurnsTracked(state); }

// ── Public API ────────────────────────────────────────────────────────────

/** Roll the dice — returns new state with diceRolled=true. */
export function performRoll(state: GameState): { state: GameState; dice: number } {
  const dice = rollDice();
  return { state: { ...state, lastDice: dice, diceRolled: true }, dice };
}

/** Apply a player piece move. Does NOT run AI turns — call advanceAI() next. */
export function performMove(
  state: GameState,
  pieceIdx: number,
): { state: GameState; valid: boolean; captured: boolean } {
  if (!state.diceRolled || state.currentSeat !== 0 || state.finished)
    return { state, valid: false, captured: false };
  const pos = state.pieces[0][pieceIdx];
  if (!isPieceMovable(pos, state.lastDice))
    return { state, valid: false, captured: false };

  const newPos      = pos === AT_BASE ? 1 : pos + state.lastDice;
  const totalSeats  = 1 + state.aiCount;
  const next        = deepCopy(state);

  // Detect capture before applying move
  let captured = false;
  if (newPos >= 1 && newPos <= BOARD_SIZE) {
    const gPos = globalPos(0, newPos);
    if (!isSafeSquare(gPos)) {
      for (let s = 1; s < totalSeats; s++) {
        for (let p = 0; p < PIECES; p++) {
          const ep = next.pieces[s][p];
          if (ep >= 1 && ep <= BOARD_SIZE && globalPos(s, ep) === gPos) captured = true;
        }
      }
    }
  }

  applyMove(next.pieces, 0, pieceIdx, newPos, totalSeats);
  next.diceRolled = false;

  if (isAllFinished(next.pieces[0])) {
    next.finished  = true;
    next.playerWon = true;
  }

  return { state: next, valid: true, captured };
}

/** Run one round of AI turns and return the new state plus the first AI's dice roll. */
export function advanceAI(state: GameState): { state: GameState; aiDice: number; moved: boolean } {
  if (state.finished) return { state, aiDice: 0, moved: false };
  const next = deepCopy(state);
  const { dice: aiDice, moved } = runAITurnsTracked(next);
  return { state: next, aiDice, moved };
}

/** When player rolls and has no valid move, skip their turn (no AI — call advanceAI separately). */
export function skipTurn(state: GameState): GameState {
  const next = deepCopy(state);
  next.diceRolled = false;
  return next;
}
