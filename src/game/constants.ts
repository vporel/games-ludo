export const COLORS = ["red", "green", "yellow", "blue"] as const;
export type Color = (typeof COLORS)[number];

export const COLOR_LABELS: Record<Color, string> = {
  red: "Rouge",
  green: "Vert",
  yellow: "Jaune",
  blue: "Bleu",
};

/** Number of cells on the shared outer track. */
export const TRACK_LENGTH = 52;
/** Last progress value still on the shared track (51 cells walked: 0..50). */
export const LAST_TRACK_PROGRESS = 50;
/** Progress value of the finish (center). Values 51..55 are the colored home column. */
export const FINISH_PROGRESS = 56;
/** Progress value of a pawn still in its base. */
export const BASE = -1;

export const PAWNS_PER_PLAYER = 4;
export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;
export const TURN_DURATION_MS = 30_000;

/** Track index where each color enters the board. */
export const START_INDEX: Record<Color, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

/** Safe cells: the four start cells and the four stars. */
export const SAFE_INDICES: ReadonlySet<number> = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

/** Colors used for a given number of players (2 players sit face to face). */
export function colorsForPlayerCount(count: number): Color[] {
  if (count <= 2) return ["red", "yellow"].slice(0, count) as Color[];
  return COLORS.slice(0, count) as Color[];
}
