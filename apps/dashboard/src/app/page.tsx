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
import { Flame, Inbox, Phone, Sparkles, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoleSwitcher } from "@/components/layout/role-switcher";
import { getColdLeads, getDashboardStats } from "@/lib/queries";
import { cn, timeAgo, titleCase } from "@/lib/utils";
import {
  FOUNDER_ONLY_NOTES,
  ROLE_LABELS,
  isDashboardRole,
  navItemsForRole,
  type DashboardRole,
} from "@/lib/roles";
import type { Lead } from "@mira/shared-types";

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

  const [stats, coldLeads] = await Promise.all([
    getDashboardStats(),
    getColdLeads(COLD_LEADS_LIMIT),
  ]);

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
            {nav.map((item) => (
              <span
                key={item.key}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium",
                  item.key === "today"
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-muted text-muted-foreground"
                )}
              >
                {item.label}
                {item.status === "planned" && (
                  <span className="ml-1 text-[10px] opacity-70">(soon)</span>
                )}
              </span>
            ))}
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

        {/* Agent Core placeholder -- SPEC.md phase 1, not built yet. Not a live feed. */}
        <section className="rounded-xl border border-dashed border-border bg-muted/40 p-5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Agent suggestions &amp; review queue</h2>
            <Badge variant="outline">Not built yet</Badge>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            SPEC.md&apos;s Agent Core (build phase 1: scheduled/event-triggered reasoning loop, budget
            governor, escalation rules) is what would populate this section -- prioritized suggestions
            and judgment calls routed here for approval. That module hasn&apos;t been built yet, so this
            is a placeholder, not a live feed. No agent-generated content is faked on this page.
          </p>
          <div className="mt-3">
            <Button disabled className="text-xs" title="Review queue opens once Agent Core (phase 1) ships">
              <Inbox className="mr-1.5 h-3.5 w-3.5" />
              Open review queue (coming soon)
            </Button>
          </div>
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

function formatBudgetRange(min: number | null, max: number | null, currency: string): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  if (min != null && max != null) return `${currency} ${fmt(min)}-${fmt(max)}`;
  if (max != null) return `up to ${currency} ${fmt(max)}`;
  return `${currency} ${fmt(min as number)}+`;
}
