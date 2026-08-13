/**
 * Viewer-role stand-in for the SPEC.md RBAC table's "Marketing/Social"
 * founder-only-for-now gate. There is no real auth/login flow wired into
 * this app yet (no Supabase auth session, no apps/crm-style `src/proxy.ts`
 * middleware) -- see PROGRESS-social.md Notes for why that's out of scope
 * for this session. This is a deliberately lightweight, explicitly-labeled
 * stand-in: a cookie the viewer sets themselves via the nav switcher, NOT a
 * security boundary. It exists so `canCreatePosters()` (src/types/social.ts)
 * has something to gate against end-to-end, and so a real RBAC/auth pass
 * later has an obvious single place to replace with a real session role.
 */
import { cookies } from 'next/headers';
import type { ViewerRole } from '@/types/social';
import { POSTER_CREATOR_VIEWER_ROLES } from '@/types/social';

const COOKIE_NAME = 'social_viewer_role';
const DEFAULT_ROLE: ViewerRole = 'owner_coo';

export async function getViewerRole(): Promise<ViewerRole> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (raw && (POSTER_CREATOR_VIEWER_ROLES as readonly string[]).includes(raw)) {
    return raw as ViewerRole;
  }
  return DEFAULT_ROLE;
}

export { COOKIE_NAME as VIEWER_ROLE_COOKIE_NAME };
