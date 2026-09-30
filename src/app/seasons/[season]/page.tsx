import { LadderRoute } from "@/app/_components/LadderRoute";
import { SEASONS } from "@/lib/seasons";
import type { SeasonId } from "@/lib/types";

export function generateStaticParams() {
  return SEASONS.filter((season) => season.status === "archived").map((season) => ({ season: season.id }));
}

export default async function SeasonPage({ params }: { params: Promise<{ season: SeasonId }> }) {
  const { season } = await params;
  return <LadderRoute section="season" seasonId={season} />;
}
