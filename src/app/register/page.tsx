import AuthPage from "@/components/auth/AuthPage";

export const metadata = { title: "Inscription — Ludo" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthPage mode="register" next={next} />;
}
