import { describe, expect, it } from "vitest";
import { buildLadderData, parseLadderCsv, parseScore } from "./ladder";

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

describe("buildLadderData", () => {
  it("finds upcoming play and creates the next ladder projection", () => {
    const data = buildLadderData(SAMPLE);
    expect(data.latestCompleted?.dateKey).toBe("2026-08-13");
    expect(data.upcoming?.dateKey).toBe("2026-08-20");
    expect(data.projected?.boxes[0].players.map((player) => player.name)).toContain("Evan Edge");
    expect(data.profiles.find((player) => player.name === "Alex Ace")?.promotions).toBe(1);
  });
});
