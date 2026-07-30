// Client-side Ludo game engine
// Local-rules mode: double-board (aiCount=1 → player owns seats 0&2, AI owns 1&3),
// rolling 6 grants an extra turn (max 2 extras before forced advance).

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
  localRules:  boolean;   // enables double-board + extra turn for 6
}

// ── Seat helpers ──────────────────────────────────────────────────────────

/** Total seats on the board (4 for 2-player double-board, 1+aiCount otherwise). */
export function getTotalSeats(state: GameState): number {
  return state.localRules && state.aiCount === 1 ? 4 : 1 + state.aiCount;
}

/** Returns true if `seat` is controlled by the human player. */
export function isPlayerSeat(seat: number, state: GameState): boolean {
  if (state.localRules && state.aiCount === 1) return seat === 0 || seat === 2;
  return seat === 0;
}

// ── Construction ──────────────────────────────────────────────────────────

export function createInitialState(aiCount: number, localRules = false): GameState {
  return {
    pieces:      [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
    aiCount,
    currentSeat: 0,
    lastDice:    0,
    diceRolled:  false,
    finished:    false,
    playerWon:   null,
    localRules,
  };
}

// ── Dice ──────────────────────────────────────────────────────────────────

export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

// ── Position helpers ──────────────────────────────────────────────────────

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

// ── Win checks ────────────────────────────────────────────────────────────

function isPlayerTeamWon(pieces: AllPieces, state: GameState): boolean {
  if (state.localRules && state.aiCount === 1)
    return isAllFinished(pieces[0]) && isAllFinished(pieces[2]);
  return isAllFinished(pieces[0]);
}

function isAITeamWon(pieces: AllPieces, seat: number, state: GameState): boolean {
  if (state.localRules && state.aiCount === 1)
    return isAllFinished(pieces[1]) && isAllFinished(pieces[3]);
  return isAllFinished(pieces[seat]);
}

// ── Internals ─────────────────────────────────────────────────────────────

function deepCopy(state: GameState): GameState {
  return {
    ...state,
    pieces: state.pieces.map(row => [...row]) as AllPieces,
  };
}

function capture(pieces: AllPieces, attackerSeat: number, gPos: number, ts: number, doubleBoard: boolean): void {
  // In double-board mode: player owns even seats (0,2), AI owns odd seats (1,3).
  // Same-team pieces stack — they never capture each other.
  const attackerIsOdd = attackerSeat % 2 === 1;
  for (let s = 0; s < ts; s++) {
    if (s === attackerSeat) continue;
    if (doubleBoard && (s % 2 === 1) === attackerIsOdd) continue;
    for (let p = 0; p < PIECES; p++) {
      const pos = pieces[s][p];
      if (pos === 0 || pos > BOARD_SIZE) continue;
      if (globalPos(s, pos) === gPos) pieces[s][p] = AT_BASE;
    }
  }
}

function applyMove(pieces: AllPieces, seat: number, idx: number, newPos: number, ts: number, doubleBoard: boolean): void {
  pieces[seat][idx] = newPos;
  if (newPos >= 1 && newPos <= BOARD_SIZE) {
    const gPos = globalPos(seat, newPos);
    if (!isSafeSquare(gPos)) capture(pieces, seat, gPos, ts, doubleBoard);
  }
}

function aiPickPiece(pieces: AllPieces, seat: number, dice: number, state: GameState): number {
  const ts = getTotalSeats(state);
  let best = 255, bestScore = -1;
  for (let p = 0; p < PIECES; p++) {
    const pos = pieces[seat][p];
    if (!isPieceMovable(pos, dice)) continue;
    const newPos = pos === AT_BASE ? 1 : pos + dice;
    let score = pos === AT_BASE ? 1 : pos > BOARD_SIZE ? 100 + pos : pos;
    if (newPos >= 1 && newPos <= BOARD_SIZE) {
      const myG = globalPos(seat, newPos);
      if (!isSafeSquare(myG)) {
        // Bonus for landing on any player-team piece
        for (let s = 0; s < ts; s++) {
          if (!isPlayerSeat(s, state)) continue;
          for (let pp = 0; pp < PIECES; pp++) {
            const pPos = pieces[s][pp];
            if (pPos >= 1 && pPos <= BOARD_SIZE && globalPos(s, pPos) === myG) score = 200;
          }
        }
      }
    }
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best;
}

function runAITurnsTracked(state: GameState): { dice: number; moved: boolean; capturedPlayer: boolean } {
  const ts          = getTotalSeats(state);
  const doubleBoard = state.localRules && state.aiCount === 1;
  let firstDice     = 0;
  let moved         = false;
  let capturedPlayer = false;
  let maxIter       = 40;
  let extraTurns    = 0; // cap consecutive bonus turns to prevent infinite loops

  while (!state.finished && maxIter-- > 0) {
    if (isPlayerSeat(state.currentSeat, state)) break;
    const seat = state.currentSeat;
    const dice = rollDice();
    if (firstDice === 0) firstDice = dice;

    let piecesMoved = false;
    let thisCapture = false;

    if (hasValidMove(state.pieces[seat], dice)) {
      const pick = aiPickPiece(state.pieces, seat, dice, state);
      if (pick !== 255) {
        const from   = state.pieces[seat][pick];
        const newPos = from === AT_BASE ? 1 : from + dice;
        // Detect player-piece capture before applying
        if (newPos >= 1 && newPos <= BOARD_SIZE) {
          const gPos = globalPos(seat, newPos);
          if (!isSafeSquare(gPos)) {
            for (let s = 0; s < ts; s++) {
              if (s === seat) continue;
              if (doubleBoard && (s % 2 === 1) === (seat % 2 === 1)) continue; // same team
              if (!isPlayerSeat(s, state)) continue;
              for (let pp = 0; pp < PIECES; pp++) {
                const pPos = state.pieces[s][pp];
                if (pPos >= 1 && pPos <= BOARD_SIZE && globalPos(s, pPos) === gPos) {
                  thisCapture = true;
                }
              }
            }
          }
        }
        applyMove(state.pieces, seat, pick, newPos, ts, doubleBoard);
        piecesMoved = true;
        moved       = true;
        if (thisCapture) capturedPlayer = true;
        if (isAITeamWon(state.pieces, seat, state)) {
          state.finished  = true;
          state.playerWon = false;
          return { dice: firstDice, moved, capturedPlayer };
        }
      }
    }

    // Extra turn: rolled 6 OR killed a player piece (local rules, max 3 extras)
    if (state.localRules && (dice === 6 || thisCapture) && piecesMoved && extraTurns < 3) {
      extraTurns++;
      // stay on same seat for bonus roll
    } else {
      extraTurns = 0;
      state.currentSeat = (seat + 1) % ts;
    }
  }

  return { dice: firstDice, moved, capturedPlayer };
}

// ── Public API ────────────────────────────────────────────────────────────

/** Roll the dice — returns new state with diceRolled=true. */
export function performRoll(state: GameState): { state: GameState; dice: number } {
  const dice = rollDice();
  return { state: { ...state, lastDice: dice, diceRolled: true }, dice };
}

/**
 * Apply the player's piece move for the current player seat.
 * Advances currentSeat after the move (stays on same seat if dice=6 in local rules).
 * Does NOT run AI turns — call advanceAI() after.
 */
export function performMove(
  state: GameState,
  pieceIdx: number,
): { state: GameState; valid: boolean; captured: boolean } {
  const activeSeat = state.currentSeat;
  if (!state.diceRolled || !isPlayerSeat(activeSeat, state) || state.finished)
    return { state, valid: false, captured: false };

  const pos = state.pieces[activeSeat][pieceIdx];
  if (!isPieceMovable(pos, state.lastDice))
    return { state, valid: false, captured: false };

  const newPos = pos === AT_BASE ? 1 : pos + state.lastDice;
  const ts     = getTotalSeats(state);
  const next   = deepCopy(state);

  // Detect capture before applying
  let captured = false;
  if (newPos >= 1 && newPos <= BOARD_SIZE) {
    const gPos = globalPos(activeSeat, newPos);
    if (!isSafeSquare(gPos)) {
      for (let s = 0; s < ts; s++) {
        if (isPlayerSeat(s, state)) continue;
        for (let p = 0; p < PIECES; p++) {
          const ep = next.pieces[s][p];
          if (ep >= 1 && ep <= BOARD_SIZE && globalPos(s, ep) === gPos) captured = true;
        }
      }
    }
  }

  applyMove(next.pieces, activeSeat, pieceIdx, newPos, ts, state.localRules && state.aiCount === 1);
  next.diceRolled = false;

  // Extra turn: rolled 6 OR killed an opponent (local rules)
  if (state.localRules && (state.lastDice === 6 || captured)) {
    next.currentSeat = activeSeat;  // stay — bonus roll
  } else {
    next.currentSeat = (activeSeat + 1) % ts;
  }

  if (isPlayerTeamWon(next.pieces, next)) {
    next.finished  = true;
    next.playerWon = true;
  }

  return { state: next, valid: true, captured };
}

/** Run one batch of AI turns (stops when the next player seat is reached). */
export function advanceAI(
  state: GameState,
): { state: GameState; aiDice: number; moved: boolean; capturedPlayer: boolean } {
  if (state.finished) return { state, aiDice: 0, moved: false, capturedPlayer: false };
  const next = deepCopy(state);
  const { dice: aiDice, moved, capturedPlayer } = runAITurnsTracked(next);
  return { state: next, aiDice, moved, capturedPlayer };
}

/** Skip the current player's turn (no valid move). Advances to next seat. */
export function skipTurn(state: GameState): GameState {
  const next = deepCopy(state);
  next.diceRolled  = false;
  next.currentSeat = (state.currentSeat + 1) % getTotalSeats(state);
  return next;
}
