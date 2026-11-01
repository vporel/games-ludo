"use client";

const PIPS: Record<number, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

const FACES: { value: number; transform: string }[] = [
  { value: 1, transform: "rotateY(0deg)" },
  { value: 6, transform: "rotateY(180deg)" },
  { value: 3, transform: "rotateY(90deg)" },
  { value: 4, transform: "rotateY(-90deg)" },
  { value: 5, transform: "rotateX(90deg)" },
  { value: 2, transform: "rotateX(-90deg)" },
];

const SHOW: Record<number, string> = {
  1: "rotateX(-12deg) rotateY(12deg)",
  6: "rotateX(-12deg) rotateY(192deg)",
  3: "rotateX(-12deg) rotateY(-78deg)",
  4: "rotateX(-12deg) rotateY(102deg)",
  5: "rotateX(-102deg) rotateY(0deg)",
  2: "rotateX(78deg) rotateY(0deg)",
};

type Props = {
  value: number | null;
  rolling: boolean;
  size?: number;
  disabled?: boolean;
  highlight?: boolean;
  onRoll?: () => void;
};

export default function Dice({ value, rolling, size = 72, disabled, highlight, onRoll }: Props) {
  const half = size / 2;
  return (
    <button
      type="button"
      onClick={onRoll}
      disabled={disabled}
      aria-label={value ? `Dé : ${value}. Lancer le dé` : "Lancer le dé"}
      className={`dice-scene relative rounded-2xl p-2 transition ${
        highlight ? "ring-4 ring-[var(--primary)]/40 animate-bounce [animation-duration:1.4s]" : ""
      } disabled:cursor-default`}
      style={{ width: size + 16, height: size + 16 }}
    >
      <div
        className={`dice-cube ${rolling ? "rolling" : ""}`}
        style={{ width: size, height: size, transform: rolling ? undefined : SHOW[value ?? 1] }}
      >
        {FACES.map((f) => (
          <div key={f.value} className="dice-face" style={{ transform: `${f.transform} translateZ(${half}px)` }}>
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className={PIPS[f.value].includes(i + 1) ? "dice-pip" : ""} />
            ))}
          </div>
        ))}
      </div>
    </button>
  );
}
