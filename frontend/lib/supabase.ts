import { createClient } from "@supabase/supabase-js";

// These are public anon keys — safe to expose in client code.
// Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your Vercel env vars.
const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = url && key ? createClient(url, key) : null;

// ── PvP channel message types ─────────────────────────────────────────────
export type PvpMsg =
  | { type: "ready";     seat: number; address: string }
  | { type: "roll";      seat: number; dice: number }
  | { type: "move";      seat: number; piece: number }
  | { type: "skip";      seat: number }
  | { type: "game_over"; winner: number };

export function pvpChannel(gameId: bigint) {
  if (!supabase) return null;
  return supabase.channel(`pvp-${gameId.toString()}`, {
    config: { broadcast: { self: false } },
  });
}
