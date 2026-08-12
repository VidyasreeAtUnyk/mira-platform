import type { Pool } from "pg";
import { assertLegalPipelineTransition, isTerminalStage, type PipelineStage } from "./stage-machine";
import type {
  CreateTransactionInput,
  Transaction,
  TransactionStageHistoryRow,
  TransitionTransactionInput,
} from "../types";

export async function listTransactions(db: Pool, opts: { stage?: PipelineStage } = {}): Promise<Transaction[]> {
  const result = opts.stage
    ? await db.query<Transaction>("SELECT * FROM transactions WHERE stage = $1 ORDER BY updated_at DESC", [
        opts.stage,
      ])
    : await db.query<Transaction>("SELECT * FROM transactions ORDER BY updated_at DESC");
  return result.rows;
}

export async function getTransaction(db: Pool, id: string): Promise<Transaction | null> {
  const result = await db.query<Transaction>("SELECT * FROM transactions WHERE id = $1", [id]);
  return result.rows[0] ?? null;
}

export async function getTransactionHistory(db: Pool, id: string): Promise<TransactionStageHistoryRow[]> {
  const result = await db.query<TransactionStageHistoryRow>(
    "SELECT * FROM transaction_stage_history WHERE transaction_id = $1 ORDER BY changed_at ASC",
    [id],
  );
  return result.rows;
}

/**
 * Creates a new transaction always at the pipeline's entry stage
 * ('showing') -- SPEC.md's flow starts there, and there is deliberately no
 * "create directly into offer/under_contract/..." path: every deal must
 * pass through (or explicitly skip-record, via a future backfill tool, not
 * this one) the earlier stages so `transaction_stage_history` stays a
 * faithful audit trail.
 */
export async function createTransaction(db: Pool, input: CreateTransactionInput): Promise<Transaction> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query<Transaction>(
      `INSERT INTO transactions (lead_id, property_id, agent_id, offer_price, notes, stage)
       VALUES ($1, $2, $3, $4, $5, 'showing')
       RETURNING *`,
      [input.lead_id, input.property_id ?? null, input.agent_id ?? null, input.offer_price ?? null, input.notes ?? null],
    );
    const txn = inserted.rows[0];
    await client.query(
      `INSERT INTO transaction_stage_history (transaction_id, from_stage, to_stage, changed_by, note)
       VALUES ($1, NULL, 'showing', $2, 'Transaction created')`,
      [txn.id, input.agent_id ?? null],
    );
    await client.query("COMMIT");
    return txn;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Validates and applies a pipeline-stage transition, atomically: updates
 * `transactions.stage` (+ any stage-specific fields passed in) and appends
 * one row to `transaction_stage_history`, in the same DB transaction, so
 * the two can never disagree. Throws IllegalStageTransitionError (via
 * assertLegalPipelineTransition) before touching the DB at all if the
 * requested transition isn't legal from the row's current stage -- callers
 * (API routes) turn that into a 409, not a silent no-op.
 */
export async function transitionTransaction(
  db: Pool,
  id: string,
  input: TransitionTransactionInput,
): Promise<Transaction> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<Transaction>("SELECT * FROM transactions WHERE id = $1 FOR UPDATE", [id]);
    if (!current.rows[0]) {
      throw new Error(`No transaction found with id ${id}`);
    }
    const txn = current.rows[0];
    if (isTerminalStage(txn.stage)) {
      throw new Error(`Transaction ${id} is already in terminal stage '${txn.stage}' -- no further transitions allowed.`);
    }
    assertLegalPipelineTransition(txn.stage, input.to_stage);
    if (input.to_stage === "closed_lost" && !input.lost_reason) {
      throw new Error("lost_reason is required when transitioning to 'closed_lost'.");
    }

    const closedAt = input.to_stage === "closed_won" || input.to_stage === "closed_lost" ? new Date().toISOString() : null;

    const updated = await client.query<Transaction>(
      `UPDATE transactions
       SET stage = $2,
           offer_price = COALESCE($3, offer_price),
           contract_price = COALESCE($4, contract_price),
           expected_closing_date = COALESCE($5, expected_closing_date),
           lost_reason = COALESCE($6, lost_reason),
           closed_at = COALESCE($7, closed_at)
       WHERE id = $1
       RETURNING *`,
      [
        id,
        input.to_stage,
        input.offer_price ?? null,
        input.contract_price ?? null,
        input.expected_closing_date ?? null,
        input.lost_reason ?? null,
        closedAt,
      ],
    );

    await client.query(
      `INSERT INTO transaction_stage_history (transaction_id, from_stage, to_stage, changed_by, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, txn.stage, input.to_stage, input.changed_by ?? null, input.note ?? null],
    );

    await client.query("COMMIT");
    return updated.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
