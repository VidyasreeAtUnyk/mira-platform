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
 * RESOLVED (was flagged here as a gap, see PROGRESS-integration.md for the
 * full decision writeup): `@mira/shared-types`' `AgentRole` now IS SPEC.md's
 * 6-role table directly -- the local `DashboardRole` this file used to
 * define has been deleted in favor of importing the shared type. Two
 * independent module builds (this file and apps/comms-hub's `CommsRole`)
 * had already converged on the identical 6-value shape before this was
 * promoted, which is why the promotion just formalizes an existing
 * agreement rather than invents a new one.
 */

import { AGENT_ROLES, AGENT_ROLE_LABELS, type AgentRole } from "@mira/shared-types";

export { AGENT_ROLES, AGENT_ROLE_LABELS as ROLE_LABELS };
export type DashboardRole = AgentRole;

export function isDashboardRole(value: string | undefined | null): value is DashboardRole {
  return !!value && (AGENT_ROLES as readonly string[]).includes(value);
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
  /**
   * "planned" here means "no working link exists yet from this shell to
   * that module" -- the apps themselves now exist and are independently
   * verified (see PROGRESS-integration.md's human verification pass), but
   * they're separate Next.js deployments on separate ports/origins with no
   * routing gateway or multi-zone setup connecting them yet. That's a
   * deployment-architecture decision, not something this file should paper
   * over with a link to nowhere. Flip to "live" once that's actually built.
   */
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

/** Direct translation of SPEC.md's RBAC "Sees" column. */
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
