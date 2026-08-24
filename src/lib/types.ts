export type Movement = "UP" | "DOWN" | "STAY" | "";

export interface PlayerResult {
  name: string;
  substitute: string;
  rawScore: string;
  scores: number[];
  total: number | null;
  movement: Movement;
  box: number;
  court: string;
  time: string;
  day: string;
  date: string;
  dateKey: string;
}

export interface ConfirmedSetTeam {
  players: [string, string];
  games: number;
}

export interface ConfirmedSetResult {
  number: number;
  teams: [ConfirmedSetTeam, ConfirmedSetTeam];
}

export interface LadderBox {
  number: number;
  court: string;
  time: string;
  day: string;
  players: PlayerResult[];
  setResults: ConfirmedSetResult[];
}

export type WeekResultStatus = "scheduled" | "partial" | "complete";

export interface LadderWeek {
  date: string;
  dateKey: string;
  boxes: LadderBox[];
  status: WeekResultStatus;
  reportedBoxCount: number;
  scheduledBoxCount: number;
  completed: boolean;
}

export interface PlayerProfile {
  name: string;
  rank: number | null;
  highestRank: number | null;
  rankingHistory: Array<{ date: string; dateKey: string; week: number; rank: number; box: number }>;
  currentBox: number;
  highestBox: number;
  lowestBox: number;
  weeksPlayed: number;
  promotions: number;
  demotions: number;
  stays: number;
  setsPlayed: number;
  setsWon: number;
  totalGames: number;
  averageGames: number;
  streak: number;
  history: PlayerResult[];
}

export interface ClubRankingEntry {
  name: string;
  rank: number;
  box: number;
  movement: Movement;
}

export interface HeadToHeadRecord {
  sharedSessions: number;
  setsTogether: number;
  setsAgainst: number;
  leftSetsWonAgainst: number;
  rightSetsWonAgainst: number;
}

export interface LadderData {
  weeks: LadderWeek[];
  latestCompleted: LadderWeek | null;
  latestResults: LadderWeek | null;
  upcoming: LadderWeek | null;
  ranking: ClubRankingEntry[];
  profiles: PlayerProfile[];
  updatedAt: string;
  source: "live" | "static" | "sample";
}

export type SeasonId = "summer-2026" | "spring-2026" | "winter-2026";

export interface SeasonDefinition {
  id: SeasonId;
  label: string;
  shortLabel: string;
  status: "current" | "archived";
  dateRange: string;
}

export interface SeasonData {
  season: SeasonDefinition;
  data: LadderData;
}

export interface CareerProfile {
  name: string;
  seasons: Array<{ season: SeasonDefinition; profile: PlayerProfile }>;
  seasonsPlayed: number;
  weeksPlayed: number;
  promotions: number;
  demotions: number;
  stays: number;
  setsPlayed: number;
  setsWon: number;
  totalGames: number;
  highestBox: number;
  bestRank: number | null;
}
