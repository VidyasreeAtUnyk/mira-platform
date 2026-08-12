import type { Db } from "./types.js";
import type {
  Lead,
  EngagementEvent,
  EngagementEventType,
  Proposal,
  ProposalType,
  ProposalStatus,
  AuditLogRow,
  AuditActor,
  Property,
  PropertyPriceHistory,
  RunMetric,
  RunOutcomeKind,
} from "../domain/types.js";
import { nowIso } from "./client.js";
import { LOCK_TIMEOUT_MS } from "../config/limits.js";

export async function getLead(db: Db, id: string): Promise<Lead | undefined> {
  const result = await db.query<Lead>("SELECT * FROM leads WHERE id = $1", [id]);
  return result.rows[0];
}

export async function listLeads(db: Db): Promise<Lead[]> {
  const result = await db.query<Lead>("SELECT * FROM leads ORDER BY created_at, id");
  return result.rows;
}

export async function updateLead(db: Db, id: string, patch: Partial<Lead>): Promise<void> {
  const keys = Object.keys(patch);
  if (keys.length === 0) return;
  const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  const values = keys.map((k) => (patch as Record<string, unknown>)[k]);
  await db.query(`UPDATE leads SET ${setClause} WHERE id = $1`, [id, ...values]);
}

export async function insertEngagementEvent(
  db: Db,
  input: { lead_id: string; type: EngagementEventType; created_at?: string; detail?: string | null }
): Promise<EngagementEvent> {
  const createdAt = input.created_at ?? nowIso();
  const result = await db.query<EngagementEvent>(
    "INSERT INTO engagement_events (lead_id, type, detail, created_at) VALUES ($1, $2, $3, $4) RETURNING *",
    [input.lead_id, input.type, input.detail ?? null, createdAt]
  );
  return result.rows[0];
}

export async function getEngagementEvent(db: Db, id: string): Promise<EngagementEvent | undefined> {
  const result = await db.query<EngagementEvent>("SELECT * FROM engagement_events WHERE id = $1", [id]);
  return result.rows[0];
}

export async function listEngagementEvents(db: Db, leadId: string): Promise<EngagementEvent[]> {
  const result = await db.query<EngagementEvent>(
    "SELECT * FROM engagement_events WHERE lead_id = $1 ORDER BY created_at ASC, id ASC",
    [leadId]
  );
  return result.rows;
}

export async function insertProposal(
  db: Db,
  input: { lead_id: string; type: ProposalType; content: string; proposed_time?: string | null }
): Promise<Proposal> {
  const result = await db.query<Proposal>(
    `INSERT INTO proposals (lead_id, type, content, status, rejection_reason, proposed_time, created_at)
     VALUES ($1, $2, $3, 'pending', NULL, $4, $5) RETURNING *`,
    [input.lead_id, input.type, input.content, input.proposed_time ?? null, nowIso()]
  );
  return result.rows[0];
}

export async function getProposal(db: Db, id: string): Promise<Proposal | undefined> {
  const result = await db.query<Proposal>("SELECT * FROM proposals WHERE id = $1", [id]);
  return result.rows[0];
}

export async function listProposals(
  db: Db,
  filter?: { status?: ProposalStatus; lead_id?: string }
): Promise<Proposal[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter?.status) {
    params.push(filter.status);
    clauses.push(`status = $${params.length}`);
  }
  if (filter?.lead_id !== undefined) {
    params.push(filter.lead_id);
    clauses.push(`lead_id = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await db.query<Proposal>(`SELECT * FROM proposals ${where} ORDER BY created_at ASC, id ASC`, params);
  return result.rows;
}

export async function updateProposal(db: Db, id: string, patch: Partial<Proposal>): Promise<void> {
  const keys = Object.keys(patch);
  if (keys.length === 0) return;
  const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  const values = keys.map((k) => (patch as Record<string, unknown>)[k]);
  await db.query(`UPDATE proposals SET ${setClause} WHERE id = $1`, [id, ...values]);
}

export async function insertAudit(
  db: Db,
  input: { lead_id: string | null; tool_name: string; input_json: unknown; output_json: unknown; actor: AuditActor }
): Promise<AuditLogRow> {
  const result = await db.query<AuditLogRow>(
    `INSERT INTO audit_log (lead_id, tool_name, input_json, output_json, actor, created_at)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [input.lead_id, input.tool_name, JSON.stringify(input.input_json), JSON.stringify(input.output_json), input.actor, nowIso()]
  );
  return result.rows[0];
}

export async function listAudit(db: Db, leadId: string): Promise<AuditLogRow[]> {
  const result = await db.query<AuditLogRow>(
    "SELECT * FROM audit_log WHERE lead_id = $1 ORDER BY created_at ASC, id ASC",
    [leadId]
  );
  return result.rows;
}

export async function countSendsInWindow(db: Db, leadId: string, sinceIso: string): Promise<number> {
  const result = await db.query<{ cnt: string }>(
    `SELECT COUNT(*) as cnt FROM audit_log
     WHERE lead_id = $1 AND tool_name = 'send_message' AND created_at >= $2
     AND output_json->>'ok' = 'true'`,
    [leadId, sinceIso]
  );
  return Number(result.rows[0].cnt);
}

