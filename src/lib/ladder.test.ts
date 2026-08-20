import { describe, expect, it } from "vitest";
import { buildClubRanking, buildHeadToHeadRecord, buildLadderData, inferConfirmedSetResults, parseLadderCsv, parseScore, sortBoxPlayers } from "./ladder";
import type { ConfirmedSetResult, LadderWeek } from "./types";
import { buildWeeklyAwards, participantName } from "./weeklyAwards";

const SAMPLE = `,8/13/2026,,,,8/20/2026,,,
,,Time,Day,,,Time,Day
Box 1 Crt 1,Scores,6:00 PM,Thur,Box 1 Crt 1,Scores,7:30 PM,Thur
,"6,6,6",Alex Ace,UP,,,Alex Ace,
,"6,4,6",Blake Ball,STAY,,,Blake Ball,
,"4,6,3",Casey Court,STAY,,,Casey Court,
,"4,4,3",Drew Drop,DOWN,,,Drew Drop,
Box 2 Crt 2,Scores,7:30 PM,Thur,Box 2 Crt 2,Scores,6:00 PM,Thur
,"6,6,7 (5-3)",Evan Edge,UP,,,Drew Drop,
,"6,3,6",Finn Fast,STAY,,,Finn Fast,
,"3,6,4",Gale Game,STAY,,,Gale Game,
,"3,3,3",Hope High,DOWN,,,Hope High,`;

describe("parseScore", () => {
  it("handles comma scores, playoff notes, and compact scores", () => {
    expect(parseScore("6,6,7 (5-3)")).toEqual([6, 6, 7]);
    expect(parseScore("665")).toEqual([6, 6, 5]);
  });
});

describe("parseLadderCsv", () => {
  it("reads weekly boxes and player movement", () => {
    const weeks = parseLadderCsv(SAMPLE);
    expect(weeks).toHaveLength(2);
    expect(weeks[0].completed).toBe(true);
    expect(weeks[0].boxes[0].players[0]).toMatchObject({ name: "Alex Ace", total: 18, movement: "UP", box: 1 });
    expect(weeks[1].completed).toBe(false);
  });

  it("combines Wednesday and Thursday boxes into one league week", () => {
    const twoDays = `,8/19/2026,,,
Box 13 Crt 1,Scores,6:00 PM,Wed
,,Wed Player,
,,Wed Two,
,,Wed Three,
,,Wed Four,
,8/20/2026,,,
Box 1 Crt 1,Scores,6:00 PM,Thur
,,Thu Player,
,,Thu Two,
,,Thu Three,
,,Thu Four,`;
    const weeks = parseLadderCsv(twoDays);
    expect(weeks).toHaveLength(1);
    expect(weeks[0].date).toBe("Aug 19–Aug 20, 2026");
    expect(weeks[0].boxes.map((box) => box.number)).toEqual([1, 13]);
  });
});

describe("inferConfirmedSetResults", () => {
  it("reconstructs teams only when the four scores form two matching pairs", () => {
    const box = parseLadderCsv(SAMPLE)[0].boxes[0];
    expect(inferConfirmedSetResults(box.players)).toEqual([
      { number: 1, teams: [{ players: ["Alex Ace", "Blake Ball"], games: 6 }, { players: ["Casey Court", "Drew Drop"], games: 4 }] },
      { number: 2, teams: [{ players: ["Alex Ace", "Casey Court"], games: 6 }, { players: ["Blake Ball", "Drew Drop"], games: 4 }] },
      { number: 3, teams: [{ players: ["Alex Ace", "Blake Ball"], games: 6 }, { players: ["Casey Court", "Drew Drop"], games: 3 }] },
    ]);
  });

  it("omits an ambiguous set", () => {
    const players = parseLadderCsv(SAMPLE)[0].boxes[0].players.map((player) => ({ ...player, scores: [6, 6, 6] }));
    expect(inferConfirmedSetResults(players)).toEqual([]);
  });
});

describe("sortBoxPlayers", () => {
  const players = parseLadderCsv(SAMPLE)[0].boxes[0].players;

  it("sorts upcoming players by club rank", () => {
    const ranking = [
      { name: "Drew Drop", rank: 1, box: 1, movement: "DOWN" as const },
      { name: "Casey Court", rank: 2, box: 1, movement: "STAY" as const },
      { name: "Blake Ball", rank: 3, box: 1, movement: "STAY" as const },
      { name: "Alex Ace", rank: 4, box: 1, movement: "UP" as const },
    ];
    expect(sortBoxPlayers(players, "ranking", ranking).map((player) => player.name)).toEqual([
      "Drew Drop", "Casey Court", "Blake Ball", "Alex Ace",
    ]);
  });

  it("sorts completed results as UP, STAY, STAY, DOWN", () => {
    const shuffled = [players[3], players[2], players[0], players[1]];
    expect(sortBoxPlayers(shuffled, "result").map((player) => player.movement)).toEqual(["UP", "STAY", "STAY", "DOWN"]);
  });
});

