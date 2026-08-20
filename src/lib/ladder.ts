import type { ClubRankingEntry, ConfirmedSetResult, HeadToHeadRecord, LadderBox, LadderData, LadderWeek, Movement, PlayerProfile, PlayerResult } from "./types";

const DATE_RE = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\s*$/;
const BOX_RE = /Box\s+(\d+)\s+(?:Crt|Ctrt)\s+(\d+)/i;

export function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    if (char === '"') {
      if (quoted && csv[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && csv[i + 1] === "\n") i += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function dateKey(value: string): string {
  const match = value.match(DATE_RE);
  if (!match) return "";
  const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  return `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function displayDate(key: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${key}T12:00:00Z`),
  );
}

function displayDateRange(startKey: string, endKey: string): string {
  const start = new Date(`${startKey}T12:00:00Z`);
  const end = new Date(`${endKey}T12:00:00Z`);
  const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const year = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "UTC" }).format(end);
  return `${monthDay.format(start)}–${monthDay.format(end)}, ${year}`;
}

export function parseScore(raw: string): number[] {
  const primary = raw.trim().split(/\s|\(/)[0];
  if (!primary) return [];
  if (/^\d{3}$/.test(primary)) return primary.split("").map(Number);
  return primary
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter(Number.isFinite)
    .slice(0, 3);
}

export function inferConfirmedSetResults(players: PlayerResult[]): ConfirmedSetResult[] {
  if (players.length !== 4) return [];

  return [0, 1, 2].flatMap((setIndex) => {
    const teamsByScore = new Map<number, string[]>();
    for (const player of players) {
      const games = player.scores[setIndex];
      if (!Number.isInteger(games)) return [];
      teamsByScore.set(games, [...(teamsByScore.get(games) || []), player.name]);
    }

    const teams = [...teamsByScore.entries()];
    if (teams.length !== 2 || teams.some(([, names]) => names.length !== 2)) return [];

    return [{
      number: setIndex + 1,
      teams: teams.map(([games, names]) => ({ players: [names[0], names[1]], games })) as ConfirmedSetResult["teams"],
    }];
  });
}

export function sortBoxPlayers(
  players: PlayerResult[],
  order: "ranking" | "result",
  ranking: ClubRankingEntry[] = [],
): PlayerResult[] {
  const rankByName = new Map(ranking.map((entry) => [entry.name, entry.rank]));
  const resultOrder: Record<Movement, number> = { UP: 0, STAY: 1, DOWN: 2, "": 3 };
  return players
    .map((player, index) => ({ player, index }))
    .sort((left, right) => {
      const difference = order === "ranking"
        ? (rankByName.get(left.player.name) ?? Number.MAX_SAFE_INTEGER) - (rankByName.get(right.player.name) ?? Number.MAX_SAFE_INTEGER)
        : resultOrder[left.player.movement] - resultOrder[right.player.movement];
      return difference || left.index - right.index;
    })
    .map(({ player }) => player);
}

export function parseLadderCsv(csv: string): LadderWeek[] {
  const rows = parseCsv(csv);
  const weekMap = new Map<string, LadderWeek>();
  let activeDates = new Map<number, string>();

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const datesInRow = new Map<number, string>();
    row.forEach((cell, col) => {
      if (DATE_RE.test(cell)) datesInRow.set(Math.floor(col / 4) * 4, dateKey(cell));
    });
    if (datesInRow.size) {
      activeDates = datesInRow;
      continue;
    }

    if (!row.some((cell) => BOX_RE.test(cell))) continue;

    for (let base = 0; base < row.length; base += 4) {
      const boxMatch = (row[base] || "").match(BOX_RE);
      const key = activeDates.get(base);
      if (!boxMatch || !key) continue;

      const number = Number(boxMatch[1]);
      const box: LadderBox = {
        number,
        court: boxMatch[2],
        time: row[base + 2] || "TBD",
        day: row[base + 3] || "",
        players: [],
        setResults: [],
      };

      for (let offset = 1; offset <= 4; offset += 1) {
        const playerRow = rows[rowIndex + offset] || [];
        const name = (playerRow[base + 2] || "").trim();
        if (!name) continue;
        const rawScore = (playerRow[base + 1] || "").trim();
        const scores = parseScore(rawScore);
        const movementValue = (playerRow[base + 3] || "").toUpperCase();
        const movement: Movement = movementValue === "UP" || movementValue === "DOWN" || movementValue === "STAY" ? movementValue : "";
        box.players.push({
          name,
          substitute: (playerRow[base] || "").trim(),
          rawScore,
          scores,
          total: scores.length ? scores.reduce((sum, score) => sum + score, 0) : null,
          movement,
          box: number,
          court: box.court,
          time: box.time,
          day: box.day,
          date: displayDate(key),
          dateKey: key,
        });
      }

      if (!box.players.length) continue;
      box.setResults = inferConfirmedSetResults(box.players);
      const week = weekMap.get(key) || { date: displayDate(key), dateKey: key, boxes: [], completed: false };
      week.boxes.push(box);
      weekMap.set(key, week);
    }
  }

  const individualDates = [...weekMap.values()]
    .map((week) => ({
      ...week,
      boxes: week.boxes.sort((a, b) => a.number - b.number),
      completed: week.boxes.some((box) => box.players.some((player) => player.total !== null && player.movement)),
    }))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  const leagueWeeks: LadderWeek[] = [];
  for (const week of individualDates) {
    const previous = leagueWeeks.at(-1);
    const oneDayApart = previous
      ? (new Date(`${week.dateKey}T12:00:00Z`).getTime() - new Date(`${previous.dateKey}T12:00:00Z`).getTime()) / 86_400_000 === 1
      : false;
    const existingBoxes = new Set(previous?.boxes.map((box) => box.number) || []);
    const separateBoxSets = week.boxes.every((box) => !existingBoxes.has(box.number));
    if (previous && oneDayApart && separateBoxSets) {
      const startKey = previous.dateKey;
      previous.dateKey = week.dateKey;
      previous.date = displayDateRange(startKey, week.dateKey);
      previous.boxes = [...previous.boxes, ...week.boxes].sort((a, b) => a.number - b.number);
      previous.completed = previous.completed || week.completed;
    } else {
      leagueWeeks.push({ ...week, boxes: [...week.boxes] });
    }
  }
  return leagueWeeks;
}

