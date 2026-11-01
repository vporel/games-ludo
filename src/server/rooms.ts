import "server-only";
import { randomInt } from "node:crypto";
import { TURN_DURATION_MS } from "@/game/constants";
import { GameState, standings } from "@/game/engine";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { GameRow, RoomPlayer, RoomSnapshot, RoomStatus } from "@/lib/types";

export class ConflictError extends Error {
  constructor() {
    super("La partie a changé entre-temps. Réessaie.");
  }
}

export type RoomRow = { id: string; code: string; host_id: string; status: RoomStatus };

export function rollDie(): number {
  return randomInt(1, 7);
}

export async function getProfilePseudo(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("ludo_profiles").select("pseudo").eq("id", userId).maybeSingle();
  return data?.pseudo ?? null;
}

export async function findActiveRoomByCode(code: string): Promise<RoomRow | null> {
  const { data } = await supabaseAdmin()
    .from("ludo_rooms")
    .select("id, code, host_id, status")
    .eq("code", code)
    .neq("status", "closed")
    .maybeSingle();
  return (data as RoomRow | null) ?? null;
}

export async function getRoom(roomId: string): Promise<RoomRow | null> {
  const { data } = await supabaseAdmin()
    .from("ludo_rooms")
    .select("id, code, host_id, status")
    .eq("id", roomId)
    .maybeSingle();
  return (data as RoomRow | null) ?? null;
}

export async function listPlayers(roomId: string): Promise<RoomPlayer[]> {
  const { data, error } = await supabaseAdmin()
    .from("ludo_room_players")
    .select("user_id, joined_at, left_at, ludo_profiles(pseudo)")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const profile = r.ludo_profiles as unknown as { pseudo: string } | { pseudo: string }[] | null;
    const pseudo = Array.isArray(profile) ? profile[0]?.pseudo : profile?.pseudo;
    return { userId: r.user_id, pseudo: pseudo ?? "?", joinedAt: r.joined_at, leftAt: r.left_at };
  });
}

export async function getGame(roomId: string): Promise<GameRow | null> {
  const { data } = await supabaseAdmin()
    .from("ludo_games")
    .select("state, version, turn_deadline, started_at")
    .eq("room_id", roomId)
    .maybeSingle();
  if (!data) return null;
  return { state: data.state as GameState, version: data.version, turnDeadline: data.turn_deadline, startedAt: data.started_at };
}

/** Bumps updated_at so subscribers of the room row refresh their lobby. */
export async function touchRoom(roomId: string, patch: Partial<Pick<RoomRow, "status" | "host_id">> = {}) {
  const { error } = await supabaseAdmin()
    .from("ludo_rooms")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", roomId);
  if (error) throw error;
}

export async function buildSnapshot(room: RoomRow, userId: string, pseudo: string): Promise<RoomSnapshot> {
  const [players, game] = await Promise.all([listPlayers(room.id), getGame(room.id)]);
  const isMember = players.some((p) => p.userId === userId);
  return {
    id: room.id,
    code: room.code,
    hostId: room.host_id,
    status: room.status,
    players,
    game: isMember ? game : null,
    me: { userId, pseudo, isMember },
    serverNow: Date.now(),
  };
}

function deadlineFor(state: GameState): string | null {
  return state.phase === "finished" ? null : new Date(Date.now() + TURN_DURATION_MS).toISOString();
}

export async function insertGame(roomId: string, state: GameState): Promise<GameRow> {
  const admin = supabaseAdmin();
  await admin.from("ludo_moves").delete().eq("room_id", roomId);
  const row = { room_id: roomId, state, version: 0, turn_deadline: deadlineFor(state), winner_id: null, finished_at: null, started_at: new Date().toISOString() };
  const { error } = await admin.from("ludo_games").upsert(row);
  if (error) throw error;
  return { state, version: 0, turnDeadline: row.turn_deadline, startedAt: row.started_at };
}

/**
 * Applies `mutate` to the stored game with optimistic locking on `version`.
 * `expectedVersion` (when given) must match what the client saw, so stale clicks are rejected.
 */
export async function mutateGame(
  roomId: string,
  userId: string | null,
  mutate: (state: GameState, row: GameRow) => GameState,
  expectedVersion?: number,
): Promise<GameRow> {
  const admin = supabaseAdmin();
  const current = await getGame(roomId);
  if (!current) throw new Error("Aucune partie en cours.");
  if (expectedVersion !== undefined && expectedVersion !== current.version) throw new ConflictError();

  const next = mutate(current.state, current);
  if (next === current.state) return current;

  const version = current.version + 1;
  const finished = next.phase === "finished";
  const ranking = finished ? standings(next) : [];
  const winnerId = finished ? next.players.find((p) => p.color === ranking[0])?.userId ?? null : null;
  const turnDeadline = deadlineFor(next);

  const { data, error } = await admin
    .from("ludo_games")
    .update({
      state: next,
      version,
      turn_deadline: turnDeadline,
      ...(finished ? { winner_id: winnerId, finished_at: new Date().toISOString() } : {}),
    })
    .eq("room_id", roomId)
    .eq("version", current.version)
    .select("room_id");
  if (error) throw error;
  if (!data || data.length === 0) throw new ConflictError();

  await admin.from("ludo_moves").insert({ room_id: roomId, user_id: userId, seq: next.seq, events: next.events });

  if (finished) {
    await touchRoom(roomId, { status: "finished" });
    await recordStats(next, winnerId);
  }
  return { state: next, version, turnDeadline, startedAt: current.startedAt };
}

async function recordStats(state: GameState, winnerId: string | null) {
  const admin = supabaseAdmin();
  const ids = state.players.map((p) => p.userId);
  const { data } = await admin.from("ludo_profiles").select("id, games_played, games_won").in("id", ids);
  await Promise.all(
    (data ?? []).map((p) =>
      admin
        .from("ludo_profiles")
        .update({ games_played: p.games_played + 1, games_won: p.games_won + (p.id === winnerId ? 1 : 0) })
        .eq("id", p.id),
    ),
  );
}
