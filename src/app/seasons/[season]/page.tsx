import { LadderRoute } from "@/app/_components/LadderRoute";
import type { SeasonId } from "@/lib/types";

export function generateStaticParams() {
  return [{ season: "spring-2026" }, { season: "winter-2026" }];
}

export default async function SeasonPage({ params }: { params: Promise<{ season: SeasonId }> }) {
  const { season } = await params;
  return <LadderRoute section="season" seasonId={season} />;
}