function buildProfiles(weeks: LadderWeek[]): PlayerProfile[] {
  const histories = new Map<string, PlayerResult[]>();
  const setRecords = new Map<string, { played: number; won: number }>();
  for (const week of weeks) {
    for (const box of week.boxes) {
      for (const player of box.players) {
        const history = histories.get(player.name) || [];
        history.push(player);
        histories.set(player.name, history);
      }
      if (week.completed) {
        for (const set of box.setResults) {
          const winningGames = Math.max(...set.teams.map((team) => team.games));
          for (const team of set.teams) {
            for (const name of team.players) {
              const player = box.players.find((candidate) => candidate.name === name);
              if (!player || player.substitute) continue;
              const record = setRecords.get(name) || { played: 0, won: 0 };
              record.played += 1;
              if (team.games === winningGames) record.won += 1;
              setRecords.set(name, record);
            }
          }
        }
      }
    }
  }

  return [...histories.entries()]
    .map(([name, history]) => {
      const played = history.filter((item) => item.total !== null && !item.substitute);
      const positioned = played.length ? played : history;
      const setRecord = setRecords.get(name) || { played: 0, won: 0 };
      const totalGames = played.reduce((sum, item) => sum + (item.total || 0), 0);
      const ordered = [...history].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
      let streak = 0;
      for (let i = played.length - 1; i >= 0; i -= 1) {
        if (played[i].substitute || played[i].movement !== "UP") break;
        streak += 1;
      }
      return {
        name,
        rank: null,
        highestRank: null,
        rankingHistory: [],
        currentBox: ordered.at(-1)?.box || 0,
        highestBox: Math.min(...positioned.map((item) => item.box)),
        lowestBox: Math.max(...positioned.map((item) => item.box)),
        weeksPlayed: played.length,
        promotions: played.filter((item) => item.movement === "UP").length,
        demotions: played.filter((item) => item.movement === "DOWN").length,
        stays: played.filter((item) => item.movement === "STAY").length,
        setsPlayed: setRecord.played,
        setsWon: setRecord.won,
        totalGames,
        averageGames: played.length ? totalGames / played.length : 0,
        streak,
        history: ordered.reverse(),
      };
    })
    .sort((a, b) => a.currentBox - b.currentBox || a.name.localeCompare(b.name));
}

function playerWeekScore(week: LadderWeek, name: string): number {
  const result = week.boxes.flatMap((box) => box.players).find((player) => player.name === name);
  return !result || result.substitute || result.total === null ? 0 : result.total;
}

