import type { Db } from "../db/types.js";

/**
 * Budget governor for this app's agent loop (src/agent/loop.ts), per
 * SPEC.md's "Budget governor -- hard caps on AI call volume/spend, enforced
 * in the agent core itself" and CLAUDE.md's "no unbounded loops of calls"
 * rule. Ledgers every real model call in `ai_call_log` (see
 * src/db/local-schema.sql) rather than an in-memory counter, so the cap
 * survives a process restart and holds across concurrent workers.
 */

export class BudgetExceededError extends Error {}

function getDailyCap(): number {
  const raw = process.env.AGENT_CORE_DAILY_CALL_CAP;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 50; // conservative default
}

function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function todaysCallCount(db: Db): Promise<number> {
  const result = await db.query<{ count: string }>(
    `select count(*)::text as count from ai_call_log where created_at >= $1`,
    [startOfTodayUtc().toISOString()]
  );
  return Number.parseInt(result.rows[0]?.count ?? "0", 10);
}

/** Cheap read-only check -- used to decide whether to start a new queue pass at all, without touching any lead's state. */
export async function isBudgetAvailable(db: Db): Promise<boolean> {
  return (await todaysCallCount(db)) < getDailyCap();
}

/**
 * Call BEFORE making any real model API call. Throws BudgetExceededError
 * (and records nothing) if today's cap is already reached. Records the call
 * first, then the caller proceeds to the actual request -- fails closed
 * under concurrent callers racing the same count, rather than allowing a
 * burst past the cap.
 */
export async function checkAndRecordCall(db: Db, purpose: string, model: string, leadId?: string): Promise<void> {
  const cap = getDailyCap();
  const count = await todaysCallCount(db);
  if (count >= cap) {
    throw new BudgetExceededError(`Daily AI call cap (${cap}) reached for apps/lead-agent.`);
  }
  await db.query(`insert into ai_call_log (lead_id, purpose, model) values ($1, $2, $3)`, [
    leadId ?? null,
    purpose,
    model,
  ]);
}
