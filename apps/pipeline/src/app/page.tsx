import { getDb, ready } from "@/lib/db";
import { listTransactionsWithLead } from "@/lib/transactions";
import { PipelineBoard } from "@/components/pipeline-board";

export const dynamic = "force-dynamic";

/**
 * Was `redirect("/pipeline")` to a sub-route of the same name -- under
 * Next.js Multi-Zones (this app now has basePath: '/pipeline', see
 * next.config.ts), redirect() auto-prepends basePath to relative targets,
 * so that became an actual HTTP redirect to /pipeline/pipeline. Worse than
 * just a redundant-looking URL: a redirect issued by this zone leaks its
 * own origin/port back to the browser, breaking the single-origin illusion
 * multi-zones is supposed to provide when reached through the root zone's
 * rewrite (apps/dashboard/next.config.ts) -- caught by actually clicking
 * through from the dashboard, not just loading this app standalone. Fixed
 * by rendering the board directly at root instead of redirecting to it.
 * See PROGRESS-integration.md for the cross-app navigation decision.
 */
export default async function Home() {
  const db = getDb();
  await ready();
  const transactions = await listTransactionsWithLead(db);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Transaction Pipeline</h1>
      <p className="mb-4 text-xs text-neutral-500">Drag a card to a legal next stage, or click it for full details and history.</p>
      <PipelineBoard transactions={transactions} />
    </div>
  );
}
