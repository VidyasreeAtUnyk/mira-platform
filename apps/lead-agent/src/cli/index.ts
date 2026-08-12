#!/usr/bin/env node
import { loadEnvFile } from "../config/env.js";
loadEnvFile();

import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import { getDb, ready } from "../db/client.js";
import {
  listLeads,
  listProposals,
  getProposal,
  getLead,
  listAudit,
  updateProposal,
  insertAudit,
  isParkedOnEscalation,
  getEscalationStatus,
} from "../db/queries.js";
import { colorStage, truncate, formatTimestamp } from "./format.js";
import { RunProgressRenderer } from "./progress.js";
import { processQueue } from "../agent/runQueue.js";
import { getClient, extractRateLimitInfo, DEFAULT_MODEL, type RunResult } from "../agent/loop.js";
import { closeDeal, type DealOutcome } from "../domain/dealClose.js";
import { isToolError } from "../domain/errors.js";
import { computeAggregateMetrics } from "../domain/metrics.js";

const program = new Command();
program.name("lead-followup").description("Real estate lead follow-up agent CLI");

async function db() {
  const pool = getDb();
  await ready();
  return pool;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates a CLI id argument instead of letting a malformed value flow
 * silently into a DB lookup, where it would just read as "not found" --
 * actively misleading rather than just unpolished. Returns null (having
 * already printed the error) if invalid, so every call site can just
 * `if (x === null) return;`.
 */
function parseId(raw: string, label: string): string | null {
  if (!UUID_RE.test(raw)) {
    console.log(chalk.red(`Invalid ${label}: '${raw}'. Expected a UUID.`));
    return null;
  }
  return raw;
}

program
  .command("dashboard")
  .description("Show all leads with segment, stage, last contact, pending proposals, and escalation status")
  .action(async () => {
    const database = await db();
    const leads = await listLeads(database);
    const table = new Table({
      head: ["ID", "Name", "Segment", "Stage", "Last Contacted", "Pending Proposals", "Escalated"],
    });
    for (const lead of leads) {
      const pending = (await listProposals(database, { lead_id: lead.id, status: "pending" })).length;
      table.push([
        lead.id,
        lead.name,
        lead.segment,
        colorStage(lead.stage, Boolean(lead.do_not_contact)),
        formatTimestamp(lead.last_contacted_at),
        pending > 0 ? chalk.bold(String(pending)) : "0",
        formatEscalationStatus(await getEscalationStatus(database, lead.id)),
      ]);
    }
    console.log(table.toString());
  });

function formatEscalationStatus(status: Awaited<ReturnType<typeof getEscalationStatus>>): string {
  if (status === "parked") return chalk.red("needs retry");
  // Nothing is retrying this in the background -- no daemon, no cron. It's
  // simply not blocked, so the *next time a person runs `process`* it will
  // be attempted again. Say that plainly rather than implying autonomous action.
  if (status === "transient") return chalk.yellow("rate-limited -- rerun process");
  return chalk.dim("--");
}

program
  .command("proposals")
  .description("Show all pending proposals awaiting human approval")
  .action(async () => {
    const database = await db();
    const pending = await listProposals(database, { status: "pending" });
    const table = new Table({ head: ["ID", "Lead", "Type", "Content", "Created At"] });
    for (const p of pending) {
      const lead = await getLead(database, p.lead_id);
      table.push([p.id, lead?.name ?? `#${p.lead_id}`, p.type, truncate(p.content), formatTimestamp(p.created_at)]);
    }
    console.log(table.toString());
    if (pending.length === 0) console.log(chalk.dim("No pending proposals."));
  });

program
  .command("escalated")
  .description("Show every lead the dashboard's Escalated column flags -- both needing a human retry and self-healing rate-limit hits")
  .action(async () => {
    const database = await db();
    // Same predicate as dashboard's "Escalated" column (status !== "none") --
    // this command must show a superset consistent with that column, or the
    // two disagree on what "escalated" means for the exact same lead.
    const leads = await listLeads(database);
    const escalated: { lead: (typeof leads)[number]; status: Awaited<ReturnType<typeof getEscalationStatus>> }[] = [];
    for (const lead of leads) {
      const status = await getEscalationStatus(database, lead.id);
      if (status !== "none") escalated.push({ lead, status });
    }
    const table = new Table({ head: ["ID", "Name", "Segment", "Stage", "Status", "Reason", "Escalated At"] });
    for (const { lead, status } of escalated) {
      const audit = await listAudit(database, lead.id);
      const lastRow = audit[audit.length - 1];
      const reason = (lastRow.output_json as { reason?: string })?.reason ?? "";
      table.push([
        lead.id,
        lead.name,
        lead.segment,
        colorStage(lead.stage, Boolean(lead.do_not_contact)),
        formatEscalationStatus(status),
        truncate(reason, 60),
        formatTimestamp(lastRow.created_at),
      ]);
    }
    console.log(table.toString());
    if (escalated.length === 0) {
      console.log(chalk.dim("No leads are currently escalated."));
    }
  });

program
  .command("history <leadId>")
  .description("Print the full chronological audit trail for a lead")
  .action(async (leadIdArg: string) => {
    const leadId = parseId(leadIdArg, "lead id");
    if (leadId === null) return;
    const database = await db();
    const lead = await getLead(database, leadId);
    if (!lead) {
      console.log(chalk.red(`No lead with id ${leadId}.`));
      return;
    }
    console.log(chalk.bold(`History for lead ${leadId} -- ${lead.name} (${lead.segment}/${lead.stage})`));
    const rows = await listAudit(database, leadId);
    if (rows.length === 0) {
      console.log(chalk.dim("No audit entries yet."));
      return;
    }
    for (const row of rows) {
      const actorLabel = row.actor === "human" ? chalk.magenta("human") : chalk.blue("agent");
      console.log(`\n${chalk.dim(formatTimestamp(row.created_at))}  [${actorLabel}] ${chalk.bold(row.tool_name)}`);
      console.log(`  input:  ${JSON.stringify(row.input_json)}`);
      console.log(`  output: ${JSON.stringify(row.output_json)}`);
    }
  });

program
  .command("approve <proposalId>")
  .description("Approve a pending proposal")
  .action(async (proposalIdArg: string) => {
    const proposalId = parseId(proposalIdArg, "proposal id");
    if (proposalId === null) return;
    const database = await db();
    const proposal = await getProposal(database, proposalId);
    if (!proposal) {
      console.log(chalk.red(`No proposal with id ${proposalId}.`));
      return;
    }
    if (proposal.status !== "pending") {
      console.log(chalk.red(`Proposal ${proposalId} is already '${proposal.status}'.`));
      return;
    }
    await updateProposal(database, proposalId, { status: "approved" });
    await insertAudit(database, {
      lead_id: proposal.lead_id,
      tool_name: "approve_proposal",
      input_json: { proposal_id: proposalId },
      output_json: { ok: true, status: "approved" },
      actor: "human",
    });
    console.log(chalk.green(`Approved proposal ${proposalId}.`));
  });

program
  .command("reject <proposalId> <reason>")
  .description("Reject a pending proposal with a reason")
  .action(async (proposalIdArg: string, reason: string) => {
    const proposalId = parseId(proposalIdArg, "proposal id");
    if (proposalId === null) return;
    const database = await db();
    const proposal = await getProposal(database, proposalId);
    if (!proposal) {
      console.log(chalk.red(`No proposal with id ${proposalId}.`));
      return;
    }
    if (proposal.status !== "pending") {
      console.log(chalk.red(`Proposal ${proposalId} is already '${proposal.status}'.`));
      return;
    }
    await updateProposal(database, proposalId, { status: "rejected", rejection_reason: reason });
    await insertAudit(database, {
      lead_id: proposal.lead_id,
      tool_name: "reject_proposal",
      input_json: { proposal_id: proposalId, reason },
      output_json: { ok: true, status: "rejected", reason },
      actor: "human",
    });
    console.log(chalk.yellow(`Rejected proposal ${proposalId}: ${reason}`));
  });

program
  .command("process [leadId]")
  .description("Run the agent loop over the queue (or a single lead id) -- requires OPENAI_API_KEY")
  .option("-n, --limit <count>", "process at most this many leads this pass (guards against draining a whole day's quota in one run)")
  .action(async (leadIdArg: string | undefined, opts: { limit?: string }) => {
    const only = leadIdArg !== undefined ? parseId(leadIdArg, "lead id") ?? undefined : undefined;
    if (leadIdArg !== undefined && only === undefined) return;
    const limit = opts.limit !== undefined ? Number(opts.limit) : undefined;
    if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
      console.log(chalk.red(`Invalid limit: '${opts.limit}'. Expected a positive integer.`));
      return;
    }
    const database = await db();

    let renderer: RunProgressRenderer | null = null;
    let activeLeadId: string | null = null;

    const results = await processQueue(database, undefined, only, undefined, {
      // Synchronous by contract (ProgressCallback isn't async) -- deliberately
      // doesn't look up the lead's name here (that would mean awaiting a query
      // mid-callback, racing subsequent progress ticks for the same lead).
      onProgress: (leadId, progress) => {
        if (activeLeadId !== leadId) {
          activeLeadId = leadId;
          renderer = new RunProgressRenderer();
          renderer.startLead(`Lead ${leadId}`);
        }
        renderer?.onProgress(progress);
      },
      onLeadResult: (result) => {
        renderer?.finishLead(
          `${chalk.bold(result.outcome.kind)} -- Lead ${result.leadId} (${result.assistantTurns} turn(s))`
        );
        renderer = null;
        activeLeadId = null;
        printRateLimitInfo(result.rateLimitInfo);
      },
    }, limit);

    if (results.length === 0) {
      console.log(chalk.dim("Queue is empty -- nothing to process."));
    }
  });

