"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { PADI_ADDRESS, PADI_ABI, ERC20_ABI, USDM_ADDRESS } from "@/lib/contracts";
import { pvpChannel, type PvpMsg } from "@/lib/supabase";
import { BOARD_PATH, homeStretchCoords, yardCoords } from "@/lib/ludo";
import {
  createInitialState, performRoll, performMove, skipTurn,
  hasValidMove, isPieceMovable, isAllFinished,
  type GameState, type AllPieces,
  FINISHED_POS,
} from "@/lib/game-engine";

const COLORS = ["#EF4B3C", "#1FA85C", "#3D6BFF", "#F2A916"];
const NAMES  = ["You", "Padi", "Amaka", "Tunde"];
const SEAT_OFFSET = [0, 13, 26, 39];
const SAFE_GLOBAL = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const START_SEAT: Record<number, number> = { 0: 0, 13: 1, 26: 2, 39: 3 };
const QUAD_C: Record<string, number> = { "6,8": 0, "6,6": 1, "8,6": 2, "8,8": 3 };

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

function alpha(hex: string, a: number) { return hex + Math.round(a * 255).toString(16).padStart(2, "0"); }

function getCellBg(row: number, col: number): string {
  const key = `${col},${row}`;
  const hsSeat = HS_MAP.get(key);
  if (hsSeat !== undefined && hsSeat < 2) return alpha(COLORS[hsSeat], 0.5);
  const inCenter = row >= 6 && row <= 8 && col >= 6 && col <= 8;
  if (inCenter) {
    if (col === 7 && row === 7) return "#120a05";
    const qs = QUAD_C[key];
    return qs !== undefined && qs < 2 ? alpha(COLORS[qs], 0.34) : "#120a05";
  }
  const pi = PATH_MAP.get(key);
  if (pi !== undefined) {
    const ss = START_SEAT[pi];
    if (ss !== undefined && ss < 2) return alpha(COLORS[ss], 0.55);
    return "#F0DFBC";
  }
  if (row <= 5 && col <= 5) return alpha(COLORS[1], 0.16);
  if (row <= 5 && col >= 9) return alpha(COLORS[2], 0.16);
  if (row >= 9 && col <= 5) return alpha(COLORS[0], 0.16);
  if (row >= 9 && col >= 9) return alpha(COLORS[3], 0.16);
  return "rgba(255,238,214,.03)";
}

type PieceInfo = { seat: number; pieceIdx: number; rel: number };

function buildPieceMap(pieces: readonly (readonly number[])[]): Map<string, PieceInfo[]> {
  const map = new Map<string, PieceInfo[]>();
  for (let s = 0; s < 2; s++) {
    for (let i = 0; i < 4; i++) {
      const rel = Number(pieces[s]?.[i] ?? 0);
      let cr: [number, number] | null = null;
      if (rel === 0) {
        const yc = yardCoords(s, i); if (yc) cr = yc;
      } else if (rel === FINISHED_POS) {
        const hc = homeStretchCoords(s, 5); if (hc) cr = hc;
      } else if (rel > 52) {
        const hc = homeStretchCoords(s, rel - 53); if (hc) cr = hc;
      } else {
        const global = (SEAT_OFFSET[s] + rel - 1) % 52;
        const bp = BOARD_PATH[global]; if (bp) cr = [bp[0], bp[1]];
      }
      if (cr) {
        const k = `${cr[0]},${cr[1]}`;
        const arr = map.get(k) ?? [];
        arr.push({ seat: s, pieceIdx: i, rel });
        map.set(k, arr);
      }
    }
  }
  return map;
}

