import { LadderApp } from "@/features/ladder/LadderApp";
import { buildLadderData } from "@/lib/ladder";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1RLhuK8yaBySLmfqh_0wU5oJ_cryP7CcpDTJkw35k0KQ/export?format=csv&gid=1294873893";

export const dynamic = "force-static";

export default async function Home() {
  try {
    const response = await fetch(CSV_URL, { cache: "force-cache" });
    if (!response.ok) throw new Error(`Sheet returned ${response.status}`);
    const data = buildLadderData(await response.text(), "static");
    return <LadderApp data={data} />;
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
