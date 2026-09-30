const PLAYER_NAME_ALIASES: Record<string, string> = {
  "Vince Jouane": "Vincent Jouane",
  "Bill Snyder": "Bill Snyders",
  "Jim Meier": "James Meier",
  "Benajmin R": "Benjamin R",
  "Ben R": "Benjamin R",
  "Dugie Baron": "Doug Baron",
  "Dougie Baron": "Doug Baron",
};

export function normalizePlayerName(name: string): string {
  const trimmed = name.trim();
  return Object.hasOwn(PLAYER_NAME_ALIASES, trimmed) ? PLAYER_NAME_ALIASES[trimmed] : trimmed;
}
