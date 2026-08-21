import { LadderApp, type LadderSection } from "@/features/ladder/LadderApp";
import { buildLadderData } from "@/lib/ladder";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1R5ndg23EqVhadgBmcHeVIMiGYu8pRFWXkAcZ1oeIoFo/export?format=csv&gid=1294873893";
const BUILD_REFRESH_KEY = new Date().toISOString().slice(0, 16);

export async function LadderRoute({ section }: { section: LadderSection }) {
  try {
    const response = await fetch(`${CSV_URL}&refresh=${encodeURIComponent(BUILD_REFRESH_KEY)}`, { cache: "force-cache" });
    if (!response.ok) throw new Error(`Sheet returned ${response.status}`);
    const data = buildLadderData(await response.text(), "static");
    return <LadderApp data={data} section={section} />;
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
