// Client-side Ludo game engine
// Local-rules mode: 2 dice, double-board (aiCount=1 → player owns seats 0&2, AI owns 1&3),
// rolling 6 or capturing grants an extra turn, bounce-back in home stretch.

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
  lastDice:    number;   // sum (or single die for on-chain)
  dice1:       number;   // first die face (display only)
  dice2:       number;   // second die face (display only; 0 for on-chain)
  diceRolled:  boolean;
  finished:    boolean;
  playerWon:   boolean | null;
  localRules:  boolean;  // double-board, 2-dice, bounce-back, kill bonus
}

// ── Seat helpers ──────────────────────────────────────────────────────────

export function getTotalSeats(state: GameState): number {
  return state.localRules && state.aiCount === 1 ? 4 : 1 + state.aiCount;
}

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
    dice1:       0,
    dice2:       0,
    diceRolled:  false,
    finished:    false,
    playerWon:   null,
    localRules,
  };
}

// ── Dice ──────────────────────────────────────────────────────────────────

function rollOneDie(): number {
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

/**
 * @param hasSix  true if piece is allowed to exit yard (double-six for local, any-6 for on-chain).
 *                Defaults to `dice === 6` for backwards-compat with 1-die callers.
 * @param bounceBack  true enables local bounce-back rule (all moves allowed, overshoot bounces).
 */
export function isPieceMovable(
  pos: number,
  dice: number,
  hasSix = (dice === 6),
  bounceBack = false,
): boolean {
  if (pos === FINISHED_POS) return false;
  if (pos === AT_BASE) return hasSix;
  if (!bounceBack) {
    // Classic: can't move if would overshoot home finish
    const next = pos + dice;
    if (pos > BOARD_SIZE && next > FINISHED_POS) return false;
  }
  // bounceBack=true: all on-board / home-stretch pieces can always move
  return true;
}

export function hasValidMove(
  pieces: PieceRow,
  dice: number,
  hasSix = (dice === 6),
  bounceBack = false,
): boolean {
  return pieces.some(pos => isPieceMovable(pos, dice, hasSix, bounceBack));
}

export function isAllFinished(pieces: PieceRow): boolean {
  return pieces.every(p => p === FINISHED_POS);
}

/** Calculate final position, applying bounce-back if needed. */
function calcNewPos(pos: number, dice: number, bounceBack: boolean): number {
  if (pos === AT_BASE) return 1;  // exit to start square
  const next = pos + dice;
  if (next > FINISHED_POS) {
    if (!bounceBack) return next;  // caller should have blocked this; guard only
    const overshoot = next - FINISHED_POS;
    // Bounce back; ensure piece stays in home stretch (≥ BOARD_SIZE + 1)
    return Math.max(BOARD_SIZE + 1, FINISHED_POS - overshoot);
  }
  return next;
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
  return { ...state, pieces: state.pieces.map(row => [...row]) as AllPieces };
}

function capture(pieces: AllPieces, attackerSeat: number, gPos: number, ts: number, doubleBoard: boolean): void {
  const attackerIsOdd = attackerSeat % 2 === 1;
  for (let s = 0; s < ts; s++) {
    if (s === attackerSeat) continue;
    if (doubleBoard && (s % 2 === 1) === attackerIsOdd) continue; // same team → stack
    for (let p = 0; p < PIECES; p++) {
      const pos = pieces[s][p];
      if (pos === 0 || pos > BOARD_SIZE) continue;
      if (globalPos(s, pos) === gPos) pieces[s][p] = AT_BASE;
    }
  }
}

function applyMove(
  pieces: AllPieces,
  seat: number,
  idx: number,
  newPos: number,
  ts: number,
  doubleBoard: boolean,
): void {
  pieces[seat][idx] = newPos;
  if (newPos >= 1 && newPos <= BOARD_SIZE) {
    const gPos = globalPos(seat, newPos);
    if (!isSafeSquare(gPos)) capture(pieces, seat, gPos, ts, doubleBoard);
  }
}

function aiPickPiece(pieces: AllPieces, seat: number, dice: number, state: GameState): number {
  const ts          = getTotalSeats(state);
  const bounceBack  = state.localRules;
  const hasSix      = state.localRules ? (state.dice1 === 6 && state.dice2 === 6) : (dice === 6);
  let best = 255, bestScore = -1;
  for (let p = 0; p < PIECES; p++) {
    const pos = pieces[seat][p];
    if (!isPieceMovable(pos, dice, hasSix, bounceBack)) continue;
    const newPos = calcNewPos(pos, dice, bounceBack);
    let score = pos === AT_BASE ? 1 : pos > BOARD_SIZE ? 100 + pos : pos;
    if (newPos >= 1 && newPos <= BOARD_SIZE) {
      const myG = globalPos(seat, newPos);
      if (!isSafeSquare(myG)) {
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

function runAITurnsTracked(state: GameState): { dice: number; dice1: number; dice2: number; moved: boolean; capturedPlayer: boolean } {
  const ts          = getTotalSeats(state);
  const doubleBoard = state.localRules && state.aiCount === 1;
  const bounceBack  = state.localRules;
  let firstDice = 0, firstD1 = 0, firstD2 = 0;
  let moved = false, capturedPlayer = false;
  let maxIter = 40, extraTurns = 0;

  while (!state.finished && maxIter-- > 0) {
    if (isPlayerSeat(state.currentSeat, state)) break;
    const seat = state.currentSeat;

    // Roll — 2 dice in local mode, 1 die on-chain
    const d1   = rollOneDie();
    const d2   = state.localRules ? rollOneDie() : 0;
    const dice = state.localRules ? d1 + d2 : d1;
    const hasSix = state.localRules ? (d1 === 6 && d2 === 6) : (d1 === 6);
    state.dice1 = d1; state.dice2 = d2;

    if (firstDice === 0) { firstDice = dice; firstD1 = d1; firstD2 = d2; }

    let piecesMoved = false, thisCapture = false;

    if (hasValidMove(state.pieces[seat], dice, hasSix, bounceBack)) {
      const pick = aiPickPiece(state.pieces, seat, dice, state);
      if (pick !== 255) {
        const from   = state.pieces[seat][pick];
        const newPos = calcNewPos(from, dice, bounceBack);
        if (newPos >= 1 && newPos <= BOARD_SIZE) {
          const gPos = globalPos(seat, newPos);
          if (!isSafeSquare(gPos)) {
            for (let s = 0; s < ts; s++) {
              if (s === seat) continue;
              if (doubleBoard && (s % 2 === 1) === (seat % 2 === 1)) continue;
              if (!isPlayerSeat(s, state)) continue;
              for (let pp = 0; pp < PIECES; pp++) {
                const pPos = state.pieces[s][pp];
                if (pPos >= 1 && pPos <= BOARD_SIZE && globalPos(s, pPos) === gPos) thisCapture = true;
              }
            }
          }
        }
        applyMove(state.pieces, seat, pick, newPos, ts, doubleBoard);
        piecesMoved = true; moved = true;
        if (thisCapture) capturedPlayer = true;
        if (isAITeamWon(state.pieces, seat, state)) {
          state.finished = true; state.playerWon = false;
          return { dice: firstDice, dice1: firstD1, dice2: firstD2, moved, capturedPlayer };
        }
      }
    }

    // Extra turn: rolled 6 OR killed a player piece (local rules, cap at 3)
    if (state.localRules && (hasSix || thisCapture) && piecesMoved && extraTurns < 3) {
      extraTurns++;
    } else {
      extraTurns = 0;
      state.currentSeat = (seat + 1) % ts;
    }
  }

  return { dice: firstDice, dice1: firstD1, dice2: firstD2, moved, capturedPlayer };
}

// ── Public API ────────────────────────────────────────────────────────────

export function performRoll(state: GameState): { state: GameState; dice: number; dice1: number; dice2: number } {
  const d1   = rollOneDie();
  const d2   = state.localRules ? rollOneDie() : 0;
  const dice = state.localRules ? d1 + d2 : d1;
  return {
    state: { ...state, lastDice: dice, dice1: d1, dice2: d2, diceRolled: true },
    dice,
    dice1: d1,
    dice2: d2,
  };
}

export function performMove(
  state: GameState,
  pieceIdx: number,
): { state: GameState; valid: boolean; captured: boolean } {
  const activeSeat  = state.currentSeat;
  const bounceBack  = state.localRules;
  const hasSix      = state.localRules ? (state.dice1 === 6 && state.dice2 === 6) : (state.lastDice === 6);
  const doubleBoard = state.localRules && state.aiCount === 1;

  if (!state.diceRolled || !isPlayerSeat(activeSeat, state) || state.finished)
    return { state, valid: false, captured: false };

  const pos = state.pieces[activeSeat][pieceIdx];
  if (!isPieceMovable(pos, state.lastDice, hasSix, bounceBack))
    return { state, valid: false, captured: false };

  const newPos = calcNewPos(pos, state.lastDice, bounceBack);
  const ts     = getTotalSeats(state);
  const next   = deepCopy(state);

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

  applyMove(next.pieces, activeSeat, pieceIdx, newPos, ts, doubleBoard);
  next.diceRolled = false;

  // Extra turn: rolled 6 OR captured an opponent (local rules only)
  if (state.localRules && (hasSix || captured)) {
    next.currentSeat = activeSeat;
  } else {
    next.currentSeat = (activeSeat + 1) % ts;
  }

  if (isPlayerTeamWon(next.pieces, next)) {
    next.finished = true; next.playerWon = true;
  }

  return { state: next, valid: true, captured };
}

export function advanceAI(
  state: GameState,
): { state: GameState; aiDice: number; aiDice1: number; aiDice2: number; moved: boolean; capturedPlayer: boolean } {
  if (state.finished) return { state, aiDice: 0, aiDice1: 0, aiDice2: 0, moved: false, capturedPlayer: false };
  const next = deepCopy(state);
  const { dice: aiDice, dice1: aiDice1, dice2: aiDice2, moved, capturedPlayer } = runAITurnsTracked(next);
  return { state: next, aiDice, aiDice1, aiDice2, moved, capturedPlayer };
}

export function skipTurn(state: GameState): GameState {
  const next = deepCopy(state);
  next.diceRolled  = false;
  next.currentSeat = (state.currentSeat + 1) % getTotalSeats(state);
  return next;
}
