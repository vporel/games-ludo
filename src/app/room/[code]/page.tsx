import Link from "next/link";
import { redirect } from "next/navigation";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import RoomClient from "@/components/room/RoomClient";
import { normalizeRoomCode } from "@/lib/room-code";
import { getUserId } from "@/lib/supabase/server";
import { buildSnapshot, findActiveRoomByCode, getProfilePseudo } from "@/server/rooms";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return { title: `Salle ${normalizeRoomCode(code)} — Ludo` };
}

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = normalizeRoomCode(raw);
  const userId = await getUserId();
  if (!userId) redirect(`/login?next=${encodeURIComponent(`/room/${code}`)}`);
  const pseudo = await getProfilePseudo(userId);
  if (!pseudo) redirect("/auth/signout");

  const room = code.length === 6 ? await findActiveRoomByCode(code) : null;

  return (
    <div className="min-h-dvh flex flex-col">
      <Header pseudo={pseudo} />
      <main className="flex-1">
        {room ? (
          <RoomClient initial={await buildSnapshot(room, userId, pseudo)} />
        ) : (
          <div className="w-full max-w-md mx-auto px-4 py-10">
            <div className="card p-6 text-center">
              <h1 className="font-display text-2xl font-bold">Salle introuvable</h1>
              <p className="text-muted mt-2">Aucune salle active avec le code {code || "indiqué"}.</p>
              <Link href="/" className="btn btn-primary mt-5">
                Retour à l&apos;accueil
              </Link>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
