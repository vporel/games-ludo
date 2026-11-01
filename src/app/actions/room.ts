"use server";

import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { MAX_PLAYERS, MIN_PLAYERS } from "@/game/constants";
import { GameError, applyRoll, autoPlay, createGame, forfeit, movePawn } from "@/game/engine";
import { generateRoomCode, normalizeRoomCode, ROOM_CODE_PATTERN } from "@/lib/room-code";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/supabase/server";
import type { ActionResult, GameRow, RoomSnapshot } from "@/lib/types";
import {
  ConflictError,
  buildSnapshot,
  findActiveRoomByCode,
  getProfilePseudo,
  getRoom,
  insertGame,
  listPlayers,
  mutateGame,
  rollDie,
  touchRoom,
} from "@/server/rooms";

async function requireUser(): Promise<{ userId: string; pseudo: string }> {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const pseudo = await getProfilePseudo(userId);
  if (!pseudo) redirect("/auth/signout");
  return { userId, pseudo };
}

function failure(e: unknown): { ok: false; error: string } {
  if (e instanceof GameError || e instanceof ConflictError) return { ok: false, error: e.message };
  console.error(e);
  return { ok: false, error: "Une erreur est survenue. Réessaie." };
}

// ---------------------------------------------------------------- Lobby

export async function createRoom(): Promise<ActionResult> {
  const { userId } = await requireUser();
  const admin = supabaseAdmin();
  let code: string | null = null;
  let roomId: string | null = null;
  for (let attempt = 0; attempt < 10 && !roomId; attempt++) {
    code = generateRoomCode(() => randomInt(0, 1_000_000));
    const { data, error } = await admin
      .from("ludo_rooms")
      .insert({ code, host_id: userId })
      .select("id")
      .single();
    if (!error) roomId = data.id;
    else if (error.code !== "23505") return failure(error);
  }
  if (!roomId || !code) return { ok: false, error: "Impossible de générer un code. Réessaie." };

  const { error } = await admin.from("ludo_room_players").insert({ room_id: roomId, user_id: userId });
  if (error) return failure(error);
  redirect(`/room/${code}`);
}

export type JoinState = { error: string | null };

async function join(rawCode: string): Promise<string | null> {
  const { userId } = await requireUser();
  const code = normalizeRoomCode(rawCode);
  if (!ROOM_CODE_PATTERN.test(code)) return "Le code doit contenir 6 chiffres.";

  const room = await findActiveRoomByCode(code);
  if (!room) return "Aucune salle avec ce code.";

  const players = await listPlayers(room.id);
  if (players.some((p) => p.userId === userId)) redirect(`/room/${code}`);
  if (room.status !== "lobby") return "La partie a déjà commencé dans cette salle.";
  if (players.length >= MAX_PLAYERS) return `La salle est pleine (${MAX_PLAYERS} joueurs maximum).`;

  const { error } = await supabaseAdmin().from("ludo_room_players").insert({ room_id: room.id, user_id: userId });
  if (error) {
    if (error.message.includes("LUDO_ROOM_FULL")) return `La salle est pleine (${MAX_PLAYERS} joueurs maximum).`;
    if (error.code !== "23505") return failure(error).error;
  }
  await touchRoom(room.id);
  redirect(`/room/${code}`);
}

export async function joinRoom(_prev: JoinState, form: FormData): Promise<JoinState> {
  return { error: await join(String(form.get("code") ?? "")) };
}

export async function joinRoomByCode(code: string): Promise<ActionResult> {
  const error = await join(code);
  return error ? { ok: false, error } : { ok: true };
}

export async function getRoomSnapshot(code: string): Promise<ActionResult<RoomSnapshot>> {
  try {
    const { userId, pseudo } = await requireUser();
    const room = await findActiveRoomByCode(normalizeRoomCode(code));
    if (!room) return { ok: false, error: "Cette salle n'existe pas ou a été fermée." };
    return { ok: true, data: await buildSnapshot(room, userId, pseudo) };
  } catch (e) {
    return failure(e);
  }
}

