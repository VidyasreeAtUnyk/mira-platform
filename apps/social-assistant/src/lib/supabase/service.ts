/**
 * Supabase service client — bypasses RLS, used ONLY in API routes.
 * Mirrors apps/crm/src/lib/supabase/service.ts. Never expose to the browser.
 *
 * Reads SUPABASE_SERVICE_ROLE_KEY from the environment — never hardcoded.
 * If unset, callers should get a clear error, not a silent fallback that
 * pretends to be connected (see src/lib/data/*.ts for how routes degrade
 * to an in-memory fixture store when no DB is configured, so the app is
 * demoable without real credentials, per CLAUDE.md's "never hardcode
 * credentials" + "flag the gap" rule).
 */

import { createClient } from '@supabase/supabase-js';

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/** Whether real Supabase credentials are configured for this environment. */
export function hasSupabaseCredentials(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
