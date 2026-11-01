import { describe, expect, it } from "vitest";
import { BASE, FINISH_PROGRESS, SAFE_INDICES, TRACK_LENGTH } from "./constants";
import { HOME_COLUMN, TRACK, cellFor, trackIndex } from "./board";
import {
  GameError,
  GameState,
  applyRoll,
  autoPlay,
  chooseAutoMove,
  createGame,
  currentPlayer,
  forfeit,
  legalMoves,
  movePawn,
  standings,
  targetProgress,
} from "./engine";

const A = "user-a";
const B = "user-b";
const C = "user-c";
const D = "user-d";

function withPawns(s: GameState, pawns: GameState["pawns"]): GameState {
  return { ...s, pawns: { ...s.pawns, ...pawns } };
}

describe("board geometry", () => {
  it("has 52 unique track cells, each adjacent to the next", () => {
    expect(TRACK).toHaveLength(TRACK_LENGTH);
    const keys = new Set(TRACK.map((c) => `${c.x},${c.y}`));
    expect(keys.size).toBe(TRACK_LENGTH);
    for (let i = 0; i < TRACK_LENGTH; i++) {
      const a = TRACK[i];
      const b = TRACK[(i + 1) % TRACK_LENGTH];
      const dist = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      // Corners of the cross jump diagonally (e.g. (5,6) -> (6,5)).
      expect(dist === 1 || (Math.abs(a.x - b.x) === 1 && Math.abs(a.y - b.y) === 1)).toBe(true);
    }
  });

  it("home columns start next to each color's last track cell", () => {
    for (const color of ["red", "green", "yellow", "blue"] as const) {
      const last = cellFor(color, 50, 0);
      const first = HOME_COLUMN[color][0];
      expect(Math.abs(last.x - first.x) + Math.abs(last.y - first.y)).toBe(1);
    }
  });

  it("start cells are safe", () => {
    for (const color of ["red", "green", "yellow", "blue"] as const) {
      expect(SAFE_INDICES.has(trackIndex(color, 0))).toBe(true);
    }
  });
});

describe("createGame", () => {
  it("seats two players face to face", () => {
    const g = createGame([A, B]);
    expect(g.players.map((p) => p.color)).toEqual(["red", "yellow"]);
    expect(g.pawns.red).toEqual([BASE, BASE, BASE, BASE]);
    expect(g.pawns.green).toBeUndefined();
  });

  it("uses all colors with four players", () => {
    expect(createGame([A, B, C, D]).players.map((p) => p.color)).toEqual(["red", "green", "yellow", "blue"]);
  });

  it("rejects invalid player counts", () => {
    expect(() => createGame([A])).toThrow(GameError);
    expect(() => createGame([A, B, C, D, "e"])).toThrow(GameError);
  });
});

describe("targetProgress", () => {
  it("needs a 6 to leave base", () => {
    expect(targetProgress(BASE, 5)).toBeNull();
    expect(targetProgress(BASE, 6)).toBe(0);
  });
  it("needs an exact roll to finish", () => {
    expect(targetProgress(52, 4)).toBe(FINISH_PROGRESS);
    expect(targetProgress(52, 5)).toBeNull();
    expect(targetProgress(FINISH_PROGRESS, 1)).toBeNull();
  });
});

describe("turns", () => {
  it("rejects actions from the wrong player", () => {
    const g = createGame([A, B]);
    expect(() => applyRoll(g, 6, B)).toThrow("Ce n'est pas ton tour.");
  });

  it("passes the turn when no move is possible", () => {
    const g = applyRoll(createGame([A, B]), 3, A);
    expect(currentPlayer(g).userId).toBe(B);
    expect(g.phase).toBe("roll");
    expect(g.events.map((e) => e.type)).toEqual(["roll", "pass"]);
  });

  it("auto-moves when all candidate pawns are equivalent, and a 6 grants another roll", () => {
    const g = applyRoll(createGame([A, B]), 6, A);
    expect(g.pawns.red).toEqual([0, BASE, BASE, BASE]);
    expect(currentPlayer(g).userId).toBe(A);
    expect(g.phase).toBe("roll");
    expect(g.events.map((e) => e.type)).toEqual(["roll", "move"]);
  });

  it("waits for a choice when several distinct moves exist", () => {
    let g = withPawns(createGame([A, B]), { red: [5, BASE, BASE, BASE] });
    g = applyRoll(g, 6, A);
    expect(g.phase).toBe("move");
    expect(legalMoves(g).sort()).toEqual([0, 1, 2, 3]);
    g = movePawn(g, 1, A);
    expect(g.pawns.red).toEqual([5, 0, BASE, BASE]);
  });

  it("loses the turn on three consecutive sixes", () => {
    let g = withPawns(createGame([A, B]), { red: [5, 10, BASE, BASE] });
    g = applyRoll(g, 6, A);
    g = movePawn(g, 0, A);
    g = applyRoll(g, 6, A);
    g = movePawn(g, 0, A);
    expect(g.sixes).toBe(2);
    g = applyRoll(g, 6, A);
    expect(currentPlayer(g).userId).toBe(B);
    expect(g.events.at(-1)).toEqual({ type: "pass", color: "red", reason: "three-sixes" });
    expect(g.pawns.red).toEqual([17, 10, BASE, BASE]);
  });

  it("refuses to move before rolling or roll twice", () => {
    const g = createGame([A, B]);
    expect(() => movePawn(g, 0, A)).toThrow(GameError);
    const g2 = applyRoll(withPawns(g, { red: [5, 10, BASE, BASE] }), 2, A);
    expect(() => applyRoll(g2, 2, A)).toThrow(GameError);
    expect(() => movePawn(g2, 2, A)).toThrow("Ce pion ne peut pas bouger.");
  });
});

