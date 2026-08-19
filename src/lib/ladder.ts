import type { LadderBox, LadderData, LadderWeek, Movement, PlayerProfile, PlayerResult } from "./types";

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
  for (const week of weeks) {
    for (const box of week.boxes) {
      for (const player of box.players) {
        const history = histories.get(player.name) || [];
        history.push(player);
        histories.set(player.name, history);
      }
    }
  }

  return [...histories.entries()]
    .map(([name, history]) => {
      const played = history.filter((item) => item.total !== null);
      const totalGames = played.reduce((sum, item) => sum + (item.total || 0), 0);
      const ordered = [...history].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
      let streak = 0;
      for (let i = played.length - 1; i >= 0; i -= 1) {
        if (played[i].movement !== "UP") break;
        streak += 1;
      }
      return {
        name,
        currentBox: ordered.at(-1)?.box || 0,
        highestBox: Math.min(...history.map((item) => item.box)),
        lowestBox: Math.max(...history.map((item) => item.box)),
        weeksPlayed: played.length,
        promotions: played.filter((item) => item.movement === "UP").length,
        demotions: played.filter((item) => item.movement === "DOWN").length,
        stays: played.filter((item) => item.movement === "STAY").length,
        totalGames,
        averageGames: played.length ? totalGames / played.length : 0,
        streak,
        history: ordered.reverse(),
      };
    })
    .sort((a, b) => a.currentBox - b.currentBox || a.name.localeCompare(b.name));
}

export function projectNextWeek(latest: LadderWeek | null): LadderWeek | null {
  if (!latest) return null;
  const maxBox = Math.max(...latest.boxes.map((box) => box.number));
  const destinations = new Map<number, PlayerResult[]>();

  for (const box of latest.boxes) {
    for (const player of box.players) {
      const delta = player.movement === "UP" ? -1 : player.movement === "DOWN" ? 1 : 0;
      const destination = Math.max(1, Math.min(maxBox, player.box + delta));
      const projected = { ...player, box: destination, rawScore: "", scores: [], total: null, movement: "" as Movement };
      destinations.set(destination, [...(destinations.get(destination) || []), projected]);
    }
  }

  const boxes = [...destinations.entries()]
    .map(([number, players]) => {
      const source = latest.boxes.find((box) => box.number === number);
      return { number, court: source?.court || "TBD", time: source?.time || "TBD", day: source?.day || "", players };
    })
    .sort((a, b) => a.number - b.number);

  return { date: "Next week", dateKey: "projected", boxes, completed: false };
}

export function buildLadderData(csv: string, source: "live" | "static" | "sample" = "live"): LadderData {
  const weeks = parseLadderCsv(csv);
  const completedWeeks = weeks.filter((week) => week.completed);
  const latestCompleted = completedWeeks.at(-1) || null;
  const upcoming = latestCompleted
    ? weeks.find((week) => week.dateKey > latestCompleted.dateKey && week.boxes.some((box) => box.players.length)) || null
    : weeks.at(-1) || null;
  return {
    weeks,
    latestCompleted,
    upcoming,
    projected: projectNextWeek(latestCompleted),
    profiles: buildProfiles(weeks),
    updatedAt: new Date().toISOString(),
    source,
  };
}
