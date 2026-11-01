export default function Footer() {
  return (
    <footer className="w-full max-w-5xl mx-auto px-4 py-6 text-sm text-muted flex flex-wrap items-center justify-between gap-2">
      <span>© {new Date().getFullYear()} vporel games</span>
      <a href="https://www.vporel.com" className="font-semibold hover:text-text transition">
        vporel.com
      </a>
    </footer>
  );
}
