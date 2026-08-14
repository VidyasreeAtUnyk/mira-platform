import { getDb, ready } from "@/lib/db";
import { listLeadsForNewTransaction, listAgentsForAssignment } from "@/lib/directory";
import { NewTransactionForm } from "@/components/new-transaction-form";

export const dynamic = "force-dynamic";

/**
 * The board (app/page.tsx) and its drag-and-drop only ever change an
 * *existing* transaction's stage -- there was no way to start a new deal at
 * all before this page. createTransaction()/POST /api/transactions already
 * existed (see src/lib/transactions.ts) but had no UI in front of it.
 */
export default async function NewTransactionPage() {
  const db = getDb();
  await ready();
  const [leads, agents] = await Promise.all([listLeadsForNewTransaction(db), listAgentsForAssignment(db)]);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-xl font-semibold">New Deal</h1>
      <p className="mb-4 text-xs text-neutral-500">Starts in the pipeline's entry stage, "Showing".</p>
      <NewTransactionForm leads={leads} agents={agents} />
    </div>
  );
}
