import { buildLadderDataFromWeeks, inferConfirmedSetResults, parseLadderCsv } from "./ladder";
import type { CareerProfile, LadderData, LadderWeek, PlayerResult, SeasonData, SeasonDefinition, SeasonId } from "./types";

export const SEASONS: SeasonDefinition[] = [
  { id: "summer-2026", label: "Summer 2026", shortLabel: "SUMMER '26", status: "current", dateRange: "July–September 2026" },
  { id: "spring-2026", label: "Spring 2026", shortLabel: "SPRING '26", status: "archived", dateRange: "April–June 2026" },
  { id: "winter-2026", label: "Winter 2026", shortLabel: "WINTER '26", status: "archived", dateRange: "January–March 2026" },
];

export const SEASON_SHEETS: Record<SeasonId, { sheetId: string; gid: string }> = {
  "summer-2026": { sheetId: "1R5ndg23EqVhadgBmcHeVIMiGYu8pRFWXkAcZ1oeIoFo", gid: "1294873893" },
  "spring-2026": { sheetId: "1FeOWoazs3Q3uv7hTOllUu8BJu2qqY7MOprp6pLNNxus", gid: "0" },
  "winter-2026": { sheetId: "1cy3Hum9Ncv4kbYlts95CdPiqNsyjW3M_96UxJRARhWg", gid: "0" },
};

const IGNORED_BOXES: Partial<Record<SeasonId, Set<string>>> = {
  "spring-2026": new Set(["2026-06-18:7", "2026-06-18:12", "2026-06-18:15", "2026-06-18:16"]),
  "winter-2026": new Set(["2026-03-19:9", "2026-03-19:10", "2026-03-19:16"]),
};

const CLEAR_SUBSTITUTE_PATTERNS = [
  /cager/i,
  /rock paper scissors/i,
  /heart attack/i,
  /stopped due to injury/i,
];

function normalizeArchivedPlayer(seasonId: SeasonId, player: PlayerResult): PlayerResult {
  const raw = player.substitute.trim();
  let substitute = raw;
  if (CLEAR_SUBSTITUTE_PATTERNS.some((pattern) => pattern.test(raw))) substitute = "";
  if (/^rep\s+/i.test(raw)) substitute = raw.replace(/^rep\s+/i, "").trim();
  if (/didn.t show,\s*oscar filled in/i.test(raw)) substitute = "Oscar";
  if (/no show/i.test(raw)) substitute = "No show";
  if (seasonId === "winter-2026" && /^injury\s*-\s*ge$/i.test(raw)) substitute = "Grant Edwards";
  return { ...player, substitute };
}

function summarizeNormalizedWeek(week: LadderWeek): LadderWeek {
  const reportedBoxCount = week.boxes.filter((box) => box.players.length === 4 && box.players.every((player) => Boolean(player.movement))).length;
  const scheduledBoxCount = week.boxes.length;
  const status = reportedBoxCount === 0 ? "scheduled" : reportedBoxCount === scheduledBoxCount ? "complete" : "partial";
  return { ...week, reportedBoxCount, scheduledBoxCount, status, completed: status === "complete" };
}

export function normalizeArchivedWeeks(seasonId: SeasonId, weeks: LadderWeek[]): LadderWeek[] {
  const ignored = IGNORED_BOXES[seasonId] || new Set<string>();
  return weeks.map((week) => summarizeNormalizedWeek({
    ...week,
    boxes: week.boxes
      .filter((box) => !ignored.has(`${week.dateKey}:${box.number}`))
      .map((box) => {
        const players = box.players.map((player) => normalizeArchivedPlayer(seasonId, player));
        return { ...box, players, setResults: inferConfirmedSetResults(players) };
      }),
  }));
}

export function buildArchivedSeasonData(seasonId: Exclude<SeasonId, "summer-2026">, csv: string): LadderData {
  const normalized = normalizeArchivedWeeks(seasonId, parseLadderCsv(csv));
  const data = buildLadderDataFromWeeks(normalized, "static");
  const ranked = new Map(data.ranking.map((entry) => [entry.name, entry]));
  const lastKnown = data.profiles
    .filter((profile) => profile.weeksPlayed && !ranked.has(profile.name))
    .map((profile) => {
      const position = profile.rankingHistory.at(-1);
      return position ? { name: profile.name, rank: position.rank, box: position.box, movement: "" as const } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const ranking = [...data.ranking, ...lastKnown]
    .sort((left, right) => left.rank - right.rank || left.box - right.box || left.name.localeCompare(right.name))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
  const ranks = new Map(ranking.map((entry) => [entry.name, entry.rank]));
  return { ...data, ranking, profiles: data.profiles.map((profile) => ({ ...profile, rank: ranks.get(profile.name) || null })) };
}

export function buildCareerProfiles(seasons: SeasonData[]): CareerProfile[] {
  const profiles = new Map<string, CareerProfile["seasons"]>();
  for (const season of seasons) {
    for (const profile of season.data.profiles) {
      if (!profile.weeksPlayed) continue;
      profiles.set(profile.name, [...(profiles.get(profile.name) || []), { season: season.season, profile }]);
    }
  }
  return [...profiles.entries()].map(([name, entries]) => ({
    name,
    seasons: entries,
    seasonsPlayed: entries.length,
    weeksPlayed: entries.reduce((sum, entry) => sum + entry.profile.weeksPlayed, 0),
    promotions: entries.reduce((sum, entry) => sum + entry.profile.promotions, 0),
    demotions: entries.reduce((sum, entry) => sum + entry.profile.demotions, 0),
    stays: entries.reduce((sum, entry) => sum + entry.profile.stays, 0),
    setsPlayed: entries.reduce((sum, entry) => sum + entry.profile.setsPlayed, 0),
    setsWon: entries.reduce((sum, entry) => sum + entry.profile.setsWon, 0),
    totalGames: entries.reduce((sum, entry) => sum + entry.profile.totalGames, 0),
    highestBox: Math.min(...entries.map((entry) => entry.profile.highestBox)),
    bestRank: entries.some((entry) => entry.profile.highestRank !== null)
      ? Math.min(...entries.flatMap((entry) => entry.profile.highestRank === null ? [] : [entry.profile.highestRank]))
      : null,
  })).sort((left, right) => right.seasonsPlayed - left.seasonsPlayed || right.weeksPlayed - left.weeksPlayed || left.name.localeCompare(right.name));
}
