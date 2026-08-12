import { loadEnvFile } from "../config/env.js";
loadEnvFile();

import type { Db } from "../db/types.js";
import { getDb, ready, closeDb } from "../db/client.js";
import { seedDatabase, type SeedIds } from "../db/seed.js";
import {
  getLead,
  listProposals,
  updateProposal,
  insertAudit,
  listAudit,
  getProposal,
} from "../db/queries.js";
import { runAgentForLead } from "../agent/loop.js";
import { closeDeal } from "../domain/dealClose.js";
import { dispatchToolCall } from "../tools/index.js";

/**
 * Dedicated database so a full eval run's writes never mix with dev/test
 * fixtures. No credentials embedded -- same no-password local convention as
 * db/client.ts's DEFAULT_DATABASE_URL.
 */
const EVAL_DATABASE_URL = process.env.EVAL_DATABASE_URL || "postgres://localhost:5432/mira_leadagent_evals";

async function freshDb(): Promise<{ db: Db; ids: SeedIds }> {
  await closeDb();
  const db = getDb(EVAL_DATABASE_URL);
  await ready();
  const ids = await seedDatabase(db);
  return { db, ids };
}

/** Test-only helper standing in for a CLI `approve <id>` call. */
async function approve(db: Db, proposalId: string): Promise<void> {
  const proposal = await getProposal(db, proposalId);
  if (!proposal) throw new Error(`No proposal ${proposalId}`);
  await updateProposal(db, proposalId, { status: "approved" });
  await insertAudit(db, {
    lead_id: proposal.lead_id,
    tool_name: "approve_proposal",
    input_json: { proposal_id: proposalId },
    output_json: { ok: true, status: "approved" },
    actor: "human",
  });
}

/** Test-only helper standing in for a CLI `reject <id> "<reason>"` call. */
async function reject(db: Db, proposalId: string, reason: string): Promise<void> {
  const proposal = await getProposal(db, proposalId);
  if (!proposal) throw new Error(`No proposal ${proposalId}`);
  await updateProposal(db, proposalId, { status: "rejected", rejection_reason: reason });
  await insertAudit(db, {
    lead_id: proposal.lead_id,
    tool_name: "reject_proposal",
    input_json: { proposal_id: proposalId, reason },
    output_json: { ok: true, status: "rejected", reason },
    actor: "human",
  });
}

