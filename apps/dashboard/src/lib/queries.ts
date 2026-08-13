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
  NotificationTier,
  Proposal,
  SocialPost,
  Stage,
} from "@mira/shared-types";
import { NOTIFICATION_TIER_ORDER, STAGES } from "@mira/shared-types";

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

/**
 * A tier per item, computed here rather than stored -- neither `proposals`/
 * `ai_suggestions` (Phase 0) nor `social_posts` (apps/social-assistant) has
 * a `tier` column, and this pass deliberately didn't add one to avoid more
 * schema churn (see PROGRESS-integration.md). `NotificationTier` itself
 * *is* shared (promoted from apps/comms-hub's local concept, same
 * decision) -- only the per-type heuristic for computing one is local to
 * whoever's aggregating, same as apps/comms-hub/src/lib/tiers.ts's
 * computeTier() is local to that module's own notion of urgency.
 *
 * Documented v1 heuristics, not a discovered truth -- easy to retune once
 * real usage data exists (same framing as comms-hub's own tier heuristic).
 */
function tierByPendingAge(createdAt: string): NotificationTier {
  const hoursOld = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  if (hoursOld >= 48) return "urgent";
  if (hoursOld >= 12) return "today";
  return "fyi";
}

function tierBySchedule(scheduledFor: string | null): NotificationTier {
  if (!scheduledFor) return "today";
  const hoursUntil = (new Date(scheduledFor).getTime() - Date.now()) / 3_600_000;
  if (hoursUntil <= 24) return "urgent";
  if (hoursUntil <= 24 * 3) return "today";
  return "fyi";
}

export type ReviewQueueItem =
  | { kind: "proposal"; tier: NotificationTier; createdAt: string; data: Proposal }
  | { kind: "suggestion"; tier: NotificationTier; createdAt: string; data: AISuggestion }
  | { kind: "social_post"; tier: NotificationTier; createdAt: string; data: SocialPost };

/**
 * Everything currently sitting in the review/approval queue (SPEC.md: "Nearly
 * everything routes here at launch"), merged across every module that has a
 * draft/pending_approval workflow and sorted urgent-first, then oldest-first
 * within a tier. `proposals` + `ai_suggestions` (Phase 0, two tables per the
 * merge decision -- see packages/shared-db/schema.sql's header) and
 * `social_posts` (apps/social-assistant) are read directly since they're
 * all in the same shared Postgres database -- no cross-app call needed.
 *
 * apps/comms-hub's pending-approval message drafts are NOT included here:
 * that app has no live database connection anywhere in this build (reads/
 * writes in-memory fixture data only, see its migration file's header) --
 * there is nothing yet to query. Wiring that in is a comms-hub
 * infrastructure change (giving it a real Postgres-backed store), not a
 * dashboard-side query gap.
 */
export async function getReviewQueue(): Promise<ReviewQueueItem[]> {
  const db = getDb();
  const [proposalsRes, suggestionsRes, socialPostsRes] = await Promise.all([
    db.query<Proposal>(`select * from proposals where status = 'pending' order by created_at asc`),
    db.query<AISuggestion>(`select * from ai_suggestions where status = 'pending' order by created_at asc`),
    db.query<SocialPost>(`select * from social_posts where status = 'pending_approval' order by created_at asc`),
  ]);

  const items: ReviewQueueItem[] = [
    ...proposalsRes.rows.map(
      (p): ReviewQueueItem => ({ kind: "proposal", tier: tierByPendingAge(p.created_at), createdAt: p.created_at, data: p })
    ),
    ...suggestionsRes.rows.map(
      (s): ReviewQueueItem => ({ kind: "suggestion", tier: tierByPendingAge(s.created_at), createdAt: s.created_at, data: s })
    ),
    ...socialPostsRes.rows.map(
      (p): ReviewQueueItem => ({ kind: "social_post", tier: tierBySchedule(p.scheduled_for), createdAt: p.created_at, data: p })
    ),
  ];

  items.sort((a, b) => {
    const tierDiff = NOTIFICATION_TIER_ORDER[a.tier] - NOTIFICATION_TIER_ORDER[b.tier];
    if (tierDiff !== 0) return tierDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return items;
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
