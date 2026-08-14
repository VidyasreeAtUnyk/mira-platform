/**
 * Strategy brief -- the actual "Agent Core" half of the Today view (SPEC.md
 * phase 1: "reasons using current state, decides ... inform"). Everything
 * else in this codebase is a system of record or a deterministic template
 * (brief.ts, forecast.ts, caption.ts); this is the one place that
 * genuinely reasons over cross-module state to answer one question: given
 * everything real happening in the business right now, what's the single
 * highest-leverage thing a small team should focus on today to grow
 * revenue or their network -- sourced and specific, not generic advice.
 *
 * Cached, not called on every page load. SPEC.md's scheduling policy is
 * explicit that only the social module runs a frequent loop; everything
 * else is priority/event-triggered or "hourly or coarser" -- so this
 * regenerates on an interval (STRATEGY_REFRESH_MINUTES) and is otherwise
 * served from `strategy_briefs`, same reasoning as apps/lead-agent's
 * budget governor existing to prevent an unbounded call loop (CLAUDE.md).
 */
import OpenAI from "openai";
import { getDb, ensureLocalSchema } from "./db";
import {
  getDashboardStats,
  getReviewQueue,
  getComplianceAlerts,
  getPipelineSummary,
  getTeamGoalsSummary,
  getColdLeads,
} from "./queries";

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";

export class BudgetExceededError extends Error {}

function getDailyCap(): number {
  const raw = process.env.STRATEGY_DAILY_CALL_CAP;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 10;
}

function getRefreshMinutes(): number {
  const raw = process.env.STRATEGY_REFRESH_MINUTES;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
}

async function todaysCallCount(): Promise<number> {
  const db = getDb();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const countRes = await db.query<{ count: string }>(
    `select count(*)::text as count from strategy_call_log where created_at >= $1`,
    [since.toISOString()]
  );
  return Number.parseInt(countRes.rows[0]?.count ?? "0", 10);
}

/**
 * Checked BEFORE a call, recorded only AFTER it actually succeeds --
 * deliberately different from apps/lead-agent's budget governor, which
 * records on attempt (right, there, to fail closed against a burst of
 * concurrent queue workers). This feature has exactly one caller (a page
 * load) at a time, so that tradeoff only hurts: a transient failure on
 * OpenAI's side (e.g. their own per-minute rate limit, unrelated to this
 * cap) would otherwise burn a slot against this cap for zero benefit,
 * and repeated transient failures could exhaust the whole day's budget
 * without ever producing one real brief -- which is exactly what happened
 * during live testing before this was fixed.
 */
async function checkBudgetAvailable(): Promise<void> {
  const cap = getDailyCap();
  const count = await todaysCallCount();
  if (count >= cap) {
    throw new BudgetExceededError(`Daily strategy-brief call cap (${cap}) reached.`);
  }
}

async function recordSuccessfulCall(): Promise<void> {
  await getDb().query(`insert into strategy_call_log default values`);
}

export interface BusinessContext {
  teamSize: number;
  activeLeads: number;
  coldLeads: { name: string; source: string | null; stage: string; lastContactedAt: string | null }[];
  pipelineActiveDeals: number;
  reviewQueueSize: number;
  complianceBacklogCount: number;
  wonThisMonth: number;
  contactedThisWeek: number;
  laggingGoals: { metric: string; percentToGoal: number }[];
}

/**
 * Pulls real signal from every module already built this session --
 * mirrors what the Today brief (brief.ts) already surfaces, plus lead
 * detail (name/source/stage) specifically so the model can name a real
 * lead rather than invent one, and MOU/compliance backlog as the concrete
 * "buried in legal work" signal the founder described.
 */
export async function getBusinessContext(): Promise<BusinessContext> {
  const [stats, reviewQueue, complianceAlerts, pipelineSummary, teamGoals, coldLeads, agents] = await Promise.all([
    getDashboardStats(),
    getReviewQueue(),
    getComplianceAlerts(),
    getPipelineSummary(),
    getTeamGoalsSummary(),
    getColdLeads(10),
    getDb().query<{ count: string }>(`select count(*)::text as count from agents`),
  ]);

  return {
    teamSize: Number(agents.rows[0]?.count ?? 0),
    activeLeads: stats.totalLeads,
    coldLeads: coldLeads.map((l) => ({
      name: l.name,
      source: l.source ?? null,
      stage: l.stage,
      lastContactedAt: l.last_contacted_at,
    })),
    pipelineActiveDeals: pipelineSummary.activeCount,
    reviewQueueSize: reviewQueue.length,
    complianceBacklogCount: complianceAlerts.length,
    wonThisMonth: stats.conversionsThisMonth,
    contactedThisWeek: stats.contactedThisWeek,
    laggingGoals: teamGoals.filter((g) => g.percentToGoal < 50).map((g) => ({ metric: g.goal.metric, percentToGoal: g.percentToGoal })),
  };
}

export interface StrategyBrief {
  id: string;
  generatedAt: string;
  headline: string;
  focusType: "lead" | "networking" | "market" | "action";
  focusTitle: string;
  focusDetail: string;
  focusSource: string;
  focusBenefit: string;
  educationalNugget: string;
}

