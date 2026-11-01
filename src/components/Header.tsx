import { logout } from "@/app/actions/auth";
import Logo from "./Logo";
import ShowcaseLink from "./ShowcaseLink";

export default function Header({ pseudo }: { pseudo: string }) {
  return (
    <header className="w-full max-w-5xl mx-auto flex items-center justify-between px-4 py-4">
      <Logo />
      <div className="flex items-center gap-2">
        <span className="mr-2">
          <ShowcaseLink />
        </span>
        <span className="hidden sm:inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm font-bold">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-ink grid place-items-center text-xs uppercase">
            {pseudo[0]}
          </span>
          {pseudo}
        </span>
        <form action={logout}>
          <button type="submit" className="btn btn-ghost !py-1.5 !px-3 text-sm">
            Déconnexion
          </button>
        </form>
      </div>
    </header>
  );
}
