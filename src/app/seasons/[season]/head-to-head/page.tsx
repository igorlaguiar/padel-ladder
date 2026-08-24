import { LadderRoute } from "@/app/_components/LadderRoute";
import { SEASONS } from "@/lib/seasons";
import type { SeasonId } from "@/lib/types";

export const dynamic = "force-static";

export function generateStaticParams() {
  return SEASONS.filter((season) => season.status === "archived").map((season) => ({ season: season.id }));
}

export default async function ArchivedHeadToHeadPage({ params }: { params: Promise<{ season: string }> }) {
  const { season } = await params;
  return <LadderRoute section="head-to-head" seasonId={season as SeasonId} />;
}
