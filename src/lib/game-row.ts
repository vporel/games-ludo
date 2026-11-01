import type { GameRow } from "./types";

/** Keeps the newest game row: same game → highest version wins; a new game replaces the old one. */
export function newerGame(current: GameRow | null, incoming: GameRow | null): GameRow | null {
  if (!incoming) return current;
  if (!current || current.startedAt !== incoming.startedAt) return incoming;
  return incoming.version > current.version ? incoming : current;
}
