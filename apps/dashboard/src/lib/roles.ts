/**
 * RBAC scaffold for the Today view's nav/section visibility.
 *
 * THIS IS NOT AUTH. There is no session, no login, no server-side
 * enforcement -- it exists only to let the Today view's layout react to
 * "which role is looking at this" so the shell is genuinely role-shaped
 * (per the module brief) instead of one-size-fits-all, while being explicit
 * that access control itself doesn't exist yet (see the "Next" section of
 * PROGRESS-dashboard.md). The role is chosen client-visibly via a `?role=`
 * query param read in a server component (src/app/page.tsx), defaulting to
 * `owner_coo` -- swapping it never grants or hides real data, since nothing
 * downstream of this file gates a database query on it.
 *
 * IMPORTANT GAP (flagged in PROGRESS-dashboard.md, not resolved here):
 * `@mira/shared-types`' `AgentRole` (`AGENT_ROLES` in domain.ts) is a
 * 3-value enum (`agent` / `manager` / `admin`) matching the `agents.role`
 * DB column. SPEC.md's RBAC table has 6 roles (Owner/COO, Senior Agent,
 * Junior Agent, Marketing/Social, Admin/Ops, Finance) with materially
 * different "sees" boundaries than 3 generic levels can express (e.g.
 * Marketing/Social has no CRM/financial access at all, which isn't a
 * "seniority" distinction). That's a real product/schema decision --
 * whether `agents.role` grows to 6 values, or a separate
 * `agents.dashboard_role` column is added, or something else -- and
 * per CLAUDE.md's module-boundary rule this module must not fork a
 * competing definition into `packages/shared-types` unilaterally. The
 * `DashboardRole` type below is deliberately local to apps/dashboard and
 * UI-only until a human decides how (or whether) it should become part of
 * the shared contract.
 */

export const DASHBOARD_ROLES = [
  "owner_coo",
  "senior_agent",
  "junior_agent",
  "marketing_social",
  "admin_ops",
  "finance",
] as const;
export type DashboardRole = (typeof DASHBOARD_ROLES)[number];

export const ROLE_LABELS: Record<DashboardRole, string> = {
  owner_coo: "Owner / COO",
  senior_agent: "Senior Agent",
  junior_agent: "Junior Agent",
  marketing_social: "Marketing / Social",
  admin_ops: "Admin / Ops",
  finance: "Finance",
};

export function isDashboardRole(value: string | undefined | null): value is DashboardRole {
  return !!value && (DASHBOARD_ROLES as readonly string[]).includes(value);
}

export type ModuleKey =
  | "today"
  | "pipeline"
  | "financials"
  | "social"
  | "trackers"
  | "comms";

export interface NavItem {
  key: ModuleKey;
  label: string;
  /** SPEC.md build phase order -- most of these apps don't exist as routes yet. */
  status: "live" | "planned";
}

const ALL_NAV_ITEMS: NavItem[] = [
  { key: "today", label: "Today", status: "live" },
  { key: "pipeline", label: "Pipeline & Leads", status: "planned" },
  { key: "financials", label: "Financials", status: "planned" },
  { key: "social", label: "Social & Marketing", status: "planned" },
  { key: "trackers", label: "Trackers", status: "planned" },
  { key: "comms", label: "Comms Hub", status: "planned" },
];

/**
 * Direct translation of SPEC.md's RBAC "Sees" column. Only `today` actually
 * exists as a route right now (the other module worktrees haven't merged),
 * so this currently only affects which nav items *render* on this shell,
 * not which data loads -- see the module gap note above.
 */
const VISIBLE_MODULES: Record<DashboardRole, ModuleKey[]> = {
  owner_coo: ["today", "pipeline", "financials", "social", "trackers", "comms"],
  senior_agent: ["today", "pipeline", "comms"],
  junior_agent: ["today", "pipeline", "comms"],
  marketing_social: ["today", "social"],
  admin_ops: ["today", "trackers", "comms"],
  finance: ["today", "financials"],
};

export function navItemsForRole(role: DashboardRole): NavItem[] {
  const visible = new Set(VISIBLE_MODULES[role]);
  return ALL_NAV_ITEMS.filter((item) => visible.has(item.key));
}

/** SPEC.md: "Founder-only-for-now modules ... loosen later via config, no code change." */
export const FOUNDER_ONLY_NOTES: Partial<Record<DashboardRole, string>> = {
  senior_agent: "No cross-team financials.",
  junior_agent: "Own leads only -- no pipeline-wide view, no financials.",
  marketing_social: "No CRM/lead access, no financials.",
  admin_ops: "No financials.",
};
