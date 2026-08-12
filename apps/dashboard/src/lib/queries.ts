/**
 * Read-only queries against the shared schema (packages/shared-db/schema.sql)
 * for the Today view. Every returned shape is a `@mira/shared-types` row
 * type (or a plain array/record of them) -- nothing here redefines a row
 * shape that already exists in the shared contract (CLAUDE.md).
 *
 * These are plain `SELECT`s, no writes -- this app doesn't have an approval
 * flow of its own to route through (see SPEC.md's review/approval queue,
 * which is Agent Core's, not the dashboard's, to implement).
 */
import { getDb } from "./db";
import type {
  Agent,
  AISuggestion,
  DashboardStats,
  Lead,
  Proposal,
  Stage,
} from "@mira/shared-types";
import { STAGES } from "@mira/shared-types";

/**
 * Mirrors apps/crm's src/app/page.tsx definitions (cold = no contact in 7+
 * days; "active" excludes the two terminal stages) so the two dashboards
 * agree on what these numbers mean, translated from crm's legacy `status`
 * filter onto the canonical `stage` column.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const db = getDb();

  const [totalLeadsRes, contactedThisWeekRes, conversionsThisMonthRes, coldLeadsRes, todayFollowUpsRes] =
    await Promise.all([
      db.query<{ count: string }>(
        `select count(*) from leads where stage not in ('won', 'lost')`
      ),
      db.query<{ count: string }>(
        `select count(*) from leads where last_contacted_at >= date_trunc('week', now())`
      ),
      db.query<{ count: string }>(
        `select count(*) from leads where stage = 'won' and updated_at >= date_trunc('month', now())`
      ),
      db.query<{ count: string }>(
        `select count(*) from leads
         where stage not in ('won', 'lost', 'canceled', 'dormant')
           and (last_contacted_at is null or last_contacted_at < now() - interval '7 days')`
      ),
      db.query<Lead>(
        `select * from leads
         where next_followup_at >= date_trunc('day', now())
           and next_followup_at < date_trunc('day', now()) + interval '1 day'
         order by next_followup_at asc`
      ),
    ]);

  return {
    totalLeads: Number(totalLeadsRes.rows[0].count),
    contactedThisWeek: Number(contactedThisWeekRes.rows[0].count),
    conversionsThisMonth: Number(conversionsThisMonthRes.rows[0].count),
    coldLeadsCount: Number(coldLeadsRes.rows[0].count),
    todayFollowUps: todayFollowUpsRes.rows,
  };
}

/** Leads that haven't been contacted in 7+ days and aren't already in a terminal/dormant stage. */
export async function getColdLeads(limit = 10): Promise<Lead[]> {
  const db = getDb();
  const res = await db.query<Lead>(
    `select * from leads
     where stage not in ('won', 'lost', 'canceled', 'dormant')
       and (last_contacted_at is null or last_contacted_at < now() - interval '7 days')
     order by last_contacted_at asc nulls first
     limit $1`,
    [limit]
  );
  return res.rows;
}

export interface ReviewQueue {
  proposals: Proposal[];
  suggestions: AISuggestion[];
}

/**
 * Everything currently sitting in the review/approval queue (SPEC.md: "Nearly
 * everything routes here at launch"). `proposals` (lead-agent's drafted
 * messages/viewings) and `ai_suggestions` (crm's scoring/upgrade proposals)
 * are kept as two tables per the Phase 0 merge decision -- see
 * packages/shared-db/schema.sql's header comment -- so this reads both.
 */
export async function getReviewQueue(): Promise<ReviewQueue> {
  const db = getDb();
  const [proposalsRes, suggestionsRes] = await Promise.all([
    db.query<Proposal>(`select * from proposals where status = 'pending' order by created_at asc`),
    db.query<AISuggestion>(`select * from ai_suggestions where status = 'pending' order by created_at asc`),
  ]);
  return { proposals: proposalsRes.rows, suggestions: suggestionsRes.rows };
}

/** Lead counts per funnel stage, in canonical STAGES order, for a pipeline-shape glance. */
export async function getStageBreakdown(): Promise<Record<Stage, number>> {
  const db = getDb();
  const res = await db.query<{ stage: Stage; count: string }>(
    `select stage, count(*) from leads group by stage`
  );
  const counts = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
  for (const row of res.rows) {
    counts[row.stage] = Number(row.count);
  }
  return counts;
}

export async function getAgents(): Promise<Agent[]> {
  const db = getDb();
  const res = await db.query<Agent>(`select * from agents order by name asc`);
  return res.rows;
}

/** Small lookup map so lead names can be shown next to proposals/suggestions without an N+1. */
export async function getLeadNamesByIds(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const db = getDb();
  const res = await db.query<{ id: string; name: string }>(
    `select id, name from leads where id = any($1::uuid[])`,
    [ids]
  );
  return new Map(res.rows.map((r) => [r.id, r.name]));
}
