import { describe, expect, it } from "vitest";
import { normalizePseudo, pseudoError, pseudoToEmail } from "./pseudo";
import { generateRoomCode, normalizeRoomCode, ROOM_CODE_PATTERN } from "./room-code";

describe("pseudo", () => {
  it("normalizes and validates", () => {
    expect(normalizePseudo("  Bob_42 ")).toBe("bob_42");
    expect(pseudoError("bo")).not.toBeNull();
    expect(pseudoError("a".repeat(21))).not.toBeNull();
    expect(pseudoError("bob-42")).not.toBeNull();
    expect(pseudoError("bob_42")).toBeNull();
  });
  it("builds the technical email", () => {
    expect(pseudoToEmail("bob")).toBe("bob@user.games.vporel.com");
  });
});

describe("room code", () => {
  it("keeps 6 digits", () => {
    expect(normalizeRoomCode(" 12 34-56 7")).toBe("123456");
  });
  it("pads generated codes", () => {
    expect(generateRoomCode(() => 42)).toBe("000042");
    expect(ROOM_CODE_PATTERN.test(generateRoomCode(() => 999_999))).toBe(true);
  });
});

import { newerGame } from "./game-row";
import { describeEvents } from "@/game/describe";
import { createGame } from "@/game/engine";
import type { GameRow } from "./types";

describe("newerGame", () => {
  const state = createGame(["a", "b"]);
  const row = (version: number, startedAt = "g1"): GameRow => ({ state, version, startedAt, turnDeadline: null });
  it("keeps the highest version of the same game", () => {
    expect(newerGame(row(3), row(2))?.version).toBe(3);
    expect(newerGame(row(2), row(3))?.version).toBe(3);
  });
  it("replaces a previous game even with a lower version", () => {
    expect(newerGame(row(40, "g1"), row(0, "g2"))?.startedAt).toBe("g2");
  });
  it("handles nulls", () => {
    expect(newerGame(null, row(1))?.version).toBe(1);
    expect(newerGame(row(1), null)?.version).toBe(1);
  });
});

describe("describeEvents", () => {
  it("writes French log lines", () => {
    const lines = describeEvents(
      [
        { type: "roll", color: "red", dice: 6 },
        { type: "move", color: "red", pawn: 0, from: 10, to: 16, captures: [{ color: "yellow", pawn: 1, from: 42 }] },
        { type: "pass", color: "yellow", reason: "three-sixes" },
      ],
      { red: "alice", yellow: "bob" },
    );
    expect(lines.map((l) => l.text)).toEqual(["alice fait 6", "alice capture bob !", "Trois 6 d'affilée : bob perd son tour"]);
  });
});

describe("describeEvents: passes", () => {
  it("stays silent when a player has no legal move", () => {
    const lines = describeEvents(
      [
        { type: "roll", color: "red", dice: 3 },
        { type: "pass", color: "red", reason: "no-move" },
      ],
      { red: "alice" },
    );
    expect(lines.map((l) => l.text)).toEqual(["alice fait 3"]);
  });
});
