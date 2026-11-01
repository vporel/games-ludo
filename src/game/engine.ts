import {
  BASE,
  COLORS,
  Color,
  FINISH_PROGRESS,
  LAST_TRACK_PROGRESS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PAWNS_PER_PLAYER,
  SAFE_INDICES,
  colorsForPlayerCount,
} from "./constants";
import { trackIndex } from "./board";

export type PlayerSlot = { userId: string; color: Color };

export type Capture = { color: Color; pawn: number; from: number };

export type GameEvent =
  | { type: "roll"; color: Color; dice: number; auto?: boolean }
  | { type: "move"; color: Color; pawn: number; from: number; to: number; captures: Capture[]; auto?: boolean }
  | { type: "pass"; color: Color; reason: "no-move" | "three-sixes" }
  | { type: "finish"; color: Color; rank: number }
  | { type: "forfeit"; color: Color };

export type Phase = "roll" | "move" | "finished";

export type GameState = {
  /** Players in turn order (clockwise). */
  players: PlayerSlot[];
  /** Progress of each pawn: -1 base, 0..50 track, 51..55 home column, 56 finished. */
  pawns: Partial<Record<Color, number[]>>;
  /** Index into `players` of the player whose turn it is. */
  turn: number;
  phase: Phase;
  dice: number | null;
  /** Consecutive sixes rolled during the current turn. */
  sixes: number;
  /** Colors that finished, in order. The last active player is appended when the game ends. */
  rankings: Color[];
  /** Colors that left the game. */
  forfeited: Color[];
  /** Incremented on every state change. */
  seq: number;
  /** Events produced by the last action, for animation and the log. */
  events: GameEvent[];
};

export class GameError extends Error {}

export function createGame(userIds: string[]): GameState {
  if (userIds.length < MIN_PLAYERS || userIds.length > MAX_PLAYERS) {
    throw new GameError(`Il faut entre ${MIN_PLAYERS} et ${MAX_PLAYERS} joueurs.`);
  }
  const colors = colorsForPlayerCount(userIds.length);
  const players = userIds.map((userId, i) => ({ userId, color: colors[i] }));
  players.sort((a, b) => COLORS.indexOf(a.color) - COLORS.indexOf(b.color));
  const pawns: GameState["pawns"] = {};
  for (const p of players) pawns[p.color] = Array(PAWNS_PER_PLAYER).fill(BASE);
  return { players, pawns, turn: 0, phase: "roll", dice: null, sixes: 0, rankings: [], forfeited: [], seq: 0, events: [] };
}

export function currentPlayer(state: GameState): PlayerSlot {
  return state.players[state.turn];
}

export function isActive(state: GameState, color: Color): boolean {
  return !state.rankings.includes(color) && !state.forfeited.includes(color);
}

/** Progress reached by a pawn moving `dice` steps, or null if the move is not allowed. */
export function targetProgress(progress: number, dice: number): number | null {
  if (progress === BASE) return dice === 6 ? 0 : null;
  if (progress >= FINISH_PROGRESS) return null;
  const to = progress + dice;
  return to <= FINISH_PROGRESS ? to : null;
}

/** Indices of the current player's pawns that can move with the current dice. */
export function legalMoves(state: GameState): number[] {
  if (state.phase !== "move" || state.dice === null) return [];
  const pawns = state.pawns[currentPlayer(state).color]!;
  const out: number[] = [];
  pawns.forEach((p, i) => {
    if (targetProgress(p, state.dice!) !== null) out.push(i);
  });
  return out;
}

function clone(state: GameState): GameState {
  return structuredClone(state);
}

function activeCount(state: GameState): number {
  return state.players.filter((p) => isActive(state, p.color)).length;
}

/** Ends the game when at most one active player remains. Returns true if the game ended. */
function checkGameEnd(s: GameState): boolean {
  if (activeCount(s) > 1) return false;
  const last = s.players.find((p) => isActive(s, p.color));
  if (last) s.rankings.push(last.color);
  s.phase = "finished";
  s.dice = null;
  return true;
}

function nextTurn(s: GameState) {
  s.dice = null;
  s.sixes = 0;
  s.phase = "roll";
  const n = s.players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (s.turn + step) % n;
    if (isActive(s, s.players[idx].color)) {
      s.turn = idx;
      return;
    }
  }
}

/** Same player rolls again. */
function bonusTurn(s: GameState) {
  s.dice = null;
  s.phase = "roll";
}

function assertTurn(state: GameState, userId: string | null) {
  if (state.phase === "finished") throw new GameError("La partie est terminée.");
  if (userId !== null && currentPlayer(state).userId !== userId) throw new GameError("Ce n'est pas ton tour.");
}

/**
 * Applies a dice roll. If no move is possible the turn passes; if exactly one distinct move is
 * possible it is played automatically.
 */
