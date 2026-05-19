import { Dashboard } from "@/components/bfi/dashboard";
import { getBfiDemoData } from "@/lib/api/bfi";
import { buildDashboardSlice } from "@/lib/data/dashboard-slice";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // SSR has no token — mock data + synthetic screenings.
  const data = await getBfiDemoData();
  const slice = await buildDashboardSlice(data, null);
  return <Dashboard data={slice} />;
}