export async function listProperties(db: Db): Promise<Property[]> {
  const result = await db.query<Property>("SELECT * FROM properties ORDER BY created_at, id");
  return result.rows;
}

export async function getProperty(db: Db, id: string): Promise<Property | undefined> {
  const result = await db.query<Property>("SELECT * FROM properties WHERE id = $1", [id]);
  return result.rows[0];
}

export async function listPriceHistory(db: Db, propertyId: string): Promise<PropertyPriceHistory[]> {
  const result = await db.query<PropertyPriceHistory>(
    "SELECT * FROM property_price_history WHERE property_id = $1 ORDER BY year ASC",
    [propertyId]
  );
  return result.rows;
}

export type EscalationStatus =
  | "none" // most recent action wasn't an escalation at all
  | "transient" // most recent action was a system_triggered (infra) escalation -- not blocked from the queue
  | "parked"; // most recent action was a genuine model-decided escalation -- needs a human `retry`

/**
 * Reads the single most recent audit_log row for a lead and classifies it.
 * "none" and "transient" both mean the lead is NOT excluded from the queue --
 * nothing runs in the background on its own (no daemon, no scheduler), but
 * whenever someone next runs `process`, this lead will be attempted like any
 * other, no special unblocking step required. The distinction from "parked"
 * exists purely so a human looking at the dashboard can tell "nothing has
 * happened" apart from "the last attempt just failed" instead of both
 * reading as identical blanks.
 */
export async function getEscalationStatus(db: Db, leadId: string): Promise<EscalationStatus> {
  const result = await db.query<{ tool_name: string; output_json: { escalated?: boolean; system_triggered?: boolean } }>(
    "SELECT tool_name, output_json FROM audit_log WHERE lead_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1",
    [leadId]
  );
  const row = result.rows[0];
  if (!row || row.tool_name !== "escalate_to_agent") return "none";
  // pg returns jsonb columns already parsed -- no JSON.parse needed.
  const output = row.output_json;
  if (!output.escalated) return "none";
  return output.system_triggered ? "transient" : "parked";
}

/**
 * True only for a genuine, model-decided escalation -- used to keep the
 * queue from re-escalating the same lead every run. A human action
 * (approve/reject/retry) or a fresh tool call writes a newer audit row and
 * un-parks it. A `system_triggered` escalation (the agent loop's own safety
 * net -- the LLM call failed, the model stopped calling tools, the turn
 * budget ran out) never parks: that's an infrastructure hiccup, not a
 * judgment call about the lead, so it's simply retried on the next pass.
 */
export async function isParkedOnEscalation(db: Db, leadId: string): Promise<boolean> {
  return (await getEscalationStatus(db, leadId)) === "parked";
}

export async function insertRunMetric(
  db: Db,
  input: {
    lead_id: string;
    started_at: string;
    ended_at: string;
    outcome: RunOutcomeKind;
    tool_call_count: number;
    estimated_token_cost: number;
  }
): Promise<void> {
  await db.query(
    `INSERT INTO run_metrics (lead_id, started_at, ended_at, outcome, tool_call_count, estimated_token_cost)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [input.lead_id, input.started_at, input.ended_at, input.outcome, input.tool_call_count, input.estimated_token_cost]
  );
}

export async function listRunMetrics(db: Db): Promise<RunMetric[]> {
  const result = await db.query<RunMetric>("SELECT * FROM run_metrics ORDER BY started_at, id");
  return result.rows;
}

/**
 * Idempotent locking guardrail: only one worker may hold a lead's lock at a
 * time. A lock older than LOCK_TIMEOUT_MS is treated as abandoned (the
 * process that held it presumably crashed) and can be re-acquired by anyone.
 */
export async function tryAcquireLock(db: Db, leadId: string, workerId: string, timeoutMs = LOCK_TIMEOUT_MS): Promise<boolean> {
  const lead = await getLead(db, leadId);
  if (!lead) return false;

  if (lead.locked_at && lead.locked_by) {
    const ageMs = Date.now() - new Date(lead.locked_at).getTime();
    if (ageMs < timeoutMs) return false; // still held by someone else and not expired
  }

  await db.query("UPDATE leads SET locked_at = $1, locked_by = $2 WHERE id = $3", [nowIso(), workerId, leadId]);
  return true;
}

/** Only releases the lock if this worker still holds it -- never clears a newer lock it doesn't own. */
export async function releaseLock(db: Db, leadId: string, workerId: string): Promise<void> {
  await db.query("UPDATE leads SET locked_at = NULL, locked_by = NULL WHERE id = $1 AND locked_by = $2", [
    leadId,
    workerId,
  ]);
}

export async function getRunState(db: Db): Promise<{ current_lead_id: string | null } | undefined> {
  const result = await db.query<{ current_lead_id: string | null }>("SELECT * FROM run_state WHERE id = 1");
  return result.rows[0];
}

export async function setRunState(db: Db, leadId: string | null): Promise<void> {
  await db.query(
    `INSERT INTO run_state (id, current_lead_id, updated_at) VALUES (1, $1, $2)
     ON CONFLICT (id) DO UPDATE SET current_lead_id = $1, updated_at = $2`,
    [leadId, nowIso()]
  );
}
