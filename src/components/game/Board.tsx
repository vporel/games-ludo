"use client";

import { BASE_SLOTS, Cell, HOME_COLUMN, TRACK, cellFor } from "@/game/board";
import {
	COLORS,
	Color,
	LAST_TRACK_PROGRESS,
	SAFE_INDICES,
	START_INDEX,
	TRACK_LENGTH,
} from "@/game/constants";
import { memo } from "react";

// The board always uses the light palette, even in dark mode, like a physical board.
const FILL: Record<Color, string> = {
	red: "#e5484d",
	green: "#2f9e66",
	yellow: "#f2b200",
	blue: "#3e63dd",
};
const SOFT: Record<Color, string> = {
	red: "#fbd5d6",
	green: "#cdeedb",
	yellow: "#fdeeb5",
	blue: "#d4defa",
};
/** Text/arrow color readable on each color. */
const INK: Record<Color, string> = { red: "white", green: "white", yellow: "#3a2e22", blue: "white" };

const BASE_ORIGIN: Record<Color, Cell> = {
	red: { x: 0, y: 0 },
	green: { x: 9, y: 0 },
	yellow: { x: 9, y: 9 },
	blue: { x: 0, y: 9 },
};
/** Direction of the arrow pointing into each home column (degrees). */
const ENTRY_ARROW: Record<Color, number> = { red: 0, green: 90, yellow: 180, blue: 270 };

export type BoardPawns = Partial<Record<Color, number[]>>;

type Props = {
	pawns: BoardPawns;
	names: Partial<Record<Color, string>>;
	currentColor: Color | null;
	movable: number[];
	onPawnClick?: (pawn: number) => void;
};

