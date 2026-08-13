/**
 * Today view -- the dashboard's home screen (SPEC.md: "the agent's current
 * briefing ... this is the home screen"). Server component: reads `?role=`
 * (UI-only, see src/lib/roles.ts -- NOT auth), then queries the shared
 * schema directly via src/lib/queries.ts for real counts/leads. Nothing here
 * is mocked -- an empty section means the underlying query genuinely
 * returned nothing.
 *
 * Agent Core (SPEC.md phase 1: reasoning loop, suggestions, review/approval
 * queue) doesn't exist yet, so the "what would the agent tell me" part of
 * the Today view brief is a clearly-labeled placeholder, not faked content.
 */
import { AlertTriangle, Flame, Inbox, Phone, Sparkles, Target, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RoleSwitcher } from "@/components/layout/role-switcher";
import {
  getColdLeads,
  getComplianceAlerts,
  getDashboardStats,
  getLeadNamesByIds,
  getPipelineSummary,
  getReviewQueue,
  getTeamGoalsSummary,
  type ComplianceAlert,
  type PipelineStageCount,
  type ReviewQueueItem,
  type TeamGoalProgress,
} from "@/lib/queries";
import { cn, timeAgo, titleCase } from "@/lib/utils";
import {
  FOUNDER_ONLY_NOTES,
  ROLE_LABELS,
  isDashboardRole,
  navItemsForRole,
  type DashboardRole,
} from "@/lib/roles";
import type { Lead } from "@mira/shared-types";
import { NOTIFICATION_TIER_LABELS } from "@mira/shared-types";

// This page reads live rows straight from Postgres on every request (see
// src/lib/db.ts) -- never cache a stale "Today" briefing.
export const revalidate = 0;

interface TodayPageProps {
  searchParams: Promise<{ role?: string }>;
}

const COLD_LEADS_LIMIT = 5;