/**
 * OpenAI's own x-ratelimit-* response headers, captured after every model
 * call (see RateLimitInfo in src/agent/loop.ts) -- real numbers from the API
 * itself, not an estimate. Printed after each lead in `process`, and
 * standalone via `quota` below.
 *
 * Prints requests-per-day and tokens-per-minute separately: OpenAI enforces
 * both independently, so a run can be blocked by TPM pressure while RPD
 * still looks fine (and vice versa) -- showing only one, as this used to,
 * can read as "plenty left" while the actual blocker is invisible.
 */
function printRateLimitInfo(info: RunResult["rateLimitInfo"]): void {
  if (!info) return;

  if (info.remainingRequests !== undefined || info.limitRequests !== undefined) {
    const remaining = info.remainingRequests ?? "?";
    const limit = info.limitRequests ?? "?";
    const reset = info.resetRequests ? `, resets in ${info.resetRequests}` : "";
    const low = typeof info.remainingRequests === "number" && info.remainingRequests <= 5;
    const line = `  Quota (requests/day): ${remaining}/${limit} remaining${reset}`;
    console.log(low ? chalk.red(line) : chalk.dim(line));
  }

  if (info.remainingTokens !== undefined || info.limitTokens !== undefined) {
    const remaining = info.remainingTokens ?? "?";
    const limit = info.limitTokens ?? "?";
    const reset = info.resetTokens ? `, resets in ${info.resetTokens}` : "";
    const low =
      typeof info.remainingTokens === "number" &&
      typeof info.limitTokens === "number" &&
      info.limitTokens > 0 &&
      info.remainingTokens / info.limitTokens <= 0.05;
    const line = `  Quota (tokens/min): ${remaining}/${limit} remaining${reset}`;
    console.log(low ? chalk.red(line) : chalk.dim(line));
  }
}