function mapRow(row: {
  id: string;
  generated_at: string;
  headline: string;
  focus_type: StrategyBrief["focusType"];
  focus_title: string;
  focus_detail: string;
  focus_source: string;
  focus_benefit: string;
  educational_nugget: string;
}): StrategyBrief {
  return {
    id: row.id,
    generatedAt: row.generated_at,
    headline: row.headline,
    focusType: row.focus_type,
    focusTitle: row.focus_title,
    focusDetail: row.focus_detail,
    focusSource: row.focus_source,
    focusBenefit: row.focus_benefit,
    educationalNugget: row.educational_nugget,
  };
}

const SYSTEM_PROMPT = `You are the COO Agent for MIRA Agam Properties, a boutique real estate brokerage in Dubai run by a 2-person team. They open their dashboard wanting ONE specific, actionable focus for today -- never generic advice like "network more" or "follow up on leads". You are given real, current data about their pipeline, leads, and workload.

Decide the single highest-leverage thing they should do today to grow revenue or their professional network. If you recommend a lead, name the actual lead from the data given and explain why, citing where it came from. If you recommend a networking action, be concrete about what kind of event, contact type, or platform, and why it specifically matters for a Dubai real estate brokerage working with developers like DAMAC and Sobha -- never vague "attend industry events" filler. If the team is clearly bottlenecked (e.g. a large compliance/legal backlog relative to a 2-person team), the highest-leverage focus might be triage or delegation advice instead of a new lead -- use judgment based on the real numbers given, don't default to the same suggestion type every time.

Also include one educational nugget: something a COO/CEO running this kind of business should know, relevant to today's context if possible.

Respond with ONLY a JSON object, no other text, matching exactly:
{"headline": "one sentence summarizing today's priority", "focus_type": "lead" | "networking" | "market" | "action", "focus_title": "short title", "focus_detail": "2-3 sentences, specific and actionable", "focus_source": "where this recommendation or data came from", "focus_benefit": "why this specifically helps revenue or growth, one sentence", "educational_nugget": "1-2 sentences"}`;

/** Real OpenAI call, budget-governed. Throws on failure -- callers decide the fallback. */
async function callModel(context: BusinessContext): Promise<Omit<StrategyBrief, "id" | "generatedAt">> {
  await checkBudgetAvailable();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");
  const client = new OpenAI({ apiKey });

  const completion = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Current business state:\n${JSON.stringify(context, null, 2)}\n\nWhat should the team focus on today?` },
    ],
  });
  await recordSuccessfulCall();

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty response from model.");
  const parsed = JSON.parse(raw) as {
    headline: string;
    focus_type: StrategyBrief["focusType"];
    focus_title: string;
    focus_detail: string;
    focus_source: string;
    focus_benefit: string;
    educational_nugget: string;
  };

  return {
    headline: parsed.headline,
    focusType: parsed.focus_type,
    focusTitle: parsed.focus_title,
    focusDetail: parsed.focus_detail,
    focusSource: parsed.focus_source,
    focusBenefit: parsed.focus_benefit,
    educationalNugget: parsed.educational_nugget,
  };
}

/**
 * Serves a cached brief if one exists within STRATEGY_REFRESH_MINUTES;
 * otherwise generates a fresh one (budget-governed) and caches it. Never
 * throws to the caller -- returns `{ brief: null, error }` on any failure
 * (budget exceeded, API error, no key) so the Today page can render a
 * clear fallback instead of crashing, same reasoning as apps/lead-agent's
 * loop never letting an LLM failure take down the process.
 */
export async function getStrategyBrief(): Promise<{ brief: StrategyBrief | null; stale: boolean; error: string | null }> {
  await ensureLocalSchema();
  const db = getDb();

  const cachedRes = await db.query(`select * from strategy_briefs order by generated_at desc limit 1`);
  const cached = cachedRes.rows[0] ? mapRow(cachedRes.rows[0]) : null;
  const freshEnough = cached && Date.now() - new Date(cached.generatedAt).getTime() < getRefreshMinutes() * 60_000;

  if (freshEnough && cached) {
    return { brief: cached, stale: false, error: null };
  }

  try {
    const context = await getBusinessContext();
    const generated = await callModel(context);
    const insertRes = await db.query(
      `insert into strategy_briefs (context_snapshot, headline, focus_type, focus_title, focus_detail, focus_source, focus_benefit, educational_nugget, model)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning *`,
      [
        JSON.stringify(context),
        generated.headline,
        generated.focusType,
        generated.focusTitle,
        generated.focusDetail,
        generated.focusSource,
        generated.focusBenefit,
        generated.educationalNugget,
        DEFAULT_MODEL,
      ]
    );
    return { brief: mapRow(insertRes.rows[0]), stale: false, error: null };
  } catch (err) {
    // Fall back to a stale cached brief if we have one -- better than
    // nothing, and clearly marked stale so the UI can say so.
    const message = err instanceof Error ? err.message : "Unknown error";
    if (cached) return { brief: cached, stale: true, error: message };
    return { brief: null, stale: false, error: message };
  }
}