export function buildClubRanking(completedWeeks: LadderWeek[]): ClubRankingEntry[] {
  const latest = completedWeeks.at(-1);
  if (!latest) return [];
  const maxBox = Math.max(...latest.boxes.map((box) => box.number));
  const destinations = new Map<number, Array<{ player: PlayerResult; priority: number }>>();

  for (const box of latest.boxes) {
    for (const player of box.players) {
      const delta = player.movement === "UP" ? -1 : player.movement === "DOWN" ? 1 : 0;
      const destination = Math.max(1, Math.min(maxBox, player.box + delta));
      const priority = destination > player.box || (destination === player.box && player.movement === "UP")
        ? 0
        : destination < player.box || (destination === player.box && player.movement === "DOWN")
          ? 2
          : 1;
      destinations.set(destination, [...(destinations.get(destination) || []), { player, priority }]);
    }
  }

  const recentFirst = [...completedWeeks].reverse();
  return [...destinations.entries()]
    .sort(([left], [right]) => left - right)
    .flatMap(([box, entries]) => entries
      .sort((left, right) => {
        if (left.priority !== right.priority) return left.priority - right.priority;
        for (const week of recentFirst) {
          const scoreDifference = playerWeekScore(week, right.player.name) - playerWeekScore(week, left.player.name);
          if (scoreDifference) return scoreDifference;
        }
        return left.player.name.localeCompare(right.player.name);
      })
      .map(({ player }, index) => ({
        name: player.name,
        rank: ((box - 1) * 4) + index + 1,
        box,
        movement: player.movement,
      })));
}

export function buildHeadToHeadRecord(weeks: LadderWeek[], leftName: string, rightName: string): HeadToHeadRecord {
  const record: HeadToHeadRecord = {
    sharedSessions: 0,
    setsTogether: 0,
    setsAgainst: 0,
    leftSetsWonAgainst: 0,
    rightSetsWonAgainst: 0,
  };

  for (const week of weeks.filter((candidate) => candidate.completed)) {
    for (const box of week.boxes) {
      const leftPlayer = box.players.find((player) => player.name === leftName);
      const rightPlayer = box.players.find((player) => player.name === rightName);
      if (!leftPlayer || !rightPlayer || leftPlayer.substitute || rightPlayer.substitute) continue;
      record.sharedSessions += 1;

      for (const set of box.setResults) {
        const leftTeam = set.teams.find((team) => team.players.includes(leftName));
        const rightTeam = set.teams.find((team) => team.players.includes(rightName));
        if (!leftTeam || !rightTeam) continue;
        if (leftTeam === rightTeam) {
          record.setsTogether += 1;
          continue;
        }
        record.setsAgainst += 1;
        if (leftTeam.games > rightTeam.games) record.leftSetsWonAgainst += 1;
        if (rightTeam.games > leftTeam.games) record.rightSetsWonAgainst += 1;
      }
    }
  }
  return record;
}

export function buildLadderData(csv: string, source: "live" | "static" | "sample" = "live"): LadderData {
  const weeks = parseLadderCsv(csv);
  const completedWeeks = weeks.filter((week) => week.completed);
  const latestCompleted = completedWeeks.at(-1) || null;
  const ranking = buildClubRanking(completedWeeks);
  const rankingByName = new Map(ranking.map((entry) => [entry.name, entry]));
  const rankingHistories = new Map<string, PlayerProfile["rankingHistory"]>();
  completedWeeks.forEach((week, index) => {
    for (const entry of buildClubRanking(completedWeeks.slice(0, index + 1))) {
      rankingHistories.set(entry.name, [
        ...(rankingHistories.get(entry.name) || []),
        { date: week.date, dateKey: week.dateKey, week: index + 1, rank: entry.rank, box: entry.box },
      ]);
    }
  });
  const upcoming = latestCompleted
    ? weeks.find((week) => week.dateKey > latestCompleted.dateKey && week.boxes.some((box) => box.players.length)) || null
    : weeks.at(-1) || null;
  return {
    weeks,
    latestCompleted,
    upcoming,
    ranking,
    profiles: buildProfiles(weeks).map((profile) => {
      const position = rankingByName.get(profile.name);
      const rankingHistory = rankingHistories.get(profile.name) || [];
      const highestRank = rankingHistory.length ? Math.min(...rankingHistory.map((entry) => entry.rank)) : null;
      return position
        ? { ...profile, rank: position.rank, currentBox: position.box, highestRank, rankingHistory }
        : { ...profile, highestRank, rankingHistory };
    }),
    updatedAt: new Date().toISOString(),
    source,
  };
}
