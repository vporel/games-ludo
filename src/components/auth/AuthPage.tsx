import Footer from "@/components/Footer";
import Logo from "@/components/Logo";
import ShowcaseLink from "@/components/ShowcaseLink";
import AuthForm from "./AuthForm";

export default function AuthPage({ mode, next }: { mode: "login" | "register"; next?: string }) {
  const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return (
    <div className="min-h-dvh flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center gap-8 px-4 py-10">
        <Logo size="lg" />
        <AuthForm mode={mode} next={safe} />
        <ShowcaseLink />
      </main>
      <Footer />
    </div>
  );
}