program
  .command("quota")
  .description("Check remaining API quota with one minimal request -- no lead is touched, no tool calls, no DB writes")
  .action(async () => {
    let client: ReturnType<typeof getClient>;
    try {
      client = getClient();
    } catch (e) {
      console.log(chalk.red((e as Error).message));
      return;
    }

    try {
      const { response } = await client.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [{ role: "user", content: "Reply with the single word: pong" }],
        max_completion_tokens: 64,
      }).withResponse();
      const info = extractRateLimitInfo(response.headers);
      if (!info) {
        console.log(chalk.dim("Call succeeded, but the API didn't return x-ratelimit-* headers this time."));
        return;
      }
      printRateLimitInfo(info);
    } catch (e) {
      const info = extractRateLimitInfo((e as { headers?: unknown })?.headers);
      if (info) printRateLimitInfo(info);
      const message = e instanceof Error ? e.message : String(e);
      console.log(chalk.red(`Quota check call itself failed: ${message}`));
    }
  });

program
  .command("close <leadId> <outcome>")
  .description("Human action: record a deal outcome (won|lost|canceled) for a lead in decision_pending")
  .action(async (leadIdArg: string, outcomeArg: string) => {
    const leadId = parseId(leadIdArg, "lead id");
    if (leadId === null) return;
    const outcome = outcomeArg as DealOutcome;
    if (!["won", "lost", "canceled"].includes(outcome)) {
      console.log(chalk.red("Outcome must be one of: won, lost, canceled"));
      return;
    }
    const database = await db();
    try {
      await closeDeal(database, leadId, outcome);
      console.log(chalk.green(`Lead ${leadId} closed as '${outcome}'.`));
    } catch (e) {
      if (isToolError(e)) {
        console.log(chalk.red(`${e.error}: ${e.message}`));
      } else {
        throw e;
      }
    }
  });

