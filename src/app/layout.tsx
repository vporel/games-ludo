import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

const display = Fredoka({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700"] });
const body = Nunito({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ludo : jeu entre amis",
  description: "Joue au Ludo en ligne, de 2 à 4 joueurs, avec un simple code de salle.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1e7" },
    { media: "(prefers-color-scheme: dark)", color: "#17130f" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${display.variable} ${body.variable} antialiased`}>{children}</body>
    </html>
  );
}
