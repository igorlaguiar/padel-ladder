import type { Metadata } from "next";
import { LadderRoute } from "@/app/_components/LadderRoute";

export const metadata: Metadata = {
  title: "Stats | MyLeague.Live",
  description: "League leaders, player form, and the current ladder ranking.",
};

export const dynamic = "force-static";

export default function StatsPage() {
  return <LadderRoute section="stats" />;
}
