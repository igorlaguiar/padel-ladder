import { describe, expect, it } from "vitest";
import { buildClubRanking, buildHeadToHeadRecord, buildLadderData, inferConfirmedSetResults, parseLadderCsv, parseScore, sortBoxPlayers } from "./ladder";
import type { ConfirmedSetResult, LadderWeek } from "./types";
import { buildWeeklyAwards, participantName } from "./weeklyAwards";
import { buildLeagueHighlights } from "./leagueHighlights";

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
  it("handles common delimiters, playoff notes, and compact scores", () => {
    expect(parseScore("6,6,7 (5-3)")).toEqual([6, 6, 7]);
    expect(parseScore("6, 4, 7")).toEqual([6, 4, 7]);
    expect(parseScore("6;4;7")).toEqual([6, 4, 7]);
    expect(parseScore("6; 4; 7")).toEqual([6, 4, 7]);
    expect(parseScore("6 4 7")).toEqual([6, 4, 7]);
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

  it("reconstructs all sets when sheet scores contain spaces after commas", () => {
    const spacedScores = `,8/6/2026,,,
Box 8 Crt 6,Scores,7:30 PM,Thu
,"6, 4, 7",Gerald Andriole,UP
Drew Wommack,"6, 6, 5",Bill Snyders,STAY
,"3, 6, 7",Igor Aguiar,STAY
,"3, 4, 5",Gregg Goldman,DOWN`;
    const box = parseLadderCsv(spacedScores)[0].boxes[0];

    expect(box.players.map((player) => player.total)).toEqual([17, 17, 16, 12]);
    expect(box.setResults).toHaveLength(3);
    expect(box.setResults.map((set) => set.teams.map((team) => team.games))).toEqual([
      [6, 3],
      [4, 6],
      [7, 5],
    ]);
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
    const baseline = buildLadderData(SAMPLE);
    const player = data.latestCompleted?.boxes[0].players[0];
    expect(player && participantName(player)).toBe("Alex Substitute");
    expect(data.profiles.find((profile) => profile.name === "Alex Ace")).toMatchObject({
      weeksPlayed: 0,
      totalGames: 0,
      promotions: 0,
      setsPlayed: 0,
      setsWon: 0,
      streak: 0,
    });
    for (const name of ["Blake Ball", "Casey Court", "Drew Drop"]) {
      const selectStats = (source: ReturnType<typeof buildLadderData>) => {
        const profile = source.profiles.find((candidate) => candidate.name === name);
        return profile && {
          weeksPlayed: profile.weeksPlayed,
          setsPlayed: profile.setsPlayed,
          setsWon: profile.setsWon,
          totalGames: profile.totalGames,
          promotions: profile.promotions,
          demotions: profile.demotions,
          stays: profile.stays,
        };
      };
      expect(selectStats(data)).toEqual(selectStats(baseline));
    }
    expect(data.profiles.find((profile) => profile.name === "Alex Substitute")).toBeUndefined();
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

  it("keeps head-to-head results for two roster players when another player uses a substitute", () => {
    const week = parseLadderCsv(SAMPLE.replace(',"6,6,6",Alex Ace', 'Alex Substitute,"6,6,6",Alex Ace'))[0];
    expect(buildHeadToHeadRecord([week], "Blake Ball", "Casey Court")).toEqual({
      sharedSessions: 1,
      setsTogether: 0,
      setsAgainst: 3,
      leftSetsWonAgainst: 2,
      rightSetsWonAgainst: 1,
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
    expect(data.profiles.find((player) => player.name === "Alex Ace")).toMatchObject({ setsPlayed: 3, setsWon: 3, totalGames: 18 });
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

  it("does not credit a roster player when that person appears as someone else's substitute", () => {
    const withRosterPlayerAsSub = SAMPLE.replace(',"6,6,6",Alex Ace', 'Evan Edge,"6,6,6",Alex Ace');
    const data = buildLadderData(withRosterPlayerAsSub);
    const baseline = buildLadderData(SAMPLE);
    const actual = data.profiles.find((profile) => profile.name === "Evan Edge");
    const expected = baseline.profiles.find((profile) => profile.name === "Evan Edge");

    expect(actual).toMatchObject({
      weeksPlayed: expected?.weeksPlayed,
      setsPlayed: expected?.setsPlayed,
      setsWon: expected?.setsWon,
      totalGames: expected?.totalGames,
      promotions: expected?.promotions,
    });
  });

  it("keeps a partial week in results and sends only unreported boxes to upcoming", () => {
    const partial = SAMPLE
      .replace(',"6,6,6",Alex Ace,UP,,,Alex Ace,', ',"6,6,6",Alex Ace,UP,,"6,6,6",Alex Ace,UP')
      .replace(',"6,4,6",Blake Ball,STAY,,,Blake Ball,', ',"6,4,6",Blake Ball,STAY,,"6,4,6",Blake Ball,STAY')
      .replace(',"4,6,3",Casey Court,STAY,,,Casey Court,', ',"4,6,3",Casey Court,STAY,,"4,6,3",Casey Court,STAY')
      .replace(',"4,4,3",Drew Drop,DOWN,,,Drew Drop,', ',"4,4,3",Drew Drop,DOWN,,"4,4,3",Drew Drop,DOWN');
    const data = buildLadderData(partial);

    expect(data.latestResults).toMatchObject({ dateKey: "2026-08-20", status: "partial", reportedBoxCount: 1, scheduledBoxCount: 2 });
    expect(data.latestCompleted?.dateKey).toBe("2026-08-13");
    expect(data.upcoming).toMatchObject({ dateKey: "2026-08-20", status: "scheduled" });
    expect(data.upcoming?.boxes.map((box) => box.number)).toEqual([2]);
    expect(buildLeagueHighlights(data).some((item) => item.label === "PLAYER OF THE WEEK")).toBe(false);
    expect(buildLeagueHighlights(data).some((item) => item.label === "BOX 1 WINNER" && item.text.includes("Alex Ace"))).toBe(true);
  });
});
