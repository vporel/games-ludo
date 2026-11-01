export const PSEUDO_EMAIL_DOMAIN = "user.games.vporel.com";
export const PSEUDO_PATTERN = /^[a-z0-9_]{3,20}$/;

export function normalizePseudo(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Error message in French, or null if the pseudo is valid. Expects a normalized pseudo. */
export function pseudoError(pseudo: string): string | null {
  if (pseudo.length < 3) return "Le pseudo doit faire au moins 3 caractères.";
  if (pseudo.length > 20) return "Le pseudo doit faire au plus 20 caractères.";
  if (!PSEUDO_PATTERN.test(pseudo)) return "Lettres, chiffres et _ uniquement.";
  return null;
}

export function pseudoToEmail(pseudo: string): string {
  return `${pseudo}@${PSEUDO_EMAIL_DOMAIN}`;
}
