import type { Metadata } from "next";
import { LadderRoute } from "@/app/_components/LadderRoute";

export const metadata: Metadata = {
  title: "Upcoming Matches | Padel Ladder",
  description: "See this week's remaining boxes and the next scheduled ladder matches.",
};

export const dynamic = "force-static";

export default function UpcomingPage() {
  return <LadderRoute section="upcoming" />;
}
