export const ROOM_CODE_PATTERN = /^[0-9]{6}$/;

export function normalizeRoomCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 6);
}

/** Random 6-digit code (may start with 0). `random` returns an integer in [0, 1_000_000). */
export function generateRoomCode(random: () => number): string {
  return String(random() % 1_000_000).padStart(6, "0");
}