describe("weekly awards and substitutes", () => {
  it("uses the substitute name in results and excludes the roster player from set totals", () => {
    const withSubstitute = SAMPLE.replace(',"6,6,6",Alex Ace', 'Alex Substitute,"6,6,6",Alex Ace');
    const data = buildLadderData(withSubstitute);
    const player = data.latestCompleted?.boxes[0].players[0];
    expect(player && participantName(player)).toBe("Alex Substitute");
    expect(data.profiles.find((profile) => profile.name === "Alex Ace")).toMatchObject({ setsPlayed: 0, setsWon: 0, streak: 0 });
    const awards = buildWeeklyAwards(data.latestCompleted!, data.weeks);
    expect(awards.find((award) => award.kind === "top")).toBeUndefined();
    expect(awards.find((award) => award.kind === "player")).toBeUndefined();
  });

  it("awards a clean sweep and the top of Box 1", () => {
    const data = buildLadderData(SAMPLE);
    const awards = buildWeeklyAwards(data.latestCompleted!, data.weeks);
    expect(awards.find((award) => award.kind === "top")?.recipients).toEqual([{ name: "Alex Ace" }]);
    expect(awards.find((award) => award.kind === "player")?.recipients).toEqual([{ name: "Alex Ace" }]);
  });

  it("separates clean-sweep players without a prior UP into honorable mentions", () => {
    const data = buildLadderData(SAMPLE);
    const original = data.latestCompleted!;
    const prior = {
      ...original,
      boxes: original.boxes.map((box) => ({
        ...box,
        players: box.players.map((player) => player.name === "Evan Edge" ? { ...player, movement: "STAY" as const } : player),
      })),
    };
    const current: LadderWeek = {
      ...original,
      date: "Aug 20, 2026",
      dateKey: "2026-08-20",
      boxes: original.boxes.map((box) => box.number === 2 ? {
        ...box,
        setResults: [
          { number: 1, teams: [{ players: ["Evan Edge", "Finn Fast"] as [string, string], games: 6 }, { players: ["Gale Game", "Hope High"] as [string, string], games: 3 }] },
          { number: 2, teams: [{ players: ["Evan Edge", "Gale Game"] as [string, string], games: 6 }, { players: ["Finn Fast", "Hope High"] as [string, string], games: 3 }] },
          { number: 3, teams: [{ players: ["Evan Edge", "Hope High"] as [string, string], games: 7 }, { players: ["Finn Fast", "Gale Game"] as [string, string], games: 6 }] },
        ] as ConfirmedSetResult[],
      } : box),
    };
    const award = buildWeeklyAwards(current, [prior, current]).find((candidate) => candidate.kind === "player");
    expect(award?.recipients).toEqual([{ name: "Alex Ace" }]);
    expect(award?.honorableMentions).toEqual([{ name: "Evan Edge" }]);
  });
});

describe("head-to-head records", () => {
  it("counts confirmed sets together and against", () => {
    const week = parseLadderCsv(SAMPLE)[0];
    expect(buildHeadToHeadRecord([week], "Alex Ace", "Blake Ball")).toEqual({
      sharedSessions: 1,
      setsTogether: 2,
      setsAgainst: 1,
      leftSetsWonAgainst: 1,
      rightSetsWonAgainst: 0,
    });
  });

  it("ignores a shared session when either roster player has a substitute", () => {
    const week = parseLadderCsv(SAMPLE.replace(',"6,6,6",Alex Ace', 'Alex Substitute,"6,6,6",Alex Ace'))[0];
    expect(buildHeadToHeadRecord([week], "Alex Ace", "Blake Ball")).toEqual({
      sharedSessions: 0,
      setsTogether: 0,
      setsAgainst: 0,
      leftSetsWonAgainst: 0,
      rightSetsWonAgainst: 0,
    });
  });
});

describe("buildLadderData", () => {
  it("finds upcoming play and creates the club ranking", () => {
    const data = buildLadderData(SAMPLE);
    expect(data.latestCompleted?.dateKey).toBe("2026-08-13");
    expect(data.upcoming?.dateKey).toBe("2026-08-20");
    expect(data.ranking.map(({ name, rank, box }) => ({ name, rank, box }))).toEqual([
      { name: "Alex Ace", rank: 1, box: 1 },
      { name: "Blake Ball", rank: 2, box: 1 },
      { name: "Casey Court", rank: 3, box: 1 },
      { name: "Evan Edge", rank: 4, box: 1 },
      { name: "Drew Drop", rank: 5, box: 2 },
      { name: "Finn Fast", rank: 6, box: 2 },
      { name: "Gale Game", rank: 7, box: 2 },
      { name: "Hope High", rank: 8, box: 2 },
    ]);
    expect(data.profiles.find((player) => player.name === "Evan Edge")).toMatchObject({ rank: 4, currentBox: 1 });
    expect(data.profiles.find((player) => player.name === "Evan Edge")).toMatchObject({ highestRank: 4 });
    expect(data.profiles.find((player) => player.name === "Evan Edge")?.rankingHistory[0]).toMatchObject({ week: 1, rank: 4 });
    expect(data.profiles.find((player) => player.name === "Alex Ace")?.promotions).toBe(1);
    expect(data.profiles.find((player) => player.name === "Alex Ace")).toMatchObject({ setsPlayed: 3, setsWon: 3 });
  });

  it("treats a substitute week as zero when two STAY players are tied", () => {
    const current = parseLadderCsv(SAMPLE)[0];
    const prior: LadderWeek = {
      ...current,
      date: "Aug 6, 2026",
      dateKey: "2026-08-06",
      boxes: current.boxes.map((box) => ({
        ...box,
        players: box.players.map((player) => player.name === "Blake Ball"
          ? { ...player, substitute: "Blake Sub", total: 18 }
          : player.name === "Casey Court" ? { ...player, total: 10 } : player),
      })),
    };
    const tiedCurrent: LadderWeek = {
      ...current,
      boxes: current.boxes.map((box) => ({
        ...box,
        players: box.players.map((player) => ["Blake Ball", "Casey Court"].includes(player.name) ? { ...player, total: 15 } : player),
      })),
    };

    const boxOne = buildClubRanking([prior, tiedCurrent]).filter((entry) => entry.box === 1);
    expect(boxOne.map((entry) => entry.name)).toEqual(["Alex Ace", "Casey Court", "Blake Ball", "Evan Edge"]);
  });
});
