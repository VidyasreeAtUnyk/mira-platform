import { randomUUID } from "node:crypto";
import type OpenAI from "openai";
import type { Test } from "./testHelpers.js";
import { assertTrue, createTestDb } from "./testHelpers.js";
import { isParkedOnEscalation, insertAudit } from "../db/queries.js";
import { dispatchToolCall } from "../tools/index.js";
import { runAgentForLead } from "../agent/loop.js";
import type { Db } from "../db/types.js";

async function seedMinimalLead(db: Db, id: string): Promise<void> {
  await db.query(
    `INSERT INTO leads (id, name, phone, source, segment, stage, do_not_contact, contact_count)
     VALUES ($1, 'Test Lead', 'test@example.com', 'website_form', 'prospect', 'new', false, 0)`,
    [id]
  );
}

// createCompletionWithRetry always calls .create(params).withResponse() --
// see the equivalent comment in retry.test.ts for why this shape matters.
function makeThrowingClient(status: number, headers?: Record<string, string>): OpenAI {
  return {
    chat: {
      completions: {
        create: () => ({
          withResponse: async () => {
            const err = new Error("simulated failure") as Error & { status: number; headers?: Record<string, string> };
            err.status = status;
            err.headers = headers;
            throw err;
          },
        }),
      },
    },
  } as unknown as OpenAI;
}

export const escalationTests: Test[] = [
  {
    name: "isParkedOnEscalation: a genuine model-decided escalation parks the lead",
    run: async () => {
      const db = await createTestDb();
      const leadId = randomUUID();
      await seedMinimalLead(db, leadId);
      const result = await dispatchToolCall(db, leadId, "escalate_to_agent", {
        lead_id: leadId,
        reason: "Contradictory signals from the lead",
      });
      assertTrue(result.ok, "expected escalate_to_agent to succeed");
      assertTrue(await isParkedOnEscalation(db, leadId), "a genuine (non-system-triggered) escalation should park the lead");
    },
  },
  {
    name: "isParkedOnEscalation: a system_triggered escalation (infra failure) does NOT park the lead",
    run: async () => {
      const db = await createTestDb();
      const leadId = randomUUID();
      await seedMinimalLead(db, leadId);
      const result = await dispatchToolCall(db, leadId, "escalate_to_agent", {
        lead_id: leadId,
        reason: "LLM call failed after retries: simulated",
        system_triggered: true,
      });
      assertTrue(result.ok, "expected escalate_to_agent to succeed");
      assertTrue(
        !(await isParkedOnEscalation(db, leadId)),
        "a system_triggered escalation (infra hiccup, not a model judgment call) should not park the lead"
      );
    },
  },
  {
    name: "runAgentForLead's own safety-net escalations (llm_call_failed) are system_triggered and don't park",
    run: async () => {
      const db = await createTestDb();
      const leadId = randomUUID();
      await seedMinimalLead(db, leadId);
      const stubClient = makeThrowingClient(429, { "retry-after": "2" });

      const result = await runAgentForLead(db, leadId, stubClient, { maxRetries: 1, baseDelayMs: 5 });

      assertTrue(result.outcome.kind === "escalated", `expected escalated, got ${result.outcome.kind}`);
      assertTrue(
        !(await isParkedOnEscalation(db, leadId)),
        "the agent loop's own safety-net escalation must not permanently park the lead -- it should be retried automatically next pass"
      );
    },
  },
  {
    name: "a human 'retry' action (new audit row) un-parks a genuinely parked lead",
    run: async () => {
      const db = await createTestDb();
      const leadId = randomUUID();
      await seedMinimalLead(db, leadId);
      await dispatchToolCall(db, leadId, "escalate_to_agent", { lead_id: leadId, reason: "do_not_contact concern" });
      assertTrue(await isParkedOnEscalation(db, leadId), "sanity check: lead should start parked");

      await insertAudit(db, {
        lead_id: leadId,
        tool_name: "retry_lead",
        input_json: { lead_id: leadId },
        output_json: { ok: true, unparked: true },
        actor: "human",
      });

      assertTrue(!(await isParkedOnEscalation(db, leadId)), "a newer audit row (the human retry action) should un-park the lead");
    },
  },
];
