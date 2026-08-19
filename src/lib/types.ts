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

export interface LadderBox {
  number: number;
  court: string;
  time: string;
  day: string;
  players: PlayerResult[];
}

export interface LadderWeek {
  date: string;
  dateKey: string;
  boxes: LadderBox[];
  completed: boolean;
}

export interface PlayerProfile {
  name: string;
  currentBox: number;
  highestBox: number;
  lowestBox: number;
  weeksPlayed: number;
  promotions: number;
  demotions: number;
  stays: number;
  totalGames: number;
  averageGames: number;
  streak: number;
  history: PlayerResult[];
}

export interface LadderData {
  weeks: LadderWeek[];
  latestCompleted: LadderWeek | null;
  upcoming: LadderWeek | null;
  projected: LadderWeek | null;
  profiles: PlayerProfile[];
  updatedAt: string;
  source: "live" | "static" | "sample";
}
