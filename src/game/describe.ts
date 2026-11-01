import { Color, FINISH_PROGRESS } from "./constants";
import type { GameEvent } from "./engine";

export type LogTone = "info" | "good" | "bad";
export type LogLine = { text: string; color: Color; tone: LogTone };

/** Human readable log lines (French) for the events of one action. */
export function describeEvents(events: GameEvent[], names: Partial<Record<Color, string>>): LogLine[] {
  const n = (c: Color) => names[c] ?? c;
  const lines: LogLine[] = [];
  for (const e of events) {
    switch (e.type) {
      case "roll":
        lines.push({ color: e.color, tone: "info", text: `${n(e.color)} fait ${e.dice}${e.auto ? " (auto)" : ""}` });
        break;
      case "move":
        if (e.captures.length > 0) {
          const victims = [...new Set(e.captures.map((c) => n(c.color)))].join(", ");
          lines.push({ color: e.color, tone: "good", text: `${n(e.color)} capture ${victims} !` });
        } else if (e.from === -1) {
          lines.push({ color: e.color, tone: "info", text: `${n(e.color)} sort un pion` });
        } else if (e.to === FINISH_PROGRESS) {
          lines.push({ color: e.color, tone: "good", text: `${n(e.color)} ramène un pion à la maison` });
        }
        break;
      case "pass":
        // A pass for lack of a legal move is silent: the turn simply moves on.
        if (e.reason === "three-sixes") {
          lines.push({ color: e.color, tone: "bad", text: `Trois 6 d'affilée : ${n(e.color)} perd son tour` });
        }
        break;
      case "finish":
        lines.push({ color: e.color, tone: "good", text: `${n(e.color)} termine ${e.rank === 1 ? "1er 🏆" : `${e.rank}e`}` });
        break;
      case "forfeit":
        lines.push({ color: e.color, tone: "bad", text: `${n(e.color)} a quitté la partie` });
        break;
    }
  }
  return lines;
}