export async function leaveRoom(roomId: string): Promise<ActionResult> {
  const { userId } = await requireUser();
  try {
    const admin = supabaseAdmin();
    const room = await getRoom(roomId);
    if (!room) redirect("/");
    const players = await listPlayers(roomId);
    const me = players.find((p) => p.userId === userId);
    if (!me) redirect("/");

    if (room.status === "playing") {
      // The player stays listed (for names on the board) but forfeits.
      await mutateGame(roomId, userId, (state) => {
        const slot = state.players.find((p) => p.userId === userId);
        return slot ? forfeit(state, slot.color) : state;
      });
      await admin
        .from("ludo_room_players")
        .update({ left_at: new Date().toISOString() })
        .eq("room_id", roomId)
        .eq("user_id", userId);
      const nextHost = players.find((p) => p.userId !== userId && !p.leftAt);
      await touchRoom(roomId, room.host_id === userId && nextHost ? { host_id: nextHost.userId } : {});
    } else {
      await admin.from("ludo_room_players").delete().eq("room_id", roomId).eq("user_id", userId);
      const remaining = players.filter((p) => p.userId !== userId && !p.leftAt);
      if (remaining.length === 0) await touchRoom(roomId, { status: "closed" });
      else if (room.host_id === userId) await touchRoom(roomId, { host_id: remaining[0].userId });
      else await touchRoom(roomId);
    }
  } catch (e) {
    if (isRedirect(e)) throw e;
    return failure(e);
  }
  redirect("/");
}

export async function kickPlayer(roomId: string, targetId: string): Promise<ActionResult> {
  const { userId } = await requireUser();
  try {
    const room = await getRoom(roomId);
    if (!room || room.host_id !== userId) return { ok: false, error: "Seul l'hôte peut exclure un joueur." };
    if (room.status !== "lobby") return { ok: false, error: "Impossible pendant une partie." };
    if (targetId === userId) return { ok: false, error: "Tu ne peux pas t'exclure toi-même." };
    await supabaseAdmin().from("ludo_room_players").delete().eq("room_id", roomId).eq("user_id", targetId);
    await touchRoom(roomId);
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function startGame(roomId: string): Promise<ActionResult<GameRow>> {
  const { userId } = await requireUser();
  try {
    const room = await getRoom(roomId);
    if (!room || room.host_id !== userId) return { ok: false, error: "Seul l'hôte peut lancer la partie." };
    if (room.status !== "lobby") return { ok: false, error: "La partie a déjà commencé." };
    const players = (await listPlayers(roomId)).filter((p) => !p.leftAt);
    if (players.length < MIN_PLAYERS) return { ok: false, error: "Il faut au moins 2 joueurs." };
    const game = await insertGame(roomId, createGame(players.map((p) => p.userId)));
    await touchRoom(roomId, { status: "playing" });
    return { ok: true, data: game };
  } catch (e) {
    return failure(e);
  }
}

/** Host sends everyone back to the lobby after a finished game. */
export async function rematch(roomId: string): Promise<ActionResult> {
  const { userId } = await requireUser();
  try {
    const room = await getRoom(roomId);
    if (!room || room.host_id !== userId) return { ok: false, error: "Seul l'hôte peut relancer." };
    if (room.status !== "finished") return { ok: false, error: "La partie n'est pas terminée." };
    const admin = supabaseAdmin();
    await admin.from("ludo_room_players").delete().eq("room_id", roomId).not("left_at", "is", null);
    await admin.from("ludo_games").delete().eq("room_id", roomId);
    await touchRoom(roomId, { status: "lobby" });
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

// ---------------------------------------------------------------- Game

async function playing(roomId: string) {
  const room = await getRoom(roomId);
  if (!room || room.status !== "playing") throw new GameError("Aucune partie en cours.");
}

export async function rollDice(roomId: string, version: number): Promise<ActionResult<GameRow>> {
  const { userId } = await requireUser();
  try {
    await playing(roomId);
    const game = await mutateGame(roomId, userId, (s) => applyRoll(s, rollDie(), userId), version);
    return { ok: true, data: game };
  } catch (e) {
    return failure(e);
  }
}

export async function moveToken(roomId: string, pawn: number, version: number): Promise<ActionResult<GameRow>> {
  const { userId } = await requireUser();
  try {
    await playing(roomId);
    const game = await mutateGame(roomId, userId, (s) => movePawn(s, pawn, userId), version);
    return { ok: true, data: game };
  } catch (e) {
    return failure(e);
  }
}

/** Any member can ask the server to auto-play once the current turn's deadline has passed. */
export async function expireTurn(roomId: string, version: number): Promise<ActionResult<GameRow>> {
  const { userId } = await requireUser();
  try {
    await playing(roomId);
    const players = await listPlayers(roomId);
    if (!players.some((p) => p.userId === userId)) return { ok: false, error: "Tu n'es pas dans cette salle." };
    const game = await mutateGame(
      roomId,
      null,
      (s, row) => {
        if (!row.turnDeadline || new Date(row.turnDeadline).getTime() > Date.now()) return s;
        return autoPlay(s, rollDie);
      },
      version,
    );
    return { ok: true, data: game };
  } catch (e) {
    return failure(e);
  }
}

function isRedirect(e: unknown): boolean {
  return typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");
}