program
  .command("retry <leadId>")
  .description("Human action: clear a lead's escalation park so the agent will process it again")
  .action(async (leadIdArg: string) => {
    const leadId = parseId(leadIdArg, "lead id");
    if (leadId === null) return;
    const database = await db();
    const lead = await getLead(database, leadId);
    if (!lead) {
      console.log(chalk.red(`No lead with id ${leadId}.`));
      return;
    }
    if (!(await isParkedOnEscalation(database, leadId))) {
      console.log(chalk.dim(`Lead ${leadId} isn't currently parked on an escalation -- nothing to do.`));
      return;
    }
    await insertAudit(database, {
      lead_id: leadId,
      tool_name: "retry_lead",
      input_json: { lead_id: leadId },
      output_json: { ok: true, unparked: true },
      actor: "human",
    });
    console.log(chalk.green(`Lead ${leadId} un-parked -- it will be picked up on the next process run.`));
  });

program
  .command("metrics")
  .description("Show aggregate run metrics (escalation rate, tool calls, estimated cost, approval turnaround)")
  .action(async () => {
    const database = await db();
    const m = await computeAggregateMetrics(database);
    const table = new Table();
    table.push(
      { "Total runs": String(m.totalRuns) },
      { "Escalation rate": `${(m.escalationRate * 100).toFixed(1)}%` },
      { "Avg tool calls / run": m.avgToolCallsPerRun.toFixed(1) },
      { "Total estimated cost": `$${m.totalEstimatedCost.toFixed(4)}` },
      {
        "Avg approval turnaround": m.avgApprovalTurnaroundMs === null ? chalk.dim("n/a (no resolved proposals yet)") : formatDuration(m.avgApprovalTurnaroundMs),
      }
    );
    console.log(table.toString());
  });

function formatDuration(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(1)}m`;
  return `${(minutes / 60).toFixed(1)}h`;
}

program.parseAsync(process.argv);
