import type { Metadata } from "next";
import { LadderRoute } from "@/app/_components/LadderRoute";

export const metadata: Metadata = {
  title: "Results | MyLeague.Live",
  description: "Past match results, weekly awards, and ladder movement.",
};

export const dynamic = "force-static";

export default function ResultsPage() {
  return <LadderRoute section="results" />;
}
