import type { Db } from "../db/types.js";
import { listRunMetrics } from "../db/queries.js";

export interface AggregateMetrics {
  totalRuns: number;
  escalationRate: number;
  avgToolCallsPerRun: number;
  totalEstimatedCost: number;
  avgApprovalTurnaroundMs: number | null;
}

/**
 * Derived from run_metrics (agent-run level stats) and proposals/audit_log
 * (human turnaround time) -- a lightweight first step toward "how is this
 * system actually behaving", not a real observability stack.
 */
export async function computeAggregateMetrics(db: Db): Promise<AggregateMetrics> {
  const runs = await listRunMetrics(db);
  const totalRuns = runs.length;
  const escalations = runs.filter((r) => r.outcome === "escalated").length;
  const escalationRate = totalRuns ? escalations / totalRuns : 0;
  const avgToolCallsPerRun = totalRuns ? runs.reduce((sum, r) => sum + r.tool_call_count, 0) / totalRuns : 0;
  const totalEstimatedCost = runs.reduce((sum, r) => sum + r.estimated_token_cost, 0);

  const proposalsResult = await db.query<{ id: string; created_at: string }>("SELECT id, created_at FROM proposals");
  const resolutionsResult = await db.query<{ input_json: { proposal_id?: string }; created_at: string }>(
    "SELECT input_json, created_at FROM audit_log WHERE tool_name IN ('approve_proposal', 'reject_proposal')"
  );

  const turnaroundsMs: number[] = [];
  for (const proposal of proposalsResult.rows) {
    const matches = resolutionsResult.rows
      .filter((r) => r.input_json?.proposal_id === proposal.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (matches.length === 0) continue;
    const delta = new Date(matches[0].created_at).getTime() - new Date(proposal.created_at).getTime();
    turnaroundsMs.push(delta);
  }
  const avgApprovalTurnaroundMs =
    turnaroundsMs.length > 0 ? turnaroundsMs.reduce((a, b) => a + b, 0) / turnaroundsMs.length : null;

  return { totalRuns, escalationRate, avgToolCallsPerRun, totalEstimatedCost, avgApprovalTurnaroundMs };
}
