"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { PADI_ADDRESS, PADI_ABI } from "@/lib/contracts";
import { BOARD_PATH, homeStretchCoords, yardCoords } from "@/lib/ludo";

/* ─── Constants ───────────────────────────────────────────────────── */
const COLORS = ["#EF4B3C", "#1FA85C", "#3D6BFF", "#F2A916"];
const NAMES  = ["You", "Chidi", "Amaka", "Tunde"];
const SEAT_OFFSET = [0, 13, 26, 39];
const SAFE_GLOBAL = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const START_SEAT: Record<number, number> = { 0: 0, 13: 1, 26: 2, 39: 3 };
const QUAD_C: Record<string, number> = { "6,8": 0, "6,6": 1, "8,6": 2, "8,8": 3 };

const AI_TALK: Record<string, string[][]> = {
  roll: [[], ["I dey come o!", "Watch my hand.", "Small small now."], ["You no ready!", "Na me dey reign today."], ["Oya na.", "Sharp sharp!"]],
  capture: [[], ["I don catch you!", "Go back house!"], ["Carry go base, joor!", "No vex o."], ["Sorry, no sorry!", "Reset! haha."]],
};

// Build lookup maps
const PATH_MAP = new Map<string, number>();
BOARD_PATH.forEach(([c, r], i) => PATH_MAP.set(`${c},${r}`, i));

