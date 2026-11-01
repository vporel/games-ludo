"use client";

import { useEffect, useRef, useState } from "react";
import { TURN_DURATION_MS } from "@/game/constants";

/** Circular countdown for the current turn. Calls `onExpired` once the deadline has passed. */
export default function TurnTimer({
  deadline,
  clockOffset,
  color,
  expireDelayMs,
  onExpired,
}: {
  deadline: string | null;
  clockOffset: number;
  color: string;
  /** Extra wait after the deadline before calling onExpired (staggered between clients). */
  expireDelayMs: number;
  onExpired?: () => void;
}) {
  // null until mounted: the clock must not be read during server rendering (hydration mismatch).
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now() + clockOffset);
    const id = setInterval(() => setNow(Date.now() + clockOffset), 250);
    return () => clearInterval(id);
  }, [clockOffset]);

  const end = deadline ? new Date(deadline).getTime() : null;
  const remaining = end && now !== null ? Math.max(0, end - now) : TURN_DURATION_MS;
  const overdue = end !== null && now !== null && now - end > expireDelayMs;

  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;
  useEffect(() => {
    if (!overdue) return;
    onExpiredRef.current?.();
    // Retry while still overdue (e.g. a request failed or another client is slow).
    const id = setInterval(() => onExpiredRef.current?.(), 4000);
    return () => clearInterval(id);
  }, [overdue, deadline]);

  const ratio = remaining / TURN_DURATION_MS;
  const r = 16;
  const circ = 2 * Math.PI * r;
  const seconds = Math.ceil(remaining / 1000);
  const urgent = end !== null && seconds <= 10;

  return (
    <div className="relative w-11 h-11 shrink-0" aria-label={`${seconds} secondes restantes`}>
      <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
        <circle cx={20} cy={20} r={r} fill="none" stroke="var(--border)" strokeWidth={4} />
        <circle
          cx={20}
          cy={20}
          r={r}
          fill="none"
          stroke={urgent ? "var(--red)" : color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - ratio)}
          style={{ transition: "stroke-dashoffset 0.25s linear" }}
        />
      </svg>
      <span className={`absolute inset-0 grid place-items-center text-sm font-bold tabular-nums ${urgent ? "text-red" : ""}`}>
        {deadline ? seconds : "–"}
      </span>
    </div>
  );
}
