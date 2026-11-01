/** Link to the games showcase at the domain root: a plain anchor, since next/link would add the basePath. */
export default function ShowcaseLink() {
  return (
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a href="/" className="text-sm font-semibold text-muted hover:text-text transition">
      Tous les jeux
    </a>
  );
}
