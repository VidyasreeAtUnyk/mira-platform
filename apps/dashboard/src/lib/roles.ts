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
   * RESOLVED for pipeline/social/trackers/comms (see PROGRESS-integration.md):
   * apps/dashboard is now the Next.js Multi-Zones root, proxying each of
   * those paths to that module's own independently-deployed app via
   * rewrites in next.config.ts. `financials` stays "planned" -- there is no
   * app for it (SPEC.md module 5 was never assigned to a build module, see
   * MODULES.json), so there is nothing to link to yet, not a routing gap.
   */
  status: "live" | "planned";
  /** Path to link to when status is "live" -- undefined when "planned" (nothing to link to). */
  href?: string;
}

const ALL_NAV_ITEMS: NavItem[] = [
  { key: "today", label: "Today", status: "live", href: "/" },
  { key: "pipeline", label: "Pipeline & Leads", status: "live", href: "/pipeline" },
  { key: "financials", label: "Financials", status: "planned" },
  { key: "social", label: "Social & Marketing", status: "live", href: "/social" },
  { key: "trackers", label: "Trackers", status: "live", href: "/trackers" },
  { key: "comms", label: "Comms Hub", status: "live", href: "/comms" },
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