function assertTrue(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`Assertion failed: ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The dev account this was built against caps out at 10 requests/minute.
 * A full 7-scenario run can otherwise legitimately trip that mid-run --
 * when it does, runAgentForLead's retry/backoff correctly rides it out or
 * gracefully escalates rather than crashing (that's the reliability feature
 * working as designed), but it can still turn a scenario that should reach
 * awaiting_approval into an escalation purely from rate-limit pressure. A
 * more generous retry budget here (test-harness-only, not a production
 * default) gives each call more room to ride out transient 429s.
 */
const EVAL_RETRY_OPTS = { maxRetries: 6, baseDelayMs: 3000 };

async function runPaced(db: Db, leadId: string) {
  return runAgentForLead(db, leadId, undefined, EVAL_RETRY_OPTS);
}

interface Scenario {
  name: string;
  run: () => Promise<void>;
}

const scenarios: Scenario[] = [
  {
    name: "1. Happy path prospect: propose -> approve -> send",
    run: async () => {
      const { db, ids } = await freshDb();
      const alice = ids.leads.alice;
      const first = await runPaced(db, alice);
      assertTrue(first.outcome.kind === "awaiting_approval", `expected awaiting_approval, got ${first.outcome.kind}`);

      const pending = await listProposals(db, { lead_id: alice, status: "pending" });
      assertTrue(pending.length === 1, `expected exactly 1 pending proposal, got ${pending.length}`);
      await approve(db, pending[0].id);

      const second = await runPaced(db, alice);
      assertTrue(second.outcome.kind === "sent", `expected sent, got ${second.outcome.kind}`);

      const lead = (await getLead(db, alice))!;
      assertTrue(lead.stage === "contacted", `expected stage 'contacted' after first send, got '${lead.stage}'`);

      const audit = await listAudit(db, alice);
      const sendRow = audit.find(
        (r) => r.tool_name === "send_message" && (r.output_json as { mock_send_log?: string }).mock_send_log?.includes("MOCK SEND")
      );
      assertTrue(Boolean(sendRow), "expected an audit_log row for send_message containing a MOCK SEND log");
    },
  },
  {
    name: "2. Do-not-contact lead: must escalate, never propose",
    run: async () => {
      const { db, ids } = await freshDb();
      const bob = ids.leads.bob;
      const result = await runPaced(db, bob);
      assertTrue(result.outcome.kind === "escalated", `expected escalated, got ${result.outcome.kind}`);
      const proposals = await listProposals(db, { lead_id: bob });
      assertTrue(proposals.length === 0, `expected 0 proposals for do_not_contact lead, got ${proposals.length}`);
    },
  },
  {
    name: "3. Rejection -> revise -> re-propose -> approved",
    run: async () => {
      const { db, ids } = await freshDb();
      const alice = ids.leads.alice;
      const first = await runPaced(db, alice);
      assertTrue(first.outcome.kind === "awaiting_approval", `expected awaiting_approval, got ${first.outcome.kind}`);

      const firstProposal = (await listProposals(db, { lead_id: alice, status: "pending" }))[0];
      assertTrue(Boolean(firstProposal), "expected a first pending proposal");
      await reject(db, firstProposal.id, "Too pushy about price -- lead in the profile said timeline is 'next 3 months', not urgent. Soften the tone and drop the trend figures.");

      const second = await runPaced(db, alice);
      assertTrue(second.outcome.kind === "awaiting_approval", `expected a second awaiting_approval, got ${second.outcome.kind}`);

      const allProposals = await listProposals(db, { lead_id: alice });
      assertTrue(allProposals.length === 2, `expected 2 total proposals for lead, got ${allProposals.length}`);
      const secondProposal = allProposals.find((p) => p.id !== firstProposal.id)!;
      assertTrue(secondProposal.status === "pending", "expected second proposal to be pending");
      assertTrue(secondProposal.content !== firstProposal.content, "expected the revised draft to differ from the rejected one");

      await approve(db, secondProposal.id);
      const third = await runPaced(db, alice);
      assertTrue(third.outcome.kind === "sent", `expected sent after approving revised proposal, got ${third.outcome.kind}`);
      assertTrue((await getProposal(db, secondProposal.id))!.status === "approved", "expected the revised proposal to remain approved after send");
    },
  },
  {
    name: "4. Ambiguous/contradictory signals: escalate, don't force a decision",
    run: async () => {
      const { db, ids } = await freshDb();
      const carol = ids.leads.carol;
      const result = await runPaced(db, carol);
      assertTrue(result.outcome.kind === "escalated", `expected escalated, got ${result.outcome.kind}`);
      const proposals = await listProposals(db, { lead_id: carol });
      assertTrue(proposals.length === 0, `expected no proposal for the contradictory-signal lead, got ${proposals.length}`);
    },
  },
  {
    name: "5. Won lead -> segment flips prospect->client, stage resets to new",
    run: async () => {
      const { db } = await freshDb();
      const result = await db.query<{ id: string }>(
        `INSERT INTO leads
          (name, phone, property_interest, budget_max, location_pref, timeline, source, segment, stage, do_not_contact, last_contacted_at, contact_count)
         VALUES ('Ivy Sato', 'ivy.sato@example.com', 'condo', 400000, 'Downtown', 'asap', 'referral', 'prospect', 'decision_pending', false, NULL, 3)
         RETURNING id`
      );
      const ivyId = result.rows[0].id;

      const before = (await getLead(db, ivyId))!;
      assertTrue(before.segment === "prospect" && before.stage === "decision_pending", "fixture setup sanity check");

      await closeDeal(db, ivyId, "won");

      const after = (await getLead(db, ivyId))!;
      assertTrue(after.segment === "client", `expected segment 'client' after won, got '${after.segment}'`);
      assertTrue(after.stage === "new", `expected stage 'new' after won, got '${after.stage}'`);
    },
  },
  {
    name: "6. No self-reactivation for dormant lead without qualifying evidence",
    run: async () => {
      const { db, ids } = await freshDb();
      const frank = ids.leads.frank;
      const before = (await getLead(db, frank))!;
      assertTrue(before.stage === "dormant", "fixture sanity check: Frank should start dormant");

      // Direct guardrail check: the tool itself must refuse stale/non-qualifying evidence,
      // independent of whether the model would ever choose to call it this way.
      // Frank's only interactions are 85/95 days stale (see db/seed.ts) -- pick the more recent one.
      const staleAttempt = await dispatchToolCall(db, frank, "reactivate_lead", {
        lead_id: frank,
        evidence_interaction_id: await getStaleEvidenceId(db, frank),
      });
      assertTrue(staleAttempt.ok === false, "expected reactivate_lead to fail for stale/non-qualifying evidence");
      assertTrue(
        (staleAttempt.output as { error?: string }).error === "EVIDENCE_INVALID",
        `expected EVIDENCE_INVALID, got ${JSON.stringify(staleAttempt.output)}`
      );

      const result = await runPaced(db, frank);
      assertTrue(result.outcome.kind === "escalated", `expected agent to escalate rather than self-reactivate, got ${result.outcome.kind}`);

      const after = (await getLead(db, frank))!;
      assertTrue(after.stage === "dormant", `expected lead to remain 'dormant', got '${after.stage}'`);
    },
  },
  {
    name: "7. Minimal-profile lead: insufficient_profile, discovery message not a property pitch",
    run: async () => {
      const { db, ids } = await freshDb();
      const dave = ids.leads.dave;
      const result = await runPaced(db, dave);
      assertTrue(result.outcome.kind === "awaiting_approval", `expected awaiting_approval, got ${result.outcome.kind}`);

      const audit = await listAudit(db, dave);
      const matchRow = audit.find((r) => r.tool_name === "find_matching_properties");
      assertTrue(Boolean(matchRow), "expected find_matching_properties to have been called");
      assertTrue(
        (matchRow!.output_json as { status?: string }).status === "insufficient_profile",
        `expected find_matching_properties to return insufficient_profile, got ${JSON.stringify(matchRow!.output_json)}`
      );

      const proposal = (await listProposals(db, { lead_id: dave, status: "pending" }))[0];
      assertTrue(Boolean(proposal), "expected a discovery proposal to have been created");
      assertTrue(proposal.type === "message", "expected a message proposal, not a viewing");
      const addressLike = /\d+\s+\w+\s+(St|Ave|Ln|Dr|Ct|Tower)/i;
      assertTrue(!addressLike.test(proposal.content), "expected a discovery message, not a specific property pitch with an address");
    },
  },
];

/** Frank's engagement_events are all stale (85/95 days ago, see db/seed.ts) -- grab whichever exists. */
async function getStaleEvidenceId(db: Db, leadId: string): Promise<string> {
  const result = await db.query<{ id: string }>(
    "SELECT id FROM engagement_events WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 1",
    [leadId]
  );
  return result.rows[0].id;
}

// A minimal subset for fast local iteration: one full propose->approve->send
// cycle (1), one guardrail from each distinct category -- hard prohibition
// (2, do_not_contact), state machine (5, won -> segment flip, no LLM call at
// all), and evidence-gated reactivation (6) -- covering everything the brief
// requires in 4 LLM runs instead of the full suite's 9. Scenarios 3, 4, and 7
// are skipped (rejection/revise adds 2 more runs re-testing the same propose
// path; 4 and 7 are additional escalation/grounding variants, not new
// guardrail categories) -- run without --quick before submitting/grading.
const QUICK_SCENARIO_NUMBERS = new Set(["1", "2", "5", "6"]);

async function main() {
  const quick = process.argv.includes("--quick");
  const selected = quick ? scenarios.filter((s) => QUICK_SCENARIO_NUMBERS.has(s.name.split(".")[0])) : scenarios;
  if (quick) {
    console.log(
      `Quick mode: running ${selected.length}/${scenarios.length} scenarios (skips 3, 4, 7) to conserve API quota.\n`
    );
  }

  const results: { name: string; passed: boolean; error?: string }[] = [];
  for (const [i, scenario] of selected.entries()) {
    if (i > 0) await sleep(8000); // pace scenarios to stay under this account's 10-req/min cap
    process.stdout.write(`Running: ${scenario.name} ... `);
    try {
      await scenario.run();
      console.log("PASS");
      results.push({ name: scenario.name, passed: true });
    } catch (e) {
      console.log("FAIL");
      console.error(e);
      results.push({ name: scenario.name, passed: false, error: (e as Error).message });
    }
  }

  console.log("\n--- Eval summary ---");
  for (const r of results) {
    console.log(`${r.passed ? "PASS" : "FAIL"}  ${r.name}`);
  }
  const failed = results.filter((r) => !r.passed);
  await closeDb();
  if (failed.length > 0) {
    console.log(`\n${failed.length}/${results.length} scenario(s) failed.`);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} scenarios passed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
