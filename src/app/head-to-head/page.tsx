import type { Metadata } from "next";
import { LadderRoute } from "@/app/_components/LadderRoute";

export const metadata: Metadata = {
  title: "Head to Head | MyLeague.Live",
  description: "Compare two players across ranking, results, and shared boxes.",
};

export const dynamic = "force-static";

export default function HeadToHeadPage() {
  return <LadderRoute section="head-to-head" />;
}
