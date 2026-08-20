import type { ConfirmedSetResult, LadderBox, LadderWeek, PlayerResult } from "./types";

export type WeeklyAwardKind = "top" | "player" | "personal-best" | "bounce-back";

export interface WeeklyAwardRecipient {
  name: string;
  note?: string;
}

export interface WeeklyAward {
  kind: WeeklyAwardKind;
  title: string;
  detail: string;
  recipients: WeeklyAwardRecipient[];
  honorableMentions?: WeeklyAwardRecipient[];
}

export const participantName = (player: PlayerResult): string => player.substitute.trim() || player.name;

function setOutcomes(box: LadderBox, rosterName: string): boolean[] {
  return [...box.setResults]
    .sort((a, b) => a.number - b.number)
    .flatMap((set: ConfirmedSetResult) => {
      const team = set.teams.find((candidate) => candidate.players.includes(rosterName));
      if (!team) return [];
      const opponent = set.teams.find((candidate) => candidate !== team);
      return opponent ? [team.games > opponent.games] : [];
    });
}

function movedUpInPreviousWeek(weeks: LadderWeek[], targetIndex: number, name: string): boolean {
  for (let index = targetIndex - 1; index >= 0; index -= 1) {
    if (!weeks[index].completed) continue;
    const previous = weeks[index].boxes.flatMap((box) => box.players)
      .find((player) => player.name === name && !player.substitute);
    return previous?.movement === "UP";
  }
  return false;
}

export function buildWeeklyAwards(week: LadderWeek, weeks: LadderWeek[]): WeeklyAward[] {
  const targetIndex = weeks.findIndex((candidate) => candidate.dateKey === week.dateKey);
  if (targetIndex < 0 || !week.completed) return [];

  const awards: WeeklyAward[] = [];
  const boxOne = week.boxes.find((box) => box.number === 1);
  const tableWinners = boxOne?.players.filter((player) => !player.substitute && player.movement === "UP") || [];
  if (tableWinners.length) {
    awards.push({
      kind: "top",
      title: "Top of the table",
      detail: "Won Box 1 this week.",
      recipients: tableWinners.map((player) => ({ name: player.name })),
    });
  }

  const perfectPlayers = week.boxes.flatMap((box) => box.players.flatMap((player) => {
    if (player.substitute) return [];
    const outcomes = setOutcomes(box, player.name);
    if (outcomes.length !== 3 || outcomes.some((won) => !won)) return [];
    return [{ name: player.name, cameFromUp: movedUpInPreviousWeek(weeks, targetIndex, player.name) }];
  }));

  if (perfectPlayers.length) {
    const cameFromUp = perfectPlayers.filter((player) => player.cameFromUp);
    const winners = perfectPlayers.length > 1 && cameFromUp.length ? cameFromUp : perfectPlayers;
    const honorableMentions = cameFromUp.length
      ? perfectPlayers.filter((player) => !player.cameFromUp).map((player) => ({ name: player.name }))
      : [];
    awards.push({
      kind: "player",
      title: winners.length > 1 ? "Players of the week" : "Player of the week",
      detail: cameFromUp.length ? "Won all three sets after an UP result last week." : "Won all three sets.",
      recipients: winners.map((winner) => ({ name: winner.name })),
      honorableMentions,
    });
  }

  const personalBests = week.boxes.flatMap((box) => box.players.flatMap((player) => {
    if (player.substitute || player.movement !== "UP") return [];
    const previousBoxes = weeks.slice(0, targetIndex).flatMap((candidate) =>
      candidate.completed
        ? candidate.boxes.flatMap((previousBox) => previousBox.players
          .filter((previous) => previous.name === player.name && !previous.substitute)
          .map(() => previousBox.number))
        : [],
    );
    if (!previousBoxes.length) return [];
    const destination = Math.max(1, box.number - 1);
    return destination < Math.min(...previousBoxes) ? [{ name: player.name, note: `Box ${destination}` }] : [];
  }));
  if (personalBests.length) {
    awards.push({
      kind: "personal-best",
      title: personalBests.length > 1 ? "New personal bests" : "New personal best",
      detail: "Reached a highest-ever ladder box.",
      recipients: personalBests,
    });
  }

  const bounceBacks = week.boxes.flatMap((box) => box.players.flatMap((player) => {
    if (player.substitute || player.movement !== "UP") return [];
    let previous: PlayerResult | undefined;
    for (let index = targetIndex - 1; index >= 0 && !previous; index -= 1) {
      if (!weeks[index].completed) continue;
      previous = weeks[index].boxes.flatMap((candidate) => candidate.players)
        .find((candidate) => candidate.name === player.name && !candidate.substitute);
    }
    return previous?.movement === "DOWN" ? [{ name: player.name }] : [];
  }));
  if (bounceBacks.length) {
    awards.push({
      kind: "bounce-back",
      title: "Bounce back",
      detail: "Moved UP after a DOWN result.",
      recipients: bounceBacks,
    });
  }

  return awards;
}