const HS_MAP = new Map<string, number>();
const HSTRETCH: [number, number][][] = [
  [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
  [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
];
HSTRETCH.forEach((arr, s) => arr.forEach(([c, r]) => HS_MAP.set(`${c},${r}`, s)));

/* ─── Helpers ─────────────────────────────────────────────────────── */
function alpha(hex: string, a: number) {
  return hex + Math.round(a * 255).toString(16).padStart(2, "0");
}

function getCellBg(row: number, col: number, totalSeats: number): string {
  const key = `${col},${row}`;

  const hsSeat = HS_MAP.get(key);
  if (hsSeat !== undefined && hsSeat < totalSeats) return alpha(COLORS[hsSeat], 0.5);

  const inCenter = row >= 6 && row <= 8 && col >= 6 && col <= 8;
  if (inCenter) {
    if (col === 7 && row === 7) return "#120a05";
    const qs = QUAD_C[key];
    return qs !== undefined && qs < totalSeats ? alpha(COLORS[qs], 0.34) : "#120a05";
  }

  const pi = PATH_MAP.get(key);
  if (pi !== undefined) {
    const ss = START_SEAT[pi];
    if (ss !== undefined && ss < totalSeats) return alpha(COLORS[ss], 0.55);
    return "#F0DFBC";
  }

  if (row <= 5 && col <= 5) return alpha(COLORS[1], 0.16);
  if (row <= 5 && col >= 9) return alpha(COLORS[2], 0.16);
  if (row >= 9 && col <= 5) return alpha(COLORS[0], 0.16);
  if (row >= 9 && col >= 9) return alpha(COLORS[3], 0.16);
  return "rgba(255,238,214,.03)";
}

function canMovePiece(rel: number, dice: number): boolean {
  if (rel === 59) return false;
  if (rel === 0) return dice === 6;
  const next = rel === 0 ? 1 : rel + dice;
  if (rel > 52 && next > 59) return false;
  return true;
}

type PieceInfo = { seat: number; pieceIdx: number; rel: number };

function buildPieceMap(pieces: readonly (readonly number[])[], totalSeats: number): Map<string, PieceInfo[]> {
  const map = new Map<string, PieceInfo[]>();
  for (let s = 0; s < totalSeats; s++) {
    for (let i = 0; i < 4; i++) {
      const rel = Number(pieces[s]?.[i] ?? 0);
      let cr: [number, number] | null = null;
      if (rel === 0) {
        cr = yardCoords(s, i);
      } else if (rel >= 1 && rel <= 52) {
        cr = BOARD_PATH[(SEAT_OFFSET[s] + rel - 1) % 52] || [7, 7];
      } else if (rel >= 53 && rel <= 58) {
        cr = homeStretchCoords(s, rel - 52);
      }
      // rel === 59 → home, skip
      if (!cr) continue;
      const [c, r] = cr;
      const key = `${c},${r}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ seat: s, pieceIdx: i, rel });
    }
  }
  return map;
}

/* ─── Board Component ─────────────────────────────────────────────── */
function Board({ pieces, totalSeats, canMove, dice, onMove }: {
  pieces: readonly (readonly number[])[];
  totalSeats: number;
  canMove: boolean;
  dice: number;
  onMove: (idx: number) => void;
}) {
  const pieceMap = buildPieceMap(pieces, totalSeats);
  const cells = [];

  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const key = `${c},${r}`;
      const here = pieceMap.get(key);
      const bg = getCellBg(r, c, totalSeats);
      const pi = PATH_MAP.get(key);
      const isSafe = pi !== undefined && SAFE_GLOBAL.has(pi) && !(pi in START_SEAT);
      const isCenter = c === 7 && r === 7;

      let inner: React.ReactNode = null;

      if (here && here.length > 0) {
        const top = here[here.length - 1];
        const col = COLORS[top.seat];
        const movable = canMove && top.seat === 0 && canMovePiece(top.rel, dice);
        const clickIdx = movable ? here.find((p) => p.seat === 0 && canMovePiece(p.rel, dice))?.pieceIdx ?? -1 : -1;

        inner = (
          <button
            onClick={movable && clickIdx >= 0 ? () => onMove(clickIdx) : undefined}
            style={{
              position: "absolute",
              width: "82%", height: "82%",
              borderRadius: "50%",
              border: "1px solid rgba(0,0,0,.3)",
              padding: 0,
              cursor: movable ? "pointer" : "default",
              background: `radial-gradient(circle at 34% 30%, rgba(255,255,255,.82), ${col} 58%)`,
              boxShadow: movable ? `0 0 0 2px #fff, 0 0 9px 2px ${col}` : "0 2px 3px rgba(0,0,0,.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: movable ? "pulseRing 1.1s infinite" : "none",
              zIndex: 2,
            }}>
            {here.length > 1 && (
              <span style={{ fontSize: "8px", fontWeight: 800, color: "#fff" }}>{here.length}</span>
            )}
          </button>
        );
      } else if (isCenter) {
        inner = <span style={{ color: "#F2A916", fontSize: "13px", lineHeight: 1 }}>★</span>;
      } else if (isSafe) {
        inner = <span style={{ color: "#b89863", fontSize: "9px", lineHeight: 1 }}>★</span>;
      }

      cells.push(
        <div key={key} style={{ position: "relative", background: bg, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "2px" }}>
          {inner}
        </div>
      );
    }
  }

  return (
    <div style={{ width: "100%", aspectRatio: "1 / 1", display: "grid", gridTemplateColumns: "repeat(15, 1fr)", gridTemplateRows: "repeat(15, 1fr)", gap: "1px", padding: "7px", background: "#241710", borderRadius: "18px", border: "1px solid rgba(247,179,43,.18)", boxShadow: "0 20px 50px -22px rgba(0,0,0,.85)" }}>
      {cells}
    </div>
  );
}

/* ─── Die Element ────────────────────────────────────────────────── */
const DOT_POSITIONS: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

function Die({ face, rolling }: { face: number; rolling: boolean }) {
  const on = new Set(DOT_POSITIONS[face] ?? [4]);
  return (
    <div style={{ width: "54px", height: "54px", flexShrink: 0, borderRadius: "14px", background: "linear-gradient(145deg,#fff,#efe1c9)", boxShadow: "0 6px 14px -4px rgba(0,0,0,.6),inset 0 -3px 4px rgba(0,0,0,.1)", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr 1fr", padding: "9px", animation: rolling ? "diceShake .2s infinite" : "none" }}>
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          {on.has(i) && <div style={{ width: "62%", height: "62%", borderRadius: "50%", background: "#22150a" }} />}
        </div>
      ))}
    </div>
  );
}

