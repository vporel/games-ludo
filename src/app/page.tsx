import { redirect } from "next/navigation";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import CreateRoomButton from "@/components/home/CreateRoomButton";
import JoinForm from "@/components/home/JoinForm";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/supabase/server";

export default async function Home() {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const { data: profile } = await supabaseAdmin()
    .from("ludo_profiles")
    .select("pseudo, games_played, games_won")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) redirect("/auth/signout");

  return (
    <div className="min-h-dvh flex flex-col">
      <Header pseudo={profile.pseudo} />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 pb-12 grid gap-8 lg:grid-cols-[1.1fr_1fr] items-center">
        <section className="pt-4 lg:pt-0">
          <p className="font-display text-primary font-semibold text-lg">Salut {profile.pseudo} 👋</p>
          <h1 className="font-display text-5xl sm:text-6xl font-bold leading-[1.02] mt-2">
            Lance les dés,
            <br />
            ramène tes pions.
          </h1>
          <p className="text-muted text-lg mt-4 max-w-md">
            Crée une salle, envoie le code à 6 chiffres à tes amis, et jouez au Ludo de 2 à 4 joueurs.
          </p>
          <dl className="mt-6 flex gap-3">
            <div className="card px-4 py-3">
              <dt className="text-xs text-muted font-semibold uppercase tracking-wide">Parties</dt>
              <dd className="font-display text-2xl font-bold tabular-nums">{profile.games_played}</dd>
            </div>
            <div className="card px-4 py-3">
              <dt className="text-xs text-muted font-semibold uppercase tracking-wide">Victoires</dt>
              <dd className="font-display text-2xl font-bold tabular-nums">{profile.games_won}</dd>
            </div>
          </dl>
        </section>

        <section className="card p-6 sm:p-8 flex flex-col gap-6 pop-in">
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-2xl font-bold">Nouvelle partie</h2>
            <p className="text-muted text-sm">Tu seras l&apos;hôte : c&apos;est toi qui lances la partie.</p>
            <div className="mt-2">
              <CreateRoomButton />
            </div>
          </div>
          <div className="flex items-center gap-3 text-muted text-sm font-semibold">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>
          <JoinForm />
        </section>
      </main>
      <Footer />
    </div>
  );
}
