import type { GameState } from "@/game/engine";

export type RoomStatus = "lobby" | "playing" | "finished" | "closed";

export type RoomPlayer = {
  userId: string;
  pseudo: string;
  joinedAt: string;
  leftAt: string | null;
};

export type GameRow = {
  state: GameState;
  version: number;
  turnDeadline: string | null;
  /** Identifies one game: a rematch starts a new game with versions back at 0. */
  startedAt: string;
};

export type RoomSnapshot = {
  id: string;
  code: string;
  hostId: string;
  status: RoomStatus;
  players: RoomPlayer[];
  game: GameRow | null;
  me: { userId: string; pseudo: string; isMember: boolean };
  /** Server clock at snapshot time, used to correct the client's timer. */
  serverNow: number;
};

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
