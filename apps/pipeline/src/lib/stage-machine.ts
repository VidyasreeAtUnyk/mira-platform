/**
 * Transaction pipeline state machine (SPEC.md module 2: "Lead -> showing ->
 * offer -> under contract -> inspection -> closing. Distinct from raw
 * 'lead' concept in CRM.").
 *
 * This is deliberately NOT part of @mira/shared-types and does NOT extend
 * or reuse packages/shared-types/src/stage.ts's `STAGES`/`STAGE_EDGES`. See
 * PROGRESS-pipeline.md's "Notes / decisions made" for the full reasoning;
 * short version:
 *   - `leads.stage` (shared-types stage.ts) tracks a LEAD's qualification
 *     funnel: new -> contacted -> qualified -> viewing_scheduled ->
 *     decision_pending -> won/lost/canceled/dormant. It answers "how
 *     warmed-up is this prospect and are we still talking to them".
 *   - `transactions.stage` (this file) tracks a DEAL already in motion
 *     against a specific property, post-decision: showing -> offer ->
 *     under_contract -> inspection -> closing -> closed_won/closed_lost. It
 *     answers "how far through the legal/operational close process is this
 *     specific transaction".
 *   A single lead can have zero, one, or (rarely -- e.g. a deal falls
 *   through and the same lead later transacts on a different property)
 *   more than one transaction over its lifetime. They are a 1-to-many
 *   parent/child relationship (`transactions.lead_id`), not the same state
 *   machine wearing two names. `decision_pending` (lead-side "offer being
 *   considered") and `offer` (transaction-side "formal offer submitted")
 *   look similar but are not synonyms: a lead can sit in `decision_pending`
 *   with no transaction row yet (still just talk), and a transaction only
 *   gets created once there is a concrete showing to track.
 */

export const PIPELINE_STAGES = [
  "showing",
  "offer",
  "under_contract",
  "inspection",
  "closing",
  "closed_won",
  "closed_lost",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const TERMINAL_STAGES: PipelineStage[] = ["closed_won", "closed_lost"];

/**
 * Legal next stages from a given stage. The "happy path" forward edge plus
 * a `closed_lost` edge from every non-terminal stage (a deal can fall
 * through at any point -- financing falls through post-offer, inspection
 * turns up a dealbreaker, buyer walks pre-closing, etc.). No backward edges:
 * a real regression (e.g. inspection reveals a issue that reopens
 * negotiation) is modeled as staying in the current stage with a note, or
 * as a fresh transaction, not as a reverse transition -- keeps the state
 * machine a DAG and the history table monotonic, same design choice
 * shared-types/stage.ts made for leads (no generic backward edges, only an
 * explicit reactivation flow).
 */
export const PIPELINE_STAGE_EDGES: Record<PipelineStage, PipelineStage[]> = {
  showing: ["offer", "closed_lost"],
  offer: ["under_contract", "closed_lost"],
  under_contract: ["inspection", "closed_lost"],
  inspection: ["closing", "closed_lost"],
  closing: ["closed_won", "closed_lost"],
  closed_won: [],
  closed_lost: [],
};

export function isLegalPipelineTransition(from: PipelineStage, to: PipelineStage): boolean {
  return (PIPELINE_STAGE_EDGES[from] ?? []).includes(to);
}

export function isTerminalStage(stage: PipelineStage): boolean {
  return TERMINAL_STAGES.includes(stage);
}

export class IllegalStageTransitionError extends Error {
  constructor(
    public readonly from: PipelineStage,
    public readonly to: PipelineStage,
  ) {
    super(
      `Illegal pipeline stage transition: ${from} -> ${to}. Legal next stages from ${from}: ${
        PIPELINE_STAGE_EDGES[from].length ? PIPELINE_STAGE_EDGES[from].join(", ") : "(none -- terminal stage)"
      }.`,
    );
    this.name = "IllegalStageTransitionError";
  }
}

/** Throws IllegalStageTransitionError if the transition isn't legal; returns void (not a boolean) so callers can't silently ignore an illegal transition. */
export function assertLegalPipelineTransition(from: PipelineStage, to: PipelineStage): void {
  if (!isLegalPipelineTransition(from, to)) {
    throw new IllegalStageTransitionError(from, to);
  }
}