function Board({ pieces, canMove, dice, onMove, mySeat }: {
  pieces: readonly (readonly number[])[];
  canMove: boolean; dice: number; onMove: (i: number) => void; mySeat: number;
}) {
  const pieceMap = buildPieceMap(pieces);
  const cells: React.ReactNode[] = [];
  for (let row = 0; row < 15; row++) {
    for (let col = 0; col < 15; col++) {
      const bg = getCellBg(row, col);
      const key = `${col},${row}`;
      const here = pieceMap.get(key) ?? [];
      const isStar = SAFE_GLOBAL.has(PATH_MAP.get(key) ?? -1);
      let inner: React.ReactNode = null;
      if (here.length > 0) {
        const stackOffset = here.length > 1;
        inner = (
          <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {here.map((p, pi) => {
              const movable = canMove && p.seat === mySeat && isPieceMovable(p.rel, dice);
              return (
                <button key={`${p.seat}-${p.pieceIdx}`} onClick={movable ? () => onMove(p.pieceIdx) : undefined}
                  style={{ position: stackOffset ? "absolute" : "relative", left: stackOffset ? `${pi * 5}px` : undefined, width: "82%", height: "82%", borderRadius: "50%", border: movable ? "2px solid #fff" : "1px solid rgba(0,0,0,.3)", background: `radial-gradient(circle at 35% 30%,rgba(255,255,255,.65),${COLORS[p.seat]} 62%)`, cursor: movable ? "pointer" : "default", padding: 0, boxShadow: movable ? `0 0 8px ${COLORS[p.seat]}, 0 0 16px ${COLORS[p.seat]}` : "0 2px 4px rgba(0,0,0,.4)", animation: movable ? "pulseRing 1.5s ease-in-out infinite" : "none" }} />
              );
            })}
          </div>
        );
      } else if (isStar) {
        inner = <span style={{ color: "#F2A916", fontSize: "13px", lineHeight: 1 }}>★</span>;
      }
      cells.push(
        <div key={key} style={{ position: "relative", background: bg, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "2px" }}>
          {inner}
        </div>
      );
    }
  }
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
      <div style={{ width: "100%", aspectRatio: "1 / 1", display: "grid", gridTemplateColumns: "repeat(15, 1fr)", gridTemplateRows: "repeat(15, 1fr)", gap: "1px", padding: "7px", background: "#241710", borderRadius: "18px", border: "1px solid rgba(247,179,43,.18)", boxShadow: "0 20px 50px -22px rgba(0,0,0,.85)" }}>
        {cells}
      </div>
    </motion.div>
  );
}

const DOT_POSITIONS: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};
function Die({ face, rolling }: { face: number; rolling: boolean }) {
  const on = new Set(DOT_POSITIONS[face] ?? [4]);
  return (
    <div style={{ width: "clamp(44px,13vw,56px)", height: "clamp(44px,13vw,56px)", flexShrink: 0, borderRadius: "14px", background: "linear-gradient(145deg,#fff,#efe1c9)", boxShadow: "0 6px 14px -4px rgba(0,0,0,.6),inset 0 -3px 4px rgba(0,0,0,.1)", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr 1fr", padding: "clamp(6px,2.2vw,10px)", animation: rolling ? "diceShake .2s infinite" : "none" }}>
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          {on.has(i) && <div style={{ width: "62%", height: "62%", borderRadius: "50%", background: "#22150a" }} />}
        </div>
      ))}
    </div>
  );
}

/* ─── PvP Game Board ─────────────────────────────────────────────── */
export interface PvpMeta {
  gameId: bigint;
  mySeat: 0 | 1;          // 0 = player1 (creator), 1 = player2 (joiner)
  wager: bigint;
  opponentAddress: string;
}

