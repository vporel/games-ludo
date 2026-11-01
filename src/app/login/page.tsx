import AuthPage from "@/components/auth/AuthPage";

export const metadata = { title: "Connexion — Ludo" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthPage mode="login" next={next} />;
}
