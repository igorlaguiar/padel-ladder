import { LadderRoute } from "@/app/_components/LadderRoute";

export const dynamic = "force-static";

export default function PwaTestPage() {
  return <LadderRoute section="home" showPwaInstallTest />;
}
