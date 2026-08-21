import { boxHasResult } from "./ladder";
import type { LadderData } from "./types";
import { buildWeeklyAwards } from "./weeklyAwards";

export type LeagueHighlightKind = "leader" | "player" | "personal-best" | "bounce-back" | "streak" | "perfect" | "up";

export interface LeagueHighlight {
  id: string;
  kind: LeagueHighlightKind;
  label: string;
  text: string;
}

function perfectPlayers(data: LadderData): string[] {
  const week = data.latestResults;
  if (!week) return [];
  return week.boxes.filter(boxHasResult).flatMap((box) => box.players.flatMap((player) => {
    if (player.substitute) return [];
    const wonEverySet = box.setResults.length === 3 && box.setResults.every((set) => {
      const team = set.teams.find((candidate) => candidate.players.includes(player.name));
      const opponent = set.teams.find((candidate) => candidate !== team);
      return Boolean(team && opponent && team.games > opponent.games);
    });
    return wonEverySet ? [player.name] : [];
  }));
}

export function buildLeagueHighlights(data: LadderData): LeagueHighlight[] {
  const highlights: LeagueHighlight[] = [];
  const seen = new Set<string>();
  const add = (highlight: LeagueHighlight) => {
    const key = `${highlight.label}:${highlight.text}`;
    if (!seen.has(key)) {
      seen.add(key);
      highlights.push(highlight);
    }
  };

  const leader = data.ranking[0];
  if (leader) add({ id: `leader-${leader.name}`, kind: "leader", label: "TABLE LEADER", text: `${leader.name} · #1` });

  if (data.latestResults?.completed) {
    for (const award of buildWeeklyAwards(data.latestResults, data.weeks)) {
      const recipients = award.recipients.slice(0, 2);
      for (const recipient of recipients) {
        const label = award.kind === "player"
          ? "PLAYER OF THE WEEK"
          : award.kind === "personal-best"
            ? "PERSONAL BEST"
            : award.kind === "bounce-back"
              ? "BOUNCE BACK"
              : "TOP OF THE TABLE";
        const kind: LeagueHighlightKind = award.kind === "top" ? "leader" : award.kind;
        add({
          id: `${award.kind}-${recipient.name}`,
          kind,
          label,
          text: recipient.note ? `${recipient.name} · ${recipient.note}` : recipient.name,
        });
      }
    }
  } else {
    for (const name of perfectPlayers(data).slice(0, 2)) {
      add({ id: `perfect-${name}`, kind: "perfect", label: "PERFECT NIGHT", text: `${name} · 3 sets won` });
    }
  }

  for (const profile of [...data.profiles].sort((a, b) => b.streak - a.streak).filter((profile) => profile.streak >= 2).slice(0, 2)) {
    add({ id: `streak-${profile.name}`, kind: "streak", label: "ON A STREAK", text: `${profile.name} · ${profile.streak} UP weeks` });
  }

  const latest = data.latestResults;
  if (latest) {
    for (const box of latest.boxes.filter(boxHasResult)) {
      for (const player of box.players.filter((candidate) => !candidate.substitute && candidate.movement === "UP")) {
        add({
          id: `up-${latest.dateKey}-${player.name}`,
          kind: "up",
          label: box.number === 1 ? "BOX 1 WINNER" : "MOVING UP",
          text: box.number === 1 ? player.name : `${player.name} · Box ${box.number} → ${box.number - 1}`,
        });
      }
    }
  }

  return highlights.slice(0, 12);
}
