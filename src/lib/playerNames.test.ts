import { describe, expect, it } from "vitest";
import { buildLadderData } from "./ladder";
import { normalizePlayerName } from "./playerNames";
import { buildArchivedSeasonData, buildCareerProfiles, SEASONS } from "./seasons";

const weekCsv = (date: string, name: string, substitute = "") => `,${date},,,
Box 1 Crt 1,Scores,6:00 PM,Thur
${substitute},"6,6,6",${name},UP
,"6,4,6",Second Player,STAY
,"4,6,3",Third Player,STAY
,"4,4,3",Fourth Player,DOWN`;

describe("approved player name merges", () => {
  it.each([
    ["Vince Jouane", "Vincent Jouane"],
    ["Bill Snyder", "Bill Snyders"],
    ["Jim Meier", "James Meier"],
    ["Benajmin R", "Benjamin R"],
    ["Ben R", "Benjamin R"],
    ["Dugie Baron", "Doug Baron"],
    ["Dougie Baron", "Doug Baron"],
  ])("joins %s to %s before computing records", (alias, canonical) => {
    const data = buildLadderData(`${weekCsv("9/24/2026", alias)}\n${weekCsv("10/1/2026", canonical)}`);
    expect(data.profiles.filter((profile) => profile.name === canonical)).toHaveLength(1);
    expect(data.profiles.some((profile) => profile.name === alias)).toBe(false);
    expect(data.profiles.find((profile) => profile.name === canonical)).toMatchObject({ weeksPlayed: 2, setsWon: 6 });
    expect(data.ranking.filter((entry) => entry.name === canonical)).toHaveLength(1);
    expect(data.weeks[0].boxes[0].setResults[0].teams[0].players).toContain(canonical);
  });

  it("normalizes substitutes and keeps their appearances out of roster stats", () => {
    const data = buildLadderData(weekCsv("9/24/2026", "Benajmin R", "Jim Meier"));
    expect(data.weeks[0].boxes[0].players[0]).toMatchObject({ name: "Benjamin R", substitute: "James Meier" });
    expect(data.profiles.find((profile) => profile.name === "Benjamin R")?.weeksPlayed).toBe(0);
    const archive = buildArchivedSeasonData("winter-2026", weekCsv("1/8/2026", "Dugie Baron", "rep Jim Meier"));
    expect(archive.weeks[0].boxes[0].players[0].substitute).toBe("James Meier");
  });

  it("joins Baron records across current and archived seasons", () => {
    const fall = SEASONS.find((season) => season.id === "fall-2026")!;
    const winter = SEASONS.find((season) => season.id === "winter-2026")!;
    const careers = buildCareerProfiles([
      { season: fall, data: buildLadderData(weekCsv("9/24/2026", "Dougie Baron")) },
      { season: winter, data: buildArchivedSeasonData("winter-2026", weekCsv("1/8/2026", "Doug Baron")) },
    ]);
    expect(careers.filter((profile) => /Baron/.test(profile.name))).toHaveLength(1);
    expect(careers.find((profile) => profile.name === "Doug Baron")).toMatchObject({ seasonsPlayed: 2, weeksPlayed: 2, setsWon: 6 });
  });

  it("preserves team labels, other names, and formula errors", () => {
    for (const name of ["Van Rhein/Schoeman", "Waite/Johnson", "Chris Shepherd", "#REF!"]) {
      expect(normalizePlayerName(name)).toBe(name);
      expect(buildLadderData(weekCsv("9/24/2026", name)).weeks[0].boxes[0].players[0].name).toBe(name);
    }
  });
});