export function applyRoll(state: GameState, dice: number, userId: string | null, auto = false): GameState {
  assertTurn(state, userId);
  if (state.phase !== "roll") throw new GameError("Tu dois d'abord déplacer un pion.");
  if (!Number.isInteger(dice) || dice < 1 || dice > 6) throw new GameError("Dé invalide.");
  const s = clone(state);
  const color = currentPlayer(s).color;
  s.seq++;
  s.events = [{ type: "roll", color, dice, ...(auto ? { auto } : {}) }];
  s.dice = dice;
  s.sixes = dice === 6 ? s.sixes + 1 : 0;

  if (s.sixes >= 3) {
    s.events.push({ type: "pass", color, reason: "three-sixes" });
    nextTurn(s);
    return s;
  }

  s.phase = "move";
  const moves = legalMoves(s);
  if (moves.length === 0) {
    s.events.push({ type: "pass", color, reason: "no-move" });
    if (dice === 6) bonusTurn(s);
    else nextTurn(s);
    return s;
  }

  const pawns = s.pawns[color]!;
  const distinct = new Set(moves.map((i) => pawns[i]));
  if (distinct.size === 1) return movePawn(s, moves[0], null, auto, true);
  return s;
}

/** Moves one of the current player's pawns by the current dice value. */
export function movePawn(
  state: GameState,
  pawn: number,
  userId: string | null,
  auto = false,
  keepEvents = false,
): GameState {
  assertTurn(state, userId);
  if (state.phase !== "move" || state.dice === null) throw new GameError("Lance d'abord le dé.");
  if (!legalMoves(state).includes(pawn)) throw new GameError("Ce pion ne peut pas bouger.");
  const s = clone(state);
  const color = currentPlayer(s).color;
  const dice = s.dice!;
  const from = s.pawns[color]![pawn];
  const to = targetProgress(from, dice)!;
  s.pawns[color]![pawn] = to;
  if (!keepEvents) {
    s.seq++;
    s.events = [];
  }

  const captures: Capture[] = [];
  if (to <= LAST_TRACK_PROGRESS) {
    const idx = trackIndex(color, to);
    if (!SAFE_INDICES.has(idx)) {
      for (const p of s.players) {
        if (p.color === color || !isActive(s, p.color)) continue;
        s.pawns[p.color]!.forEach((op, i) => {
          if (op !== BASE && op <= LAST_TRACK_PROGRESS && trackIndex(p.color, op) === idx) {
            captures.push({ color: p.color, pawn: i, from: op });
            s.pawns[p.color]![i] = BASE;
          }
        });
      }
    }
  }
  s.events.push({ type: "move", color, pawn, from, to, captures, ...(auto ? { auto } : {}) });

  const allHome = s.pawns[color]!.every((p) => p === FINISH_PROGRESS);
  if (allHome) {
    s.rankings.push(color);
    s.events.push({ type: "finish", color, rank: s.rankings.length });
    if (!checkGameEnd(s)) nextTurn(s);
    return s;
  }

  const bonus = dice === 6 || captures.length > 0 || to === FINISH_PROGRESS;
  if (bonus) bonusTurn(s);
  else nextTurn(s);
  return s;
}

/** Removes a player from the game (they left). Their pawns go back to base. */
export function forfeit(state: GameState, color: Color): GameState {
  if (state.phase === "finished" || !isActive(state, color)) return state;
  const s = clone(state);
  s.seq++;
  s.events = [{ type: "forfeit", color }];
  s.forfeited.push(color);
  s.pawns[color] = s.pawns[color]!.map((p) => (p === FINISH_PROGRESS ? p : BASE));
  if (checkGameEnd(s)) return s;
  if (currentPlayer(s).color === color) nextTurn(s);
  return s;
}

/** Picks a reasonable move: capture > reach finish > leave base > enter home column > furthest pawn. */
export function chooseAutoMove(state: GameState): number {
  const moves = legalMoves(state);
  if (moves.length === 0) throw new GameError("Aucun coup possible.");
  const color = currentPlayer(state).color;
  const pawns = state.pawns[color]!;
  const dice = state.dice!;
  const score = (i: number): number => {
    const from = pawns[i];
    const to = targetProgress(from, dice)!;
    let sc = from === BASE ? 0 : from;
    if (to <= LAST_TRACK_PROGRESS) {
      const idx = trackIndex(color, to);
      const captures = !SAFE_INDICES.has(idx) &&
        state.players.some(
          (p) =>
            p.color !== color &&
            isActive(state, p.color) &&
            state.pawns[p.color]!.some((op) => op !== BASE && op <= LAST_TRACK_PROGRESS && trackIndex(p.color, op) === idx),
        );
      if (captures) sc += 1000;
    }
    if (to === FINISH_PROGRESS) sc += 800;
    if (from === BASE) sc += 600;
    if (from <= LAST_TRACK_PROGRESS && to > LAST_TRACK_PROGRESS) sc += 400;
    return sc;
  };
  return moves.reduce((best, i) => (score(i) > score(best) ? i : best), moves[0]);
}

/** Plays the current player's turn step automatically (used when their timer runs out). */
export function autoPlay(state: GameState, rollDice: () => number): GameState {
  if (state.phase === "finished") return state;
  if (state.phase === "move") return movePawn(state, chooseAutoMove(state), null, true);
  const rolled = applyRoll(state, rollDice(), null, true);
  // applyRoll may already have moved or passed; only continue if a choice is pending.
  // A bonus turn (phase "roll" again) is left to the player, with a fresh timer.
  if (rolled.phase !== "move") return rolled;
  return movePawn(rolled, chooseAutoMove(rolled), null, true, true);
}

/** Final standings: finishers in order, then players who left (last to leave ranks higher). */
export function standings(state: GameState): Color[] {
  return [...state.rankings, ...[...state.forfeited].reverse()];
}
