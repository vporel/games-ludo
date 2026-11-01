import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Board from "./Board";

const pawns = { red: [-1, -1, -1, -1], yellow: [-1, -1, -1, -1] };
const names = { red: "alice", yellow: "bob" };

function blinking(html: string): string[] {
  return [...html.matchAll(/class="base-blink[^"]*"/g)].map((m) => m[0]);
}

describe("Board band blinking", () => {
  it("blinks the band of the player whose turn it is", () => {
    const html = renderToStaticMarkup(<Board pawns={pawns} names={names} currentColor="yellow" movable={[]} />);
    expect(blinking(html)).toEqual(['class="base-blink base-blink-yellow"']);
  });

  it("follows the turn to the next player", () => {
    const html = renderToStaticMarkup(<Board pawns={pawns} names={names} currentColor="red" movable={[]} />);
    expect(blinking(html)).toEqual(['class="base-blink base-blink-red"']);
  });

  it("does not blink once the game is over", () => {
    const html = renderToStaticMarkup(<Board pawns={pawns} names={names} currentColor={null} movable={[]} />);
    expect(blinking(html)).toEqual([]);
  });
});