/* ─── Seats Display ──────────────────────────────────────────────── */
function SeatsRow({ pieces, totalSeats, currentSeat, gameState }: {
  pieces: readonly (readonly number[])[];
  totalSeats: number;
  currentSeat: number;
  gameState: number;
}) {
  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      {Array.from({ length: totalSeats }, (_, s) => {
        const active = currentSeat === s && gameState === 0;
        const home = pieces[s]?.filter((x) => Number(x) === 59).length ?? 0;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 13px 7px 7px", borderRadius: "999px", background: active ? alpha(COLORS[s], 0.17) : "rgba(255,238,214,.04)", border: `1px solid ${active ? COLORS[s] : "rgba(255,238,214,.08)"}` }}>
            <div style={{ width: "27px", height: "27px", borderRadius: "50%", background: `radial-gradient(circle at 35% 30%,rgba(255,255,255,.65),${COLORS[s]} 62%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 800, color: "#fff", fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", boxShadow: active ? `0 0 11px ${COLORS[s]}` : "none" }}>
              {NAMES[s][0]}
            </div>
            <div style={{ lineHeight: 1.15 }}>
              <span style={{ display: "block", fontSize: "12px", fontWeight: 700, color: active ? "#FBEFE0" : "#A8927C" }}>{NAMES[s]}</span>
              <span style={{ display: "block", fontSize: "10px", color: "#7d6a58" }}>{home}/4 home</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Piece Buttons ──────────────────────────────────────────────── */
function PiecesRow({ playerPieces, dice, onMove }: { playerPieces: readonly number[]; dice: number; onMove: (i: number) => void }) {
  const labels = (rel: number) => rel === 0 ? "Yard" : rel === 59 ? "Home" : rel > 52 ? `Home ${rel - 52}` : `Sq ${rel}`;
  return (
    <div style={{ display: "flex", gap: "8px" }}>
      {Array.from({ length: 4 }, (_, i) => {
        const rel = Number(playerPieces[i] ?? 0);
        const movable = canMovePiece(rel, dice);
        return (
          <button key={i} onClick={movable ? () => onMove(i) : undefined} disabled={!movable} style={{ flex: 1, padding: "11px 4px", borderRadius: "13px", cursor: movable ? "pointer" : "default", background: movable ? "linear-gradient(135deg,#F2622E,#EF4B3C)" : "rgba(255,238,214,.05)", color: movable ? "#fff" : "#7d6a58", fontWeight: 700, border: movable ? "none" : "1px solid rgba(255,238,214,.08)", boxShadow: movable ? "0 8px 18px -8px rgba(239,75,60,.8)" : "none", animation: movable ? "glowPulse 1.6s infinite" : "none" }}>
            <div style={{ fontSize: "10px", opacity: 0.75, fontWeight: 600 }}>Piece {i + 1}</div>
            <div style={{ fontSize: "14px", marginTop: "2px" }}>{labels(rel)}</div>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */
export default function GameBoard({ gameId, onBack, onGameEnd, showToast }: {
  gameId: bigint;
  onBack: () => void;
  onGameEnd: (won: boolean) => void;
  showToast: (text: string, color: string) => void;
}) {
  const { address } = useAccount();
  const contract = PADI_ADDRESS;

  const { data: game, refetch } = useReadContract({
    address: contract,
    abi: PADI_ABI,
    functionName: "getGame",
    args: [gameId],
    query: { refetchInterval: 3000 },
  });

  const { writeContract: roll, data: rollTx } = useWriteContract();
  const { writeContract: move, data: moveTx } = useWriteContract();
  const { isLoading: rollPending } = useWaitForTransactionReceipt({ hash: rollTx });
  const { isLoading: movePending } = useWaitForTransactionReceipt({ hash: moveTx });
  const txPending = rollPending || movePending;

  // Die animation state
  const [dieFace, setDieFace] = useState(6);
  const [rolling, setRolling] = useState(false);
  const [gameEndFired, setGameEndFired] = useState(false);

  if (!game) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "200px", gap: "12px" }}>
        <div style={{ width: "32px", height: "32px", borderRadius: "50%", border: "3px solid rgba(242,169,22,.3)", borderTopColor: "#F2A916", animation: "spin .8s linear infinite" }} />
        <p style={{ color: "#A8927C", fontSize: "14px" }}>Loading game…</p>
      </div>
    );
  }

  const [, pieces, aiCount, currentSeat, lastDice, diceRolled, state, wager, winner] = game as unknown as [
    `0x${string}`,
    readonly (readonly number[])[],
    number, number, number, boolean, number, bigint, `0x${string}`
  ];

  const totalSeats = 1 + aiCount;
  const isMyTurn = currentSeat === 0 && state === 0;
  const canRollNow = isMyTurn && !diceRolled && !txPending && !rolling;
  const canMoveNow = isMyTurn && diceRolled && !txPending;
  const playerPieces = pieces[0] ?? [];

  // Fire game end once
  if (state === 1 && !gameEndFired) {
    const didWin = winner?.toLowerCase() === address?.toLowerCase();
    // Use a deferred call to avoid state update during render
    setTimeout(() => {
      setGameEndFired(true);
      onGameEnd(didWin);
    }, 800);
  }

  function doRoll() {
    if (!canRollNow) return;
    setRolling(true);
    let t = 0;
    const timer = setInterval(() => {
      t++;
      setDieFace(1 + Math.floor(Math.random() * 6));
      if (t >= 7) {
        clearInterval(timer);
        setRolling(false);
        roll({ address: contract, abi: PADI_ABI, functionName: "rollDice", args: [gameId] });
        setTimeout(() => refetch(), 2500);
      }
    }, 80);
  }

  function doMove(pieceIdx: number) {
    if (!canMoveNow) return;
    move({ address: contract, abi: PADI_ABI, functionName: "movePiece", args: [gameId, pieceIdx] });
    setTimeout(() => refetch(), 3500);
  }

  const displayFace = diceRolled ? lastDice : dieFace;
  const statusText = txPending
    ? "Transaction pending…"
    : state === 1
    ? winner !== "0x0000000000000000000000000000000000000000"
      ? winner?.toLowerCase() === address?.toLowerCase() ? "You win! 🎉" : "AI padi wins"
      : "Game over"
    : isMyTurn
    ? canRollNow ? "Your turn — roll the dice" : `Rolled ${lastDice} — pick a piece`
    : `${NAMES[currentSeat] ?? "AI"} is rolling…`;

  const randomTalk = (seat: number, kind: string) => {
    const arr = (AI_TALK[kind] ?? [])[seat] ?? [];
    return arr[Math.floor(Math.random() * arr.length)] ?? "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px", paddingTop: "2px" }}>

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={onBack} style={{ background: "rgba(255,238,214,.06)", border: "1px solid rgba(247,179,43,.12)", color: "#C9B49C", fontSize: "13px", fontWeight: 600, borderRadius: "999px", padding: "7px 13px", cursor: "pointer" }}>
          ← Leave
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {wager > 0n && (
            <span style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(242,169,22,.13)", border: "1px solid rgba(242,169,22,.3)", borderRadius: "999px", padding: "5px 11px", color: "#F4C95A", fontWeight: 800, fontSize: "12px" }}>
              ★ {(Number(wager) / 1e18).toFixed(2)} USDM
            </span>
          )}
          <span style={{ color: "#6f5d4c", fontSize: "12px", fontWeight: 600 }}>Game #{gameId.toString()}</span>
        </div>
      </div>

      {/* Seats */}
      <SeatsRow pieces={pieces} totalSeats={totalSeats} currentSeat={currentSeat} gameState={state} />

      {/* AI speaker bubble (when it's not our turn and there's an active turn) */}
      {currentSeat > 0 && state === 0 && (
        <div style={{ display: "flex" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "9px", background: "rgba(255,238,214,.05)", border: "1px solid rgba(247,179,43,.12)", borderRadius: "999px", padding: "5px 14px 5px 5px" }}>
            <span style={{ width: "25px", height: "25px", borderRadius: "50%", background: COLORS[currentSeat], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "11px", fontWeight: 800, boxShadow: `0 0 8px ${COLORS[currentSeat]}` }}>
              {NAMES[currentSeat][0]}
            </span>
            <span style={{ color: "#F2DFC6", fontSize: "13px", fontWeight: 600, fontStyle: "italic" }}>
              &ldquo;{randomTalk(currentSeat, diceRolled ? "capture" : "roll")}&rdquo;
            </span>
          </div>
        </div>
      )}

      {/* Board */}
      <Board pieces={pieces} totalSeats={totalSeats} canMove={canMoveNow} dice={lastDice} onMove={doMove} />

      {/* Dice + Roll button */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", background: "rgba(255,238,214,.04)", border: "1px solid rgba(247,179,43,.12)", borderRadius: "18px", padding: "13px 15px" }}>
        <Die face={displayFace} rolling={rolling} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#FBEFE0", lineHeight: 1.3 }}>{statusText}</p>
        </div>
        {canRollNow ? (
          <button onClick={doRoll} style={{ padding: "14px 22px", border: "none", borderRadius: "14px", background: "linear-gradient(135deg,#F2622E,#EF4B3C)", color: "#fff", fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "16px", cursor: "pointer", boxShadow: "0 10px 22px -8px rgba(239,75,60,.8)", animation: "glowPulse 1.8s infinite" }}>
            Roll
          </button>
        ) : (
          <div style={{ padding: "14px 18px", borderRadius: "14px", background: "rgba(255,238,214,.05)", border: "1px solid rgba(247,179,43,.1)", color: "#7d6a58", fontWeight: 700, fontSize: "13px" }}>
            {rolling ? "…" : canMoveNow ? "Pick" : txPending ? "⏳" : "Wait"}
          </div>
        )}
      </div>

      {/* Piece picker */}
      {canMoveNow && (
        <div>
          <p style={{ margin: "0 0 8px", color: "#8c7866", fontSize: "12px", fontWeight: 600 }}>Tap a glowing piece — on the board or below</p>
          <PiecesRow playerPieces={playerPieces} dice={lastDice} onMove={doMove} />
        </div>
      )}

      {/* Game over card */}
      {state === 1 && (
        <div style={{ borderRadius: "20px", padding: "20px", textAlign: "center", background: winner?.toLowerCase() === address?.toLowerCase() ? "rgba(31,168,92,.12)" : "rgba(239,75,60,.1)", border: `1px solid ${winner?.toLowerCase() === address?.toLowerCase() ? "rgba(31,168,92,.4)" : "rgba(239,75,60,.3)"}` }}>
          <p style={{ margin: "0 0 4px", fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "22px", color: winner?.toLowerCase() === address?.toLowerCase() ? "#5BD08A" : "#EF4B3C" }}>
            {winner?.toLowerCase() === address?.toLowerCase() ? "You won! 🎉" : "AI padi wins"}
          </p>
          {wager > 0n && winner?.toLowerCase() === address?.toLowerCase() && (
            <p style={{ margin: "4px 0 0", color: "#8FB99B", fontSize: "14px" }}>{(Number(wager) * 0.99 / 1e18).toFixed(4)} USDM returned</p>
          )}
          <button onClick={onBack} style={{ marginTop: "14px", background: "rgba(255,238,214,.08)", border: "1px solid rgba(247,179,43,.18)", borderRadius: "999px", padding: "10px 20px", color: "#D8C4AC", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}>
            Back to lobby
          </button>
        </div>
      )}
    </div>
  );
}
