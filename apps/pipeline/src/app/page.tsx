import { getDb, ready } from "@/lib/db";
import { listTransactions } from "@/lib/transactions";
import { PIPELINE_STAGES } from "@/lib/stage-machine";

export const dynamic = "force-dynamic";

const STAGE_LABELS: Record<string, string> = {
  showing: "Showing",
  offer: "Offer",
  under_contract: "Under Contract",
  inspection: "Inspection",
  closing: "Closing",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

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
  const transactions = await listTransactions(db);

  const byStage = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, transactions.filter((t) => t.stage === s)]));

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Transaction Pipeline</h1>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => (
          <div key={stage} className="min-w-64 flex-shrink-0 rounded-lg border border-neutral-200 dark:border-neutral-800">
            <div className="border-b border-neutral-200 px-3 py-2 text-sm font-medium dark:border-neutral-800">
              {STAGE_LABELS[stage]} ({byStage[stage].length})
            </div>
            <div className="flex flex-col gap-2 p-3">
              {byStage[stage].map((t) => (
                <div key={t.id} className="rounded border border-neutral-200 p-2 text-xs dark:border-neutral-800">
                  <div className="font-mono text-[10px] text-neutral-500">{t.id.slice(0, 8)}</div>
                  <div>Lead: {t.lead_id.slice(0, 8)}</div>
                  {t.offer_price != null && <div>Offer: {t.offer_price}</div>}
                  {t.expected_closing_date && <div>Closing: {t.expected_closing_date}</div>}
                </div>
              ))}
              {byStage[stage].length === 0 && <div className="text-xs text-neutral-400">No deals</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
