import type { Db } from "../db/types.js";
import type { Lead } from "../domain/types.js";
import { listLeads, listProposals, isParkedOnEscalation } from "../db/queries.js";

/**
 * Candidate leads for the agent to work: not already closed won/lost, no
 * proposal currently awaiting human approval, and not already parked on a
 * prior escalation this run cycle hasn't resolved.
 */
export async function getQueue(db: Db): Promise<Lead[]> {
  const leads = await listLeads(db);
  const results: Lead[] = [];
  for (const lead of leads) {
    if (lead.stage === "won" || lead.stage === "lost") continue;
    const pending = await listProposals(db, { lead_id: lead.id, status: "pending" });
    if (pending.length > 0) continue;
    if (await isParkedOnEscalation(db, lead.id)) continue;
    results.push(lead);
  }
  return results;
}
