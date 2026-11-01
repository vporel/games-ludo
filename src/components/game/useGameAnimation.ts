"use client";

import { useEffect, useRef, useState } from "react";
import { BASE, Color } from "@/game/constants";
import { describeEvents, LogLine } from "@/game/describe";
import type { GameState } from "@/game/engine";
import type { BoardPawns } from "./Board";

const STEP_MS = 150;
const ROLL_MS = 450;
const MAX_LOG = 40;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function lastDice(state: GameState): number | null {
  if (state.dice) return state.dice;
  for (let i = state.events.length - 1; i >= 0; i--) {
    const e = state.events[i];
    if (e.type === "roll") return e.dice;
  }
  return null;
}

/**
 * Turns successive game states into a smooth animation: dice tumble, then the pawn walks cell by
 * cell, then captured pawns fly home. `busy` is true while an animation is playing.
 */
export function useGameAnimation(state: GameState, names: Partial<Record<Color, string>>) {
  const [pawns, setPawns] = useState<BoardPawns>(state.pawns);
  const [dice, setDice] = useState<number | null>(lastDice(state));
  const [rolling, setRolling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<(LogLine & { id: number })[]>([]);
  const [flash, setFlash] = useState<(LogLine & { id: number }) | null>(null);

  const seen = useRef(state.seq);
  const queue = useRef<GameState[]>([]);
  const running = useRef(false);
  const namesRef = useRef(names);
  namesRef.current = names;
  const logId = useRef(0);
  /** True while the local player's own roll request is in flight: the dice is already tumbling. */
  const localRoll = useRef(false);

  function startLocalRoll() {
    localRoll.current = true;
    setRolling(true);
  }

  function cancelLocalRoll() {
    localRoll.current = false;
    setRolling(false);
  }

  useEffect(() => {
    if (state.seq <= seen.current) return;
    seen.current = state.seq;
    queue.current.push(state);
    void pump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  async function pump() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    while (queue.current.length > 0) {
      const s = queue.current.shift()!;
      const instant = queue.current.length > 1 || document.hidden;
      await play(s, instant);
    }
    running.current = false;
    setBusy(false);
  }

  function pushLog(s: GameState) {
    const lines = describeEvents(s.events, namesRef.current).map((l) => ({ ...l, id: ++logId.current }));
    if (lines.length === 0) return;
    setLog((prev) => [...lines.reverse(), ...prev].slice(0, MAX_LOG));
    const notable = lines.find((l) => l.tone !== "info");
    if (notable) setFlash(notable);
  }

  async function play(s: GameState, instant: boolean) {
    if (!instant) {
      for (const e of s.events) {
        if (e.type === "roll") {
          if (localRoll.current) {
            localRoll.current = false;
          } else {
            setRolling(true);
            await sleep(ROLL_MS);
          }
          setRolling(false);
          setDice(e.dice);
          await sleep(220);
        } else if (e.type === "move") {
          const steps = e.from === BASE ? [0] : Array.from({ length: e.to - e.from }, (_, i) => e.from + i + 1);
          for (const p of steps) {
            setPawns((prev) => {
              const next = { ...prev, [e.color]: [...(prev[e.color] ?? [])] };
              next[e.color]![e.pawn] = p;
              return next;
            });
            await sleep(STEP_MS);
          }
          if (e.captures.length > 0) {
            await sleep(120);
            setPawns((prev) => {
              const next = { ...prev };
              for (const c of e.captures) {
                next[c.color] = [...(next[c.color] ?? [])];
                next[c.color]![c.pawn] = BASE;
              }
              return next;
            });
            await sleep(250);
          }
        } else if (e.type === "pass") {
          await sleep(350);
        }
      }
    }
    localRoll.current = false;
    setRolling(false);
    setDice(lastDice(s));
    setPawns(s.pawns);
    pushLog(s);
  }

  // Auto-hide the flash message.
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 2200);
    return () => clearTimeout(id);
  }, [flash]);

  return { pawns, dice, rolling, busy, log, flash, startLocalRoll, cancelLocalRoll };
}
