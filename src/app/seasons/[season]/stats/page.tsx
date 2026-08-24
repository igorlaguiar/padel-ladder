import { LadderRoute } from "@/app/_components/LadderRoute";
import type { SeasonId } from "@/lib/types";

export function generateStaticParams() {
  return [{ season: "spring-2026" }, { season: "winter-2026" }];
}

export default async function SeasonStatsPage({ params }: { params: Promise<{ season: SeasonId }> }) {
  const { season } = await params;
  return <LadderRoute section="stats" seasonId={season} />;
}
