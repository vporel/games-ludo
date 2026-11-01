import { notFound } from "next/navigation";
import DevPlaygroundLoader from "./DevPlaygroundLoader";

export const metadata = { title: "Bac à sable — Ludo" };

/** Local hot-seat playground to preview the UI without Supabase. Development only. */
export default function DevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevPlaygroundLoader />;
}
