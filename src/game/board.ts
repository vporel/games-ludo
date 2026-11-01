import { BASE, Color, FINISH_PROGRESS, LAST_TRACK_PROGRESS, START_INDEX, TRACK_LENGTH } from "./constants";

/** A cell on the 15×15 grid: x = column, y = row. */
export type Cell = { x: number; y: number };

/** The 52 cells of the outer track, clockwise, starting at red's start cell. */
export const TRACK: readonly Cell[] = (() => {
  const c: Cell[] = [];
  const push = (x: number, y: number) => c.push({ x, y });
  for (let x = 1; x <= 5; x++) push(x, 6); // 0..4
  for (let y = 5; y >= 0; y--) push(6, y); // 5..10
  push(7, 0); // 11
  for (let y = 0; y <= 5; y++) push(8, y); // 12..17
  for (let x = 9; x <= 14; x++) push(x, 6); // 18..23
  push(14, 7); // 24
  for (let x = 14; x >= 9; x--) push(x, 8); // 25..30
  for (let y = 9; y <= 14; y++) push(8, y); // 31..36
  push(7, 14); // 37
  for (let y = 14; y >= 9; y--) push(6, y); // 38..43
  for (let x = 5; x >= 0; x--) push(x, 8); // 44..49
  push(0, 7); // 50
  push(0, 6); // 51
  return c;
})();

/** The 5 colored cells leading to the center, per color (progress 51..55). */
export const HOME_COLUMN: Record<Color, readonly Cell[]> = {
  red: [1, 2, 3, 4, 5].map((x) => ({ x, y: 7 })),
  green: [1, 2, 3, 4, 5].map((y) => ({ x: 7, y })),
  yellow: [13, 12, 11, 10, 9].map((x) => ({ x, y: 7 })),
  blue: [13, 12, 11, 10, 9].map((y) => ({ x: 7, y })),
};

/** Where finished pawns rest inside the center triangle of their color. */
export const FINISH_CELL: Record<Color, Cell> = {
  red: { x: 6, y: 7 },
  green: { x: 7, y: 6 },
  yellow: { x: 8, y: 7 },
  blue: { x: 7, y: 8 },
};

/** The four base slots (inside the 6×6 corner) per color. */
export const BASE_SLOTS: Record<Color, readonly Cell[]> = (() => {
  const slots = (ox: number, oy: number): Cell[] => [
    { x: ox + 1.5, y: oy + 1.5 },
    { x: ox + 3.5, y: oy + 1.5 },
    { x: ox + 1.5, y: oy + 3.5 },
    { x: ox + 3.5, y: oy + 3.5 },
  ];
  return { red: slots(0, 0), green: slots(9, 0), yellow: slots(9, 9), blue: slots(0, 9) };
})();

/** Track index for a pawn on the shared track. */
export function trackIndex(color: Color, progress: number): number {
  return (START_INDEX[color] + progress) % TRACK_LENGTH;
}

/** Grid cell for a pawn given its progress (pawnIndex is used for base slots). */
export function cellFor(color: Color, progress: number, pawnIndex: number): Cell {
  if (progress === BASE) return BASE_SLOTS[color][pawnIndex];
  if (progress >= FINISH_PROGRESS) return FINISH_CELL[color];
  if (progress > LAST_TRACK_PROGRESS) return HOME_COLUMN[color][progress - LAST_TRACK_PROGRESS - 1];
  return TRACK[trackIndex(color, progress)];
}

/** Cells visited step by step when moving from `from` to `to` (excludes the origin). */
export function pathCells(color: Color, from: number, to: number, pawnIndex: number): Cell[] {
  if (from === BASE) return [cellFor(color, 0, pawnIndex)];
  const cells: Cell[] = [];
  for (let p = from + 1; p <= to; p++) cells.push(cellFor(color, p, pawnIndex));
  return cells;
}