export default function PvPGameBoard({ meta, onBack, onGameEnd, showToast }: {
  meta: PvpMeta;
  onBack: () => void;
  onGameEnd: (won: boolean) => void;
  showToast: (text: string, color: string) => void;
}) {
  const { address } = useAccount();
  const { gameId, mySeat, wager, opponentAddress } = meta;

  const [gs, setGs] = useState<GameState>(() => createInitialState(1));
  const [dieFace, setDieFace]   = useState(1);
  const [rolling, setRolling]   = useState(false);
  const [opOnline, setOpOnline] = useState(false);
  const [settled, setSettled]   = useState(false);

  const channel = useRef(pvpChannel(gameId));
  const gsRef   = useRef(gs);
  gsRef.current = gs;

  // ── On-chain claim/finalise ─────────────────────────────────────────────
  const { writeContract: writeClaim,    data: claimTx }    = useWriteContract();
  const { writeContract: writeFinalise, data: finaliseTx } = useWriteContract();
  const { isSuccess: claimOk }    = useWaitForTransactionReceipt({ hash: claimTx });
  const { isSuccess: finaliseOk } = useWaitForTransactionReceipt({ hash: finaliseTx });

  useEffect(() => {
    if (claimOk)    showToast("Win claimed — waiting for confirmation window…", "#F2A916");
  }, [claimOk]);
  useEffect(() => {
    if (finaliseOk) { showToast("Payout confirmed! 🎉", "#1FA85C"); setSettled(true); onGameEnd(true); }
  }, [finaliseOk]);

  // ── Supabase channel setup ──────────────────────────────────────────────
  const broadcast = useCallback((msg: PvpMsg) => {
    channel.current?.send({ type: "broadcast", event: "pvp", payload: msg });
  }, []);

  useEffect(() => {
    const ch = channel.current;
    if (!ch) return;

    ch.on("broadcast", { event: "pvp" }, ({ payload }: { payload: PvpMsg }) => {
      applyRemoteMsg(payload);
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      setOpOnline(Object.keys(state).length >= 2);
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ seat: mySeat, address });
        broadcast({ type: "ready", seat: mySeat, address: address ?? "" });
      }
    });

    return () => { ch.unsubscribe(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function applyRemoteMsg(msg: PvpMsg) {
    const cur = gsRef.current;
    if (msg.type === "ready") { setOpOnline(true); return; }
    if (msg.type === "game_over") {
      const won = msg.winner === mySeat;
      if (!won) onGameEnd(false);
      return;
    }
    if (msg.seat === mySeat) return; // ignore echoes of own messages

    if (msg.type === "roll") {
      // Opponent rolled — apply the specific dice value they sent
      setGs(prev => ({ ...prev, lastDice: msg.dice, diceRolled: true, currentSeat: msg.seat }));
      setDieFace(msg.dice);
    }
    if (msg.type === "move") {
      setGs(prev => {
        const { state: next } = performMove({ ...prev, currentSeat: msg.seat }, msg.piece);
        return next;
      });
    }
    if (msg.type === "skip") {
      setGs(prev => skipTurn({ ...prev, currentSeat: msg.seat }));
    }
  }

  // ── My turn handlers ────────────────────────────────────────────────────
  const isMyTurn   = gs.currentSeat === mySeat && !gs.finished;
  const canRollNow = isMyTurn && !gs.diceRolled && !rolling;
  const canMoveNow = isMyTurn && gs.diceRolled;
  const displayFace = gs.diceRolled ? gs.lastDice : dieFace;

  function doRoll() {
    if (!canRollNow) return;
    setRolling(true);
    let t = 0;
    const timer = setInterval(() => {
      t++;
      const face = 1 + Math.floor(Math.random() * 6);
      setDieFace(face);
      if (t >= 7) {
        clearInterval(timer);
        const { state: next, dice } = performRoll(gs);
        setDieFace(dice);
        setRolling(false);
        broadcast({ type: "roll", seat: mySeat, dice });
        if (!hasValidMove(next.pieces[mySeat], dice)) {
          broadcast({ type: "skip", seat: mySeat });
          const skipped = skipTurn(next);
          setGs(skipped);
        } else {
          setGs(next);
        }
      }
    }, 80);
  }

  function doMove(pieceIdx: number) {
    if (!canMoveNow) return;
    const { state: next, valid } = performMove(gs, pieceIdx);
    if (!valid) { showToast("Can't move that piece.", "#F2A916"); return; }
    broadcast({ type: "move", seat: mySeat, piece: pieceIdx });
    setGs(next);
    if (next.finished) handleGameEnd(next);
  }

  function handleGameEnd(finalState: GameState) {
    const myPieces = finalState.pieces[mySeat];
    const won = myPieces.every(p => Number(p) === FINISHED_POS);
    broadcast({ type: "game_over", winner: won ? mySeat : 1 - mySeat });
    if (won) {
      showToast("You won! Claiming on-chain…", "#1FA85C");
      writeClaim({ address: PADI_ADDRESS, abi: PADI_ABI, functionName: "claimPvpWin", args: [gameId] });
      onGameEnd(true);
    } else {
      showToast("Your padi wins this round.", "#EF4B3C");
      onGameEnd(false);
    }
  }

  // Watch for game end from state changes
  useEffect(() => {
    if (gs.finished) handleGameEnd(gs);
  }, [gs.finished]); // eslint-disable-line react-hooks/exhaustive-deps

  const oppShort = `${opponentAddress.slice(0, 6)}…${opponentAddress.slice(-4)}`;
  const seatNames = mySeat === 0 ? ["You", oppShort] : [oppShort, "You"];

  let statusText = "";
  if (gs.finished) {
    statusText = "Game over!";
  } else if (!opOnline) {
    statusText = "Waiting for opponent…";
  } else if (isMyTurn) {
    statusText = canRollNow ? "Your turn — roll the dice" : `Rolled ${gs.lastDice} — pick a piece`;
  } else {
    statusText = `${seatNames[gs.currentSeat === mySeat ? 1 - mySeat : gs.currentSeat]} is thinking…`;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px", paddingTop: "2px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={onBack} style={{ background: "rgba(255,238,214,.06)", border: "1px solid rgba(247,179,43,.12)", color: "#C9B49C", fontSize: "13px", fontWeight: 600, borderRadius: "999px", padding: "7px 13px", cursor: "pointer" }}>
          ← Leave
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {wager > 0n && (
            <span style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(242,169,22,.13)", border: "1px solid rgba(242,169,22,.3)", borderRadius: "999px", padding: "5px 11px", color: "#F4C95A", fontWeight: 800, fontSize: "12px" }}>
              ★ {(Number(wager) / 1e18).toFixed(2)} USDM each
            </span>
          )}
          <span style={{ color: "#6f5d4c", fontSize: "12px", fontWeight: 600 }}>PvP #{gameId.toString()}</span>
        </div>
      </div>

      {/* Players row */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div style={{ display: "flex", gap: "8px" }}>
          {[0, 1].map((s) => {
            const isMe = s === mySeat;
            const active = gs.currentSeat === s && !gs.finished;
            const name = isMe ? "You" : oppShort;
            const online = isMe ? true : opOnline;
            return (
              <motion.div key={s} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: s * 0.08, duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 13px 7px 7px", borderRadius: "999px", flex: 1, background: active ? alpha(COLORS[s], 0.17) : "rgba(255,238,214,.04)", border: `1px solid ${active ? COLORS[s] : "rgba(255,238,214,.08)"}` }}>
                <div style={{ width: "27px", height: "27px", borderRadius: "50%", background: `radial-gradient(circle at 35% 30%,rgba(255,255,255,.65),${COLORS[s]} 62%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 800, color: "#fff", boxShadow: active ? `0 0 11px ${COLORS[s]}` : "none", flexShrink: 0 }}>
                  {name[0].toUpperCase()}
                </div>
                <div style={{ lineHeight: 1.15, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: "12px", fontWeight: 700, color: active ? "#FBEFE0" : "#A8927C", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                  <span style={{ display: "block", fontSize: "10px", color: online ? "#1FA85C" : "#7d6a58" }}>{online ? "online" : "connecting…"}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Board */}
      <Board pieces={gs.pieces} canMove={canMoveNow} dice={gs.lastDice} onMove={doMove} mySeat={mySeat} />

      {/* Dice + status */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, delay: 0.1 }}
        style={{ display: "flex", alignItems: "center", gap: "14px", background: "rgba(255,238,214,.04)", border: "1px solid rgba(247,179,43,.12)", borderRadius: "18px", padding: "13px 15px" }}>
        <Die face={displayFace} rolling={rolling} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#FBEFE0", lineHeight: 1.3 }}>{statusText}</p>
          {!gs.finished && (
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#6f5d4c" }}>Moves sync live via Supabase Realtime</p>
          )}
        </div>
        {canRollNow ? (
          <motion.button onClick={doRoll} whileTap={{ scale: 0.93 }}
            style={{ padding: "14px 22px", border: "none", borderRadius: "14px", background: "linear-gradient(135deg,#F2622E,#EF4B3C)", color: "#fff", fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "16px", cursor: "pointer", boxShadow: "0 10px 22px -8px rgba(239,75,60,.8)", animation: "glowPulse 1.8s infinite" }}>
            Roll
          </motion.button>
        ) : (
          <div style={{ padding: "14px 18px", borderRadius: "14px", background: "rgba(255,238,214,.05)", border: "1px solid rgba(247,179,43,.1)", color: "#7d6a58", fontWeight: 700, fontSize: "13px" }}>
            {rolling ? "…" : canMoveNow ? "Pick" : "Wait"}
          </div>
        )}
      </motion.div>

      {/* Piece picker (my turn only) */}
      <AnimatePresence>
        {canMoveNow && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.28 }}>
            <p style={{ margin: "0 0 8px", color: "#8c7866", fontSize: "12px", fontWeight: 600 }}>Tap a glowing piece — on the board or below</p>
            <div style={{ display: "flex", gap: "8px" }}>
              {Array.from({ length: 4 }, (_, i) => {
                const rel = Number(gs.pieces[mySeat]?.[i] ?? 0);
                const movable = isPieceMovable(rel, gs.lastDice);
                const label = rel === 0 ? "Yard" : rel === FINISHED_POS ? "Home" : rel > 52 ? `Home ${rel - 52}` : `Sq ${rel}`;
                return (
                  <motion.button key={i} onClick={movable ? () => doMove(i) : undefined} disabled={!movable}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                    whileHover={movable ? { scale: 1.05 } : {}} whileTap={movable ? { scale: 0.93 } : {}}
                    style={{ flex: 1, padding: "11px 4px", borderRadius: "13px", cursor: movable ? "pointer" : "default", background: movable ? "linear-gradient(135deg,#F2622E,#EF4B3C)" : "rgba(255,238,214,.05)", color: movable ? "#fff" : "#7d6a58", fontWeight: 700, border: movable ? "none" : "1px solid rgba(255,238,214,.08)", boxShadow: movable ? "0 8px 18px -8px rgba(239,75,60,.8)" : "none", animation: movable ? "glowPulse 1.6s infinite" : "none" }}>
                    <div style={{ fontSize: "10px", opacity: 0.75, fontWeight: 600 }}>Piece {i + 1}</div>
                    <div style={{ fontSize: "14px", marginTop: "2px" }}>{label}</div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Finalise button (after claim) */}
      {claimOk && !finaliseOk && !settled && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
          <div style={{ borderRadius: "18px", padding: "16px", background: "rgba(242,169,22,.1)", border: "1px solid rgba(242,169,22,.3)", textAlign: "center" }}>
            <p style={{ margin: "0 0 10px", color: "#F4C95A", fontWeight: 700, fontSize: "14px" }}>10-minute dispute window open</p>
            <motion.button onClick={() => writeFinalise({ address: PADI_ADDRESS, abi: PADI_ABI, functionName: "finalisePvpWin", args: [gameId] })} whileTap={{ scale: 0.97 }}
              style={{ width: "100%", padding: "13px", border: "none", borderRadius: "14px", background: "linear-gradient(135deg,#F2622E,#EF4B3C)", color: "#fff", fontWeight: 800, fontSize: "15px", cursor: "pointer" }}>
              Collect winnings →
            </motion.button>
            <p style={{ margin: "8px 0 0", color: "#8c7866", fontSize: "11px" }}>Opens after 10 min if opponent doesn't dispute</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
