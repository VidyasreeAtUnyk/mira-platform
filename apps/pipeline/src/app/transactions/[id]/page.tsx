import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, ready } from "@/lib/db";
import { getTransactionWithLead, getTransactionHistory } from "@/lib/transactions";
import { StageChanger } from "@/components/stage-changer";

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

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  await ready();

  const transaction = await getTransactionWithLead(db, id);
  if (!transaction) notFound();
  const history = await getTransactionHistory(db, id);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/" className="text-xs text-neutral-500 hover:underline">
        &larr; Back to board
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{transaction.lead_name ?? "(lead not found)"}</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {transaction.lead_phone}
            {transaction.lead_email ? ` · ${transaction.lead_email}` : ""}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium dark:border-neutral-700">
          {STAGE_LABELS[transaction.stage]}
        </span>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
        <div>
          <dt className="text-xs text-neutral-500">Offer price</dt>
          <dd>{transaction.offer_price != null ? `AED ${transaction.offer_price.toLocaleString()}` : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Contract price</dt>
          <dd>{transaction.contract_price != null ? `AED ${transaction.contract_price.toLocaleString()}` : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Expected closing</dt>
          <dd>{transaction.expected_closing_date ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Closed at</dt>
          <dd>{transaction.closed_at ? new Date(transaction.closed_at).toLocaleDateString() : "—"}</dd>
        </div>
        {transaction.property_id && (
          <div className="col-span-2">
            <dt className="text-xs text-neutral-500">Property</dt>
            <dd className="font-mono text-xs">{transaction.property_id}</dd>
          </div>
        )}
        {transaction.lost_reason && (
          <div className="col-span-2">
            <dt className="text-xs text-neutral-500">Lost reason</dt>
            <dd>{transaction.lost_reason}</dd>
          </div>
        )}
        {transaction.notes && (
          <div className="col-span-2">
            <dt className="text-xs text-neutral-500">Notes</dt>
            <dd>{transaction.notes}</dd>
          </div>
        )}
      </dl>

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold">Change stage</h2>
        <StageChanger transactionId={transaction.id} currentStage={transaction.stage} />
      </div>

      <div className="mt-8">
        <h2 className="mb-2 text-sm font-semibold">History</h2>
        <ol className="space-y-2 border-l border-neutral-200 pl-4 dark:border-neutral-800">
          {history.map((h) => (
            <li key={h.id} className="text-sm">
              <div>
                {h.from_stage ? `${STAGE_LABELS[h.from_stage]} → ${STAGE_LABELS[h.to_stage]}` : `Created in ${STAGE_LABELS[h.to_stage]}`}
              </div>
              <div className="text-xs text-neutral-500">
                {new Date(h.changed_at).toLocaleString()}
                {h.note ? ` · ${h.note}` : ""}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