export default async function TodayPage({ searchParams }: TodayPageProps) {
  const params = await searchParams;
  const role: DashboardRole = isDashboardRole(params.role) ? params.role : "owner_coo";

  const [stats, coldLeads, reviewQueue, teamGoals, pipelineSummary, complianceAlerts] = await Promise.all([
    getDashboardStats(),
    getColdLeads(COLD_LEADS_LIMIT),
    getReviewQueue(),
    getTeamGoalsSummary(),
    getPipelineSummary(),
    getComplianceAlerts(),
  ]);

  const reviewQueueLeadIds = reviewQueue
    .map((item) => (item.kind === "proposal" || item.kind === "suggestion" ? item.data.lead_id : null))
    .filter((id): id is string => id !== null);
  const leadNamesById = await getLeadNamesByIds(reviewQueueLeadIds);

  const nav = navItemsForRole(role);
  const founderNote = FOUNDER_ONLY_NOTES[role];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const statTiles: Array<{
    label: string;
    value: number;
    icon: typeof Users;
    tone: "primary" | "warning";
  }> = [
    { label: "Active Leads", value: stats.totalLeads, icon: Users, tone: "primary" },
    { label: "Contacted This Week", value: stats.contactedThisWeek, icon: Phone, tone: "primary" },
    { label: "Won This Month", value: stats.conversionsThisMonth, icon: Trophy, tone: "primary" },
    { label: "Cold Leads", value: stats.coldLeadsCount, icon: Flame, tone: "warning" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {greeting}, {ROLE_LABELS[role]}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{todayLabel}</p>
            </div>
            <Badge variant="outline">Mira -- Today view</Badge>
          </div>

          <RoleSwitcher current={role} />

          <nav className="flex flex-wrap gap-1.5">
            {nav.map((item) => {
              const pillClass = cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                item.key === "today"
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-muted text-muted-foreground"
              );
              // "live" items with an href are a different app entirely (Next.js
              // Multi-Zones -- see next.config.ts's rewrites), not a route in
              // this app, so a plain <a> is correct here, not next/link's Link.
              if (item.status === "live" && item.href && item.key !== "today") {
                return (
                  <a
                    key={item.key}
                    href={item.href}
                    className={cn(pillClass, "transition-colors hover:bg-accent")}
                  >
                    {item.label}
                  </a>
                );
              }
              return (
                <span key={item.key} className={pillClass}>
                  {item.label}
                  {item.status === "planned" && (
                    <span className="ml-1 text-[10px] opacity-70">(soon)</span>
                  )}
                </span>
              );
            })}
          </nav>

          {founderNote && (
            <p className="text-xs italic text-muted-foreground">{founderNote}</p>
          )}
        </header>

        {/* Stat tiles -- getDashboardStats() */}
        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statTiles.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div
                className={cn(
                  "mb-3 inline-flex rounded-lg p-2",
                  tone === "warning" ? "bg-warning/20" : "bg-primary/10"
                )}
              >
                <Icon
                  className={cn("h-4 w-4", tone === "warning" ? "text-warning-foreground" : "text-primary")}
                />
              </div>
              <p className="text-2xl font-bold tracking-tight">{value}</p>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{label}</p>
            </div>
          ))}
        </section>

        {/* Today's follow-ups -- stats.todayFollowUps, from getDashboardStats() */}
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-base font-semibold">Today&apos;s Follow-ups</h2>
            <Badge variant={stats.todayFollowUps.length > 0 ? "primary" : "default"}>
              {stats.todayFollowUps.length}
            </Badge>
          </div>

          {stats.todayFollowUps.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="All caught up"
              subtitle="No follow-ups scheduled for today."
            />
          ) : (
            <ul className="space-y-2.5">
              {stats.todayFollowUps.map((lead) => (
                <LeadRow key={lead.id} lead={lead} highlight="followup" />
              ))}
            </ul>
          )}
        </section>

        {/* Cold leads -- getColdLeads() */}
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <Flame className="h-4 w-4 text-warning-foreground" />
            <h2 className="text-base font-semibold">Needs Attention</h2>
            <Badge variant="warning">{stats.coldLeadsCount}</Badge>
          </div>

          {coldLeads.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No cold leads"
              subtitle="Every active lead has been contacted within the last 7 days."
            />
          ) : (
            <>
              <div className="mb-3 rounded-lg border border-dashed border-warning/50 bg-warning/10 px-3 py-2">
                <p className="text-xs text-warning-foreground">
                  These leads haven&apos;t been contacted in 7+ days. Reach out before they go cold.
                </p>
              </div>
              <ul className="space-y-2.5">
                {coldLeads.map((lead) => (
                  <LeadRow key={lead.id} lead={lead} highlight="cold" />
                ))}
              </ul>
              {stats.coldLeadsCount > coldLeads.length && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  {stats.coldLeadsCount - coldLeads.length} more cold lead
                  {stats.coldLeadsCount - coldLeads.length === 1 ? "" : "s"} not shown here.
                </p>
              )}
            </>
          )}
        </section>

        {/* Cross-module glance tiles -- getTeamGoalsSummary() (apps/trackers),
            getPipelineSummary() (apps/pipeline), getComplianceAlerts()
            (apps/inventory). Each reads the shared Postgres database
            directly, same as everything else on this page -- real data,
            not a stand-in for cross-app navigation (see next.config.ts's
            rewrites for that). Compliance alerts render only when non-empty
            (an empty compliance widget taking up space year-round would be
            noise); goals/pipeline always render so an empty state is
            visibly "checked and genuinely empty", not "not built yet". */}
        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Team Goals</h2>
            </div>
            {teamGoals.length === 0 ? (
              <p className="text-xs text-muted-foreground">No active team goals.</p>
            ) : (
              <ul className="space-y-3">
                {teamGoals.map(({ goal, totalLogged, percentToGoal }) => (
                  <li key={goal.id}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="truncate font-medium">{titleCase(goal.metric)}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {totalLogged.toLocaleString()} / {goal.target_value.toLocaleString()} {goal.unit ?? ""}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(percentToGoal, 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Deals in Motion</h2>
              <Badge variant="primary">{pipelineSummary.activeCount}</Badge>
            </div>
            {pipelineSummary.byStage.length === 0 ? (
              <p className="text-xs text-muted-foreground">No active deals in the pipeline.</p>
            ) : (
              <ul className="space-y-1.5">
                {pipelineSummary.byStage.map(({ stage, count }: PipelineStageCount) => (
                  <li key={stage} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{titleCase(stage)}</span>
                    <span className="font-medium">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {complianceAlerts.length > 0 && (
            <div className="rounded-xl border border-warning/50 bg-warning/5 p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning-foreground" />
                <h2 className="text-sm font-semibold">Compliance Alerts</h2>
                <Badge variant="warning">{complianceAlerts.length}</Badge>
              </div>
              <ul className="space-y-2">
                {complianceAlerts.map((alert: ComplianceAlert) => (
                  <li key={alert.mouTermId} className="text-xs">
                    <div className="flex items-center gap-1.5">
                      <Badge variant={alert.urgency === "overdue" ? "destructive" : "warning"}>
                        {alert.urgency === "overdue" ? "Overdue" : "Expiring soon"}
                      </Badge>
                      <span className="font-medium">{alert.developerPartnerName}</span>
                    </div>
                    <p className="mt-0.5 text-muted-foreground">MOU term ends {alert.termEnd}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Review queue -- getReviewQueue(), merged across proposals/ai_suggestions
            (Phase 0) and social_posts (apps/social-assistant). Real pending items
            that already exist today, not Agent Core's future automated
            suggestions -- see the note below the heading. */}
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <Inbox className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Review Queue</h2>
            <Badge variant={reviewQueue.length > 0 ? "primary" : "default"}>{reviewQueue.length}</Badge>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
            Drafted, awaiting your review -- draft-and-hold, nothing here has gone out on its own.{" "}
            <span className="italic">
              Not the same thing as Agent Core&apos;s future automated suggestions (SPEC.md phase 1,
              not built yet) -- this is real content other modules have already drafted.
            </span>
          </p>

          {reviewQueue.length === 0 ? (
            <EmptyState icon={Inbox} title="Nothing waiting for review" subtitle="The queue is empty." />
          ) : (
            <ul className="space-y-2.5">
              {reviewQueue.map((item) => (
                <ReviewQueueRow
                  key={`${item.kind}-${item.data.id}`}
                  item={item}
                  leadName={
                    item.kind !== "social_post" && item.data.lead_id
                      ? leadNamesById.get(item.data.lead_id)
                      : undefined
                  }
                />
              ))}
            </ul>
          )}
        </section>

        {/* Agent Core placeholder -- SPEC.md phase 1, not built yet. Not a live feed. */}
        <section className="rounded-xl border border-dashed border-border bg-muted/40 p-5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Agent Core reasoning loop</h2>
            <Badge variant="outline">Not built yet</Badge>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            SPEC.md&apos;s Agent Core (build phase 1: scheduled/event-triggered reasoning loop, budget
            governor, escalation rules) is what would generate new suggestions automatically and decide
            what to prioritize. The Review Queue above shows what already exists today (drafted by
            individual modules); this section is about the reasoning layer on top of it, which hasn&apos;t
            been built yet. No agent-generated content is faked on this page.
          </p>
        </section>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Users;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}

/** One lead's row in either the follow-ups or cold-leads list. */
function LeadRow({ lead, highlight }: { lead: Lead; highlight: "followup" | "cold" }) {
  const contact = lead.email ?? lead.phone;
  const budget =
    lead.budget_min != null || lead.budget_max != null
      ? formatBudgetRange(lead.budget_min, lead.budget_max, lead.currency)
      : null;

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3.5 py-3 shadow-sm">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{lead.name}</span>
          <Badge variant="outline">{titleCase(lead.stage)}</Badge>
          {lead.do_not_contact && <Badge variant="destructive">Do not contact</Badge>}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {contact}
          {budget ? ` -- ${budget}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right text-xs text-muted-foreground">
        {highlight === "followup" && lead.next_followup_at ? (
          <span>
            due{" "}
            {new Date(lead.next_followup_at).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        ) : (
          <span>{timeAgo(lead.last_contacted_at)}</span>
        )}
      </div>
    </li>
  );
}

const TIER_BADGE_VARIANT: Record<string, "destructive" | "warning" | "outline"> = {
  urgent: "destructive",
  today: "warning",
  fyi: "outline",
};

/**
 * One row in the merged review queue -- renders differently per item kind
 * since a proposal, an AI suggestion, and a social post don't share a
 * display shape. Each links out to the module that actually owns the
 * approve/hold action for that item (once cross-app routing exists -- see
 * src/lib/roles.ts's NavItem.status note) rather than duplicating that UI
 * here; for now this is a read-only summary.
 */
function ReviewQueueRow({ item, leadName }: { item: ReviewQueueItem; leadName?: string }) {
  const tierLabel = NOTIFICATION_TIER_LABELS[item.tier];
  const tierVariant = TIER_BADGE_VARIANT[item.tier];

  let title: string;
  let subtitle: string;
  let sourceLabel: string;

  if (item.kind === "proposal") {
    title = leadName ? `${titleCase(item.data.type)} for ${leadName}` : titleCase(item.data.type);
    subtitle = item.data.content;
    sourceLabel = "Lead-agent proposal";
  } else if (item.kind === "suggestion") {
    title = leadName ? `${titleCase(item.data.suggestion_type)} for ${leadName}` : titleCase(item.data.suggestion_type);
    subtitle = item.data.content ?? "";
    sourceLabel = "CRM suggestion";
  } else {
    title = `${titleCase(item.data.kind)} -- ${item.data.platform}`;
    subtitle = item.data.caption;
    sourceLabel = item.data.brand_mode === "co_branded" ? `Social post -- co-branded (${item.data.developer_partner_name})` : "Social post -- own brand";
  }

  return (
    <li className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border bg-card px-3.5 py-3 shadow-sm">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={tierVariant}>{tierLabel}</Badge>
          <span className="truncate text-sm font-medium">{title}</span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{subtitle}</p>
        <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">{sourceLabel}</p>
      </div>
      <div className="shrink-0 text-right text-xs text-muted-foreground">{timeAgo(item.createdAt)}</div>
    </li>
  );
}

function formatBudgetRange(min: number | null, max: number | null, currency: string): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  if (min != null && max != null) return `${currency} ${fmt(min)}-${fmt(max)}`;
  if (max != null) return `up to ${currency} ${fmt(max)}`;
  return `${currency} ${fmt(min as number)}+`;
}
