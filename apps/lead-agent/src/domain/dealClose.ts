import type { Db } from "../db/types.js";
import { getLead, updateLead, insertAudit } from "../db/queries.js";
import { ToolError } from "./errors.js";
import { assertStageTransition, applyWonTransition } from "./stateMachine.js";
import type { Stage } from "./types.js";

export type DealOutcome = Extract<Stage, "won" | "lost" | "canceled">;

/**
 * Recording that a deal actually closed (won/lost/canceled) is a real-world
 * fact no drafting agent should decide on its own -- there is no LLM tool for
 * it. It's a human action, exactly like approve/reject, so it lives here
 * rather than in src/tools, and is logged to audit_log with actor='human'.
 */
export async function closeDeal(db: Db, leadId: string, outcome: DealOutcome): Promise<void> {
  const lead = await getLead(db, leadId);
  if (!lead) throw new ToolError("NOT_FOUND", `No lead with id ${leadId}.`);

  assertStageTransition(lead.stage, outcome);

  if (outcome === "won") {
    const flip = applyWonTransition(lead);
    await updateLead(db, leadId, { stage: flip.stage, segment: flip.segment });
  } else {
    await updateLead(db, leadId, { stage: outcome });
  }

  await insertAudit(db, {
    lead_id: leadId,
    tool_name: "close_deal",
    input_json: { lead_id: leadId, outcome },
    output_json: { ok: true, previous_stage: lead.stage, new_stage: outcome === "won" ? "new" : outcome },
    actor: "human",
  });
}