function Star({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
	const pts: string[] = [];
	for (let i = 0; i < 10; i++) {
		const a = (Math.PI / 5) * i - Math.PI / 2;
		const rr = i % 2 === 0 ? r : r * 0.45;
		pts.push(`${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`);
	}
	return <polygon points={pts.join(" ")} fill={fill} />;
}

/** Static board graphics: drawn once, never re-rendered while pawns move. */
const BoardBackground = memo(function BoardBackground({
	names,
	currentColor,
}: {
	names: Partial<Record<Color, string>>;
	currentColor: Color | null;
}) {
	const startColorAt = new Map(COLORS.map((c) => [START_INDEX[c], c]));
	// The cell just before each home column (progress 50) shows an arrow into the column.
	const entryColorAt = new Map(
		COLORS.map((c) => [(START_INDEX[c] + LAST_TRACK_PROGRESS) % TRACK_LENGTH, c]),
	);
	return (
		<g>
			<rect x={-0.25} y={-0.25} width={15.5} height={15.5} rx={0.6} fill="var(--board-frame)" />
			<rect x={0} y={0} width={15} height={15} rx={0.35} fill="var(--board-bg)" />

			{/* Track */}
			{TRACK.map((c, i) => {
				const start = startColorAt.get(i);
				const entry = entryColorAt.get(i);
				return (
					<g key={`t${i}`}>
						<rect
							x={c.x + 0.04}
							y={c.y + 0.04}
							width={0.92}
							height={0.92}
							rx={0.14}
							fill={start ? FILL[start] : "var(--board-bg)"}
							stroke="var(--board-line)"
							strokeWidth={0.04}
						/>
						{entry && (
							<path
								d="M -0.24 0 L 0.2 0 M 0.04 -0.17 L 0.22 0 L 0.04 0.17"
								transform={`translate(${c.x + 0.5} ${c.y + 0.5}) rotate(${ENTRY_ARROW[entry]})`}
								stroke={FILL[entry]}
								strokeWidth={0.1}
								strokeLinecap="round"
								strokeLinejoin="round"
								fill="none"
							/>
						)}
						{!start && SAFE_INDICES.has(i) && (
							<Star cx={c.x + 0.5} cy={c.y + 0.5} r={0.32} fill="#c4b497" />
						)}
					</g>
				);
			})}

			{/* Home columns */}
			{COLORS.map((color) =>
				HOME_COLUMN[color].map((c, i) => (
					<rect
						key={`h${color}${i}`}
						x={c.x + 0.04}
						y={c.y + 0.04}
						width={0.92}
						height={0.92}
						rx={0.14}
						fill={FILL[color]}
						opacity={0.9}
					/>
				)),
			)}

			{/* Center */}
			<polygon points="6,6 6,9 7.5,7.5" fill={FILL.red} />
			<polygon points="6,6 9,6 7.5,7.5" fill={FILL.green} />
			<polygon points="9,6 9,9 7.5,7.5" fill={FILL.yellow} />
			<polygon points="6,9 9,9 7.5,7.5" fill={FILL.blue} />
			<circle cx={7.5} cy={7.5} r={0.42} fill="var(--board-bg)" opacity={0.9} />
			<Star cx={7.5} cy={7.5} r={0.3} fill="var(--board-frame)" />

			{/* Bases */}
			{COLORS.map((color) => {
				const o = BASE_ORIGIN[color];
				const name = names[color];
				const unused = !name && Object.keys(names).length > 0;
				// The band of the player whose turn it is blinks, for everyone.
				const blink = currentColor === color;
				console.log("currentColor", currentColor, "color", color, "blink", blink);
				return (
					<g key={`b${color}`} opacity={unused ? 0.35 : 1}>
						<rect
							className={blink ? `base-blink base-blink-${color}` : undefined}
							x={o.x + 0.06}
							y={o.y + 0.06}
							width={5.88}
							height={5.88}
							rx={0.5}
							fill={FILL[color]}
						/>
						<rect
							x={o.x + 0.9}
							y={o.y + 0.9}
							width={4.2}
							height={4.2}
							rx={0.45}
							fill="var(--board-bg)"
						/>
						{BASE_SLOTS[color].map((s, i) => (
							<circle
								key={i}
								cx={s.x + 0.5}
								cy={s.y + 0.5}
								r={0.5}
								fill={SOFT[color]}
								stroke={FILL[color]}
								strokeWidth={0.06}
							/>
						))}
						{name && (
							<text
								x={o.x + 3}
								y={o.y + (o.y === 0 ? 0.62 : 5.62)}
								textAnchor="middle"
								dominantBaseline="middle"
								fontSize={0.48}
								fontWeight={800}
								fill={INK[color]}
								style={{ fontFamily: "var(--font-display)" }}
							>
								{name.length > 14 ? `${name.slice(0, 13)}…` : name}
							</text>
						)}
					</g>
				);
			})}
		</g>
	);
});

type PlacedPawn = { color: Color; index: number; x: number; y: number; scale: number };

function placePawns(pawns: BoardPawns): PlacedPawn[] {
	const groups = new Map<string, { color: Color; index: number; cell: Cell }[]>();
	for (const color of COLORS) {
		pawns[color]?.forEach((progress, index) => {
			const cell = cellFor(color, progress, index);
			const key = `${cell.x},${cell.y}`;
			const list = groups.get(key) ?? [];
			list.push({ color, index, cell });
			groups.set(key, list);
		});
	}
	const placed: PlacedPawn[] = [];
	const offsets = [
		[[0, 0]],
		[
			[-0.2, -0.12],
			[0.2, 0.12],
		],
		[
			[-0.2, -0.18],
			[0.2, -0.18],
			[0, 0.2],
		],
		[
			[-0.2, -0.2],
			[0.2, -0.2],
			[-0.2, 0.2],
			[0.2, 0.2],
		],
	];
	for (const list of groups.values()) {
		const n = Math.min(list.length, 4);
		list.forEach((p, i) => {
			const [dx, dy] =
				list.length > 4 ? [((i % 4) - 1.5) * 0.15, Math.floor(i / 4) * 0.2 - 0.2] : offsets[n - 1][i];
			placed.push({
				color: p.color,
				index: p.index,
				x: p.cell.x + 0.5 + dx,
				y: p.cell.y + 0.5 + dy,
				scale: list.length === 1 ? 1 : list.length === 2 ? 0.72 : 0.6,
			});
		});
	}
	return placed;
}

export default function Board({ pawns, names, currentColor, movable, onPawnClick }: Props) {
	const placed = placePawns(pawns);
	// Movable pawns are drawn last so they sit on top of stacks.
	placed.sort((a, b) => {
		const am = a.color === currentColor && movable.includes(a.index) ? 1 : 0;
		const bm = b.color === currentColor && movable.includes(b.index) ? 1 : 0;
		return am - bm;
	});

	return (
		<svg
			viewBox="-0.3 -0.3 15.6 15.6"
			className="w-full h-auto select-none drop-shadow-xl"
			role="img"
			aria-label="Plateau de Ludo"
		>
			<BoardBackground names={names} currentColor={currentColor} />
			{placed.map((p) => {
				const canMove = p.color === currentColor && movable.includes(p.index);
				return (
					<g
						key={`${p.color}-${p.index}`}
						className={`pawn ${canMove ? "pawn-movable" : ""}`}
						style={{ transform: `translate(${p.x}px, ${p.y}px) scale(${p.scale})` }}
						onClick={canMove ? () => onPawnClick?.(p.index) : undefined}
						role={canMove ? "button" : undefined}
						aria-label={canMove ? `Déplacer le pion ${p.index + 1}` : undefined}
					>
						{canMove && (
							<circle
								className="pawn-ring"
								r={0.48}
								fill="none"
								stroke="#2a2118"
								strokeWidth={0.07}
							/>
						)}
						<ellipse cx={0} cy={0.24} rx={0.3} ry={0.1} fill="black" opacity={0.25} />
						<circle r={0.34} fill={FILL[p.color]} stroke="white" strokeWidth={0.07} />
						<circle r={0.17} fill="white" opacity={0.35} />
						<circle cx={-0.1} cy={-0.12} r={0.08} fill="white" opacity={0.7} />
						{/* Larger invisible hit area for touch */}
						{canMove && <circle r={0.55} fill="transparent" />}
					</g>
				);
			})}
		</svg>
	);
}
