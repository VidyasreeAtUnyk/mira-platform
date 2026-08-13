/**
 * "Logged-in viewer" stand-in -- a cookie the user sets themselves via the
 * header's role switcher, same pattern apps/social-assistant's
 * src/lib/auth/viewer-role.ts uses. THIS IS NOT AUTH: no session, no
 * server-side enforcement beyond src/lib/rbac.ts's filtering, which itself
 * is documented as best-effort pending real RBAC (see that file's header).
 *
 * RESOLVED (was cookie-selecting among a hardcoded DEMO_VIEWERS list, see
 * PROGRESS-integration.md): now resolves against real agents in the shared
 * `agents` table (src/lib/data/comms.ts's listViewers()), the same rows
 * every other module's seed script populates -- switching "Viewing as"
 * shows real cross-module agents, not a fixed demo list.
 */
import { cookies } from "next/headers";
import { listViewers } from "@/lib/data/comms";
import type { Viewer } from "@/types";

const COOKIE_NAME = "comms_viewer_agent_id";

/** Falls back to the first owner_coo agent (or the first agent at all) if the cookie is unset/stale. */
export async function getCurrentViewer(): Promise<{ viewer: Viewer; viewers: Viewer[] }> {
  const viewers = await listViewers();
  if (viewers.length === 0) {
    throw new Error("No agents exist in the shared database yet -- seed at least one before using comms-hub.");
  }
  const store = await cookies();
  const cookieAgentId = store.get(COOKIE_NAME)?.value;
  const fromCookie = cookieAgentId ? viewers.find((v) => v.agentId === cookieAgentId) : undefined;
  const viewer = fromCookie ?? viewers.find((v) => v.role === "owner_coo") ?? viewers[0];
  return { viewer, viewers };
}

export { COOKIE_NAME as VIEWER_COOKIE_NAME };
