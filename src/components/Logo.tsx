import Link from "next/link";

export default function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const big = size === "lg";
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 font-display font-bold tracking-tight">
      <span className={`grid grid-cols-2 gap-[3px] rotate-45 ${big ? "w-10 h-10" : "w-7 h-7"}`} aria-hidden>
        <span className="rounded-[4px] bg-red" />
        <span className="rounded-[4px] bg-green" />
        <span className="rounded-[4px] bg-blue" />
        <span className="rounded-[4px] bg-yellow" />
      </span>
      <span className={big ? "text-5xl" : "text-2xl"}>Ludo</span>
    </Link>
  );
}
