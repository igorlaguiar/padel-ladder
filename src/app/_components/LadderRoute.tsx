import { LadderApp, type LadderSection } from "@/features/ladder/LadderApp";
import { buildLadderData } from "@/lib/ladder";
import { buildArchivedSeasonData, buildCareerProfiles, SEASONS, SEASON_SHEETS } from "@/lib/seasons";
import type { SeasonData, SeasonId } from "@/lib/types";

const BUILD_REFRESH_KEY = new Date().toISOString().slice(0, 16);

function csvUrl(seasonId: SeasonId) {
  const source = SEASON_SHEETS[seasonId];
  return `https://docs.google.com/spreadsheets/d/${source.sheetId}/export?format=csv&gid=${source.gid}`;
}

export async function LadderRoute({
  section,
  seasonId = "summer-2026",
  allTime = false,
  showPwaInstallTest = false,
}: {
  section: LadderSection;
  seasonId?: SeasonId;
  allTime?: boolean;
  showPwaInstallTest?: boolean;
}) {
  try {
    const responses = await Promise.all(SEASONS.map((season) =>
      fetch(`${csvUrl(season.id)}&refresh=${encodeURIComponent(BUILD_REFRESH_KEY)}`, { cache: "force-cache" }),
    ));
    const failed = responses.find((response) => !response.ok);
    if (failed) throw new Error(`Sheet returned ${failed.status}`);
    const csv = await Promise.all(responses.map((response) => response.text()));
    const seasons: SeasonData[] = SEASONS.map((season, index) => ({
      season,
      data: season.id === "summer-2026"
        ? buildLadderData(csv[index], "static")
        : buildArchivedSeasonData(season.id, csv[index]),
    }));
    const selected = seasons.find((season) => season.season.id === seasonId) || seasons[0];
    return (
      <LadderApp
        data={selected.data}
        section={section}
        selectedSeason={selected.season}
        seasons={seasons}
        careerProfiles={buildCareerProfiles(seasons)}
        allTime={allTime}
        showPwaInstallTest={showPwaInstallTest}
      />
    );
  } catch {
    return (
      <main className="error-page">
        <span className="brand-mark">P/</span>
        <h1>The ladder is taking a breather.</h1>
        <p>Refresh the page in a moment. The Google Sheet could not be reached.</p>
      </main>
    );
  }
}
