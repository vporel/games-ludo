"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Color, COLOR_LABELS, FINISH_PROGRESS } from "@/game/constants";
import { currentPlayer, isActive, legalMoves, standings } from "@/game/engine";
import type { GameRow, RoomPlayer } from "@/lib/types";
import Board from "./Board";
import Dice from "./Dice";
import TurnTimer from "./TurnTimer";
import { useGameAnimation } from "./useGameAnimation";

const CSS_COLOR: Record<Color, string> = {
  red: "var(--red)",
  green: "var(--green)",
  yellow: "var(--yellow)",
  blue: "var(--blue)",
};

export type GameViewProps = {
  code: string;
  game: GameRow;
  players: RoomPlayer[];
  meId: string;
  hostId: string;
  online: Set<string>;
  clockOffset: number;
  onRoll: () => Promise<string | null>;
  onMove: (pawn: number) => Promise<string | null>;
  onExpire: () => void;
  onLeave: () => Promise<void>;
  onRematch: () => Promise<string | null>;
};

export default function GameView(props: GameViewProps) {
  const { game, players, meId, hostId, online, clockOffset } = props;
  const state = game.state;

  const names = useMemo(() => {
    const map: Partial<Record<Color, string>> = {};
    for (const slot of state.players) map[slot.color] = players.find((p) => p.userId === slot.userId)?.pseudo ?? "?";
    return map;
  }, [state.players, players]);

  const anim = useGameAnimation(state, names);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const finished = state.phase === "finished";
  const current = currentPlayer(state);
  const me = state.players.find((p) => p.userId === meId) ?? null;
  const myTurn = !finished && current.userId === meId && !!me && isActive(state, me.color);
  // While animating, show the turn of the state being animated would be complex: lock input instead.
  const canAct = myTurn && !anim.busy && !pending;
  const canRoll = canAct && state.phase === "roll";
  const movable = canAct && state.phase === "move" ? legalMoves(state) : [];

  // Vibrate when it becomes my turn.
  const wasMyTurn = useRef(myTurn);
  useEffect(() => {
    if (myTurn && !wasMyTurn.current && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(60);
    wasMyTurn.current = myTurn;
  }, [myTurn]);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 3000);
    return () => clearTimeout(id);
  }, [error]);

  async function run(fn: () => Promise<string | null>) {
    setPending(true);
    try {
      const err = await fn();
      if (err) setError(err);
    } finally {
      setPending(false);
    }
  }

  async function roll() {
    if (!canRoll) return;
    anim.startLocalRoll();
    await run(async () => {
      const err = await props.onRoll();
      if (err) anim.cancelLocalRoll();
      return err;
    });
  }

  // Stagger timeout calls between clients: the current player first, then the others by seat.
  const seat = state.players.findIndex((p) => p.userId === meId);
  const expireDelay = myTurn ? 600 : 1500 + Math.max(0, seat) * 900;

  const statusText = finished
    ? "Partie terminée"
    : anim.busy
      ? "…"
      : myTurn
        ? state.phase === "roll"
          ? "À toi ! Lance le dé"
          : "Choisis un pion à déplacer"
        : `Au tour de ${names[current.color]}`;

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-4 pb-8 flex flex-col lg:flex-row gap-4 lg:gap-6 lg:items-start">
      {/* Board */}
      <div className="relative w-full lg:flex-1 max-w-[min(100%,calc(100dvh-14rem))] lg:max-w-[min(100%,calc(100dvh-7rem))] mx-auto">
        <Board
          pawns={anim.pawns}
          names={names}
          currentColor={finished ? null : current.color}
          movable={movable}
          onPawnClick={(pawn) => void run(() => props.onMove(pawn))}
        />
        {anim.flash && (
          <div
            key={anim.flash.id}
            className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-2xl px-4 py-2 font-display font-bold text-lg text-white shadow-xl pop-in whitespace-nowrap"
            style={{ background: CSS_COLOR[anim.flash.color] }}
          >
            {anim.flash.text}
          </div>
        )}
      </div>

      {/* Side panel */}
      <aside className="w-full lg:w-80 flex flex-col gap-3">
        <div className="card p-4 flex items-center gap-4">
          <Dice value={anim.dice} rolling={anim.rolling} disabled={!canRoll} highlight={canRoll} onRoll={roll} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: CSS_COLOR[current.color] }} />
              {finished ? "Fin" : COLOR_LABELS[current.color]}
            </div>
            <p className="font-display text-xl font-bold leading-tight mt-0.5">{statusText}</p>
            {error && <p className="text-sm text-red font-semibold mt-1">{error}</p>}
          </div>
          {!finished && (
            <TurnTimer
              key={`${game.version}`}
              deadline={game.turnDeadline}
              clockOffset={clockOffset}
              color={CSS_COLOR[current.color]}
              expireDelayMs={expireDelay}
              onExpired={props.onExpire}
            />
          )}
        </div>

        <ul className="card p-2 flex flex-col">
          {state.players.map((slot) => {
            const p = players.find((x) => x.userId === slot.userId);
            const home = (state.pawns[slot.color] ?? []).filter((v) => v === FINISH_PROGRESS).length;
            const rank = state.rankings.indexOf(slot.color);
            const left = state.forfeited.includes(slot.color);
            const isTurn = !finished && current.color === slot.color;
            return (
              <li
                key={slot.color}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition ${isTurn ? "bg-surface-2" : ""}`}
              >
                <span
                  className="relative w-8 h-8 rounded-full grid place-items-center text-white font-bold text-sm uppercase shrink-0"
                  style={{ background: CSS_COLOR[slot.color] }}
                >
                  {(p?.pseudo ?? "?")[0]}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--surface)] ${
                      online.has(slot.userId) ? "bg-green" : "bg-[var(--border)]"
                    }`}
                  />
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold truncate ${left ? "line-through text-muted" : ""}`}>
                    {p?.pseudo ?? "?"}
                    {slot.userId === meId && <span className="text-muted font-semibold"> (toi)</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {left ? "A quitté" : rank >= 0 ? `Terminé · ${rank + 1}${rank === 0 ? "er" : "e"}` : `${home}/4 à la maison`}
                  </p>
                </div>
                {isTurn && <span className="text-xs font-bold text-primary">joue</span>}
                {rank === 0 && <span aria-label="Premier">🏆</span>}
              </li>
            );
          })}
        </ul>

        <div className="card p-3 hidden sm:block">
          <p className="text-xs font-bold uppercase tracking-wide text-muted px-1 mb-1">Journal</p>
          <ul className="max-h-48 overflow-y-auto flex flex-col gap-1 text-sm">
            {anim.log.length === 0 && <li className="text-muted px-1">La partie commence !</li>}
            {anim.log.map((l) => (
              <li key={l.id} className="flex items-center gap-2 px-1">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CSS_COLOR[l.color] }} />
                <span className={l.tone === "good" ? "font-bold" : l.tone === "bad" ? "text-muted" : ""}>{l.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-xs text-muted">
            Salle <span className="font-bold tabular-nums tracking-wider">{props.code}</span>
          </span>
          {!finished &&
            (confirmLeave ? (
              <span className="flex items-center gap-2">
                <span className="text-xs font-semibold">Abandonner ?</span>
                <button className="btn btn-primary !py-1.5 !px-3 text-sm" onClick={() => void props.onLeave()}>
                  Oui
                </button>
                <button className="btn btn-ghost !py-1.5 !px-3 text-sm" onClick={() => setConfirmLeave(false)}>
                  Non
                </button>
              </span>
            ) : (
              <button className="btn btn-ghost !py-1.5 !px-3 text-sm" onClick={() => setConfirmLeave(true)}>
                Quitter la partie
              </button>
            ))}
        </div>
      </aside>

      {finished && !anim.busy && (
        <Results
          order={standings(state)}
          names={names}
          meColor={me?.color ?? null}
          forfeited={state.forfeited}
          isHost={hostId === meId}
          onRematch={props.onRematch}
          onLeave={props.onLeave}
        />
      )}
    </div>
  );
}

function Results({
  order,
  names,
  meColor,
  forfeited,
  isHost,
  onRematch,
  onLeave,
}: {
  order: Color[];
  names: Partial<Record<Color, string>>;
  meColor: Color | null;
  forfeited: Color[];
  isHost: boolean;
  onRematch: () => Promise<string | null>;
  onLeave: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const medals = ["🥇", "🥈", "🥉", "4"];
  const won = meColor !== null && order[0] === meColor;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/45 backdrop-blur-sm px-4">
      <div className="card w-full max-w-sm p-6 pop-in text-center shadow-2xl">
        <p className="text-5xl">{won ? "🎉" : "🏁"}</p>
        <h2 className="font-display text-3xl font-bold mt-2">{won ? "Victoire !" : "Partie terminée"}</h2>
        <p className="text-muted mt-1">{names[order[0]]} remporte la partie.</p>
        <ol className="mt-5 flex flex-col gap-2 text-left">
          {order.map((color, i) => (
            <li key={color} className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2">
              <span className="w-7 text-center text-xl font-bold">{medals[i]}</span>
              <span className="w-3 h-3 rounded-full" style={{ background: CSS_COLOR[color] }} />
              <span className="font-bold flex-1 truncate">
                {names[color]}
                {color === meColor && <span className="text-muted font-semibold"> (toi)</span>}
              </span>
              {forfeited.includes(color) && <span className="text-xs text-muted">abandon</span>}
            </li>
          ))}
        </ol>
        {error && <p className="text-sm text-red font-semibold mt-3">{error}</p>}
        <div className="mt-6 flex flex-col gap-2">
          {isHost ? (
            <button
              className="btn btn-primary w-full"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                const err = await onRematch();
                if (err) setError(err);
                setPending(false);
              }}
            >
              Rejouer avec la même salle
            </button>
          ) : (
            <p className="text-sm text-muted">L&apos;hôte peut relancer une partie dans cette salle.</p>
          )}
          <button className="btn btn-ghost w-full" onClick={() => void onLeave()}>
            Retour à l&apos;accueil
          </button>
        </div>
      </div>
    </div>
  );
}