describe("captures and safety", () => {
  it("captures an opponent and grants a bonus roll", () => {
    // Red at progress 10 (track 10). Yellow pawn at track 12 = yellow progress 38.
    let g = withPawns(createGame([A, B]), { red: [10, 20, BASE, BASE], yellow: [38, BASE, BASE, BASE] });
    g = applyRoll(g, 2, A);
    g = movePawn(g, 0, A);
    expect(g.pawns.yellow).toEqual([BASE, BASE, BASE, BASE]);
    expect(currentPlayer(g).userId).toBe(A);
    const move = g.events.find((e) => e.type === "move");
    expect(move && move.type === "move" && move.captures).toEqual([{ color: "yellow", pawn: 0, from: 38 }]);
  });

  it("does not capture on a safe cell", () => {
    // Track 8 is a star. Yellow progress 34 -> track (26+34)%52 = 8.
    let g = withPawns(createGame([A, B]), { red: [5, 20, BASE, BASE], yellow: [34, BASE, BASE, BASE] });
    g = applyRoll(g, 3, A);
    g = movePawn(g, 0, A);
    expect(g.pawns.yellow![0]).toBe(34);
    expect(currentPlayer(g).userId).toBe(B);
  });

  it("never captures inside the home column", () => {
    let g = withPawns(createGame([A, B]), { red: [49, 20, BASE, BASE], yellow: [BASE, BASE, BASE, BASE] });
    g = applyRoll(g, 3, A);
    g = movePawn(g, 0, A);
    expect(g.pawns.red![0]).toBe(52);
  });
});

describe("finishing", () => {
  it("grants a bonus roll when a pawn reaches the center", () => {
    let g = withPawns(createGame([A, B]), { red: [53, 10, BASE, BASE] });
    g = applyRoll(g, 3, A);
    g = movePawn(g, 0, A);
    expect(g.pawns.red![0]).toBe(FINISH_PROGRESS);
    expect(currentPlayer(g).userId).toBe(A);
  });

  it("ranks finishers and ends the game when one player remains", () => {
    let g = withPawns(createGame([A, B, C]), {
      red: [56, 56, 56, 55],
      green: [56, 56, 56, 54],
      yellow: [1, BASE, BASE, BASE],
    });
    g = applyRoll(g, 1, A);
    expect(g.rankings).toEqual(["red"]);
    expect(currentPlayer(g).userId).toBe(B);
    g = applyRoll(g, 2, B);
    expect(g.phase).toBe("finished");
    expect(g.rankings).toEqual(["red", "green", "yellow"]);
  });

  it("skips finished players", () => {
    let g = withPawns(createGame([A, B, C]), { red: [56, 56, 56, 55], green: [1, BASE, BASE, BASE] });
    g = applyRoll(g, 1, A); // red finishes
    g = applyRoll(g, 3, B); // green 1 -> 4
    expect(currentPlayer(g).userId).toBe(C);
    g = applyRoll(g, 2, C); // yellow can't move -> pass
    expect(currentPlayer(g).userId).toBe(B);
  });
});

describe("forfeit", () => {
  it("passes the turn and ends a two-player game", () => {
    const g = forfeit(createGame([A, B]), "red");
    expect(g.phase).toBe("finished");
    expect(g.rankings).toEqual(["yellow"]);
    expect(standings(g)).toEqual(["yellow", "red"]);
  });

  it("removes the player's pawns and skips them", () => {
    let g = withPawns(createGame([A, B, C]), { red: [10, 56, BASE, BASE] });
    g = forfeit(g, "red");
    expect(g.pawns.red).toEqual([BASE, 56, BASE, BASE]);
    expect(currentPlayer(g).color).toBe("green");
    expect(g.phase).toBe("roll");
  });
});

describe("auto play", () => {
  it("rolls and plays a move", () => {
    const g = autoPlay(withPawns(createGame([A, B]), { red: [5, 20, BASE, BASE] }), () => 2);
    expect(currentPlayer(g).userId).toBe(B);
    expect(g.events.map((e) => e.type)).toEqual(["roll", "move"]);
  });

  it("prefers capturing", () => {
    let g = withPawns(createGame([A, B]), { red: [10, 30, BASE, BASE], yellow: [38, BASE, BASE, BASE] });
    g = applyRoll(g, 2, A);
    expect(chooseAutoMove(g)).toBe(0);
  });

  it("plays a pending move", () => {
    let g = withPawns(createGame([A, B]), { red: [10, 30, BASE, BASE] });
    g = applyRoll(g, 1, A);
    g = autoPlay(g, () => 4);
    expect(currentPlayer(g).userId).toBe(B);
    expect(g.pawns.red).toEqual([10, 31, BASE, BASE]);
  });

  it("does nothing on a finished game", () => {
    const g = forfeit(createGame([A, B]), "red");
    expect(autoPlay(g, () => 6)).toBe(g);
  });
});
