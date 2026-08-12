/**
 * Supabase service client — bypasses RLS, used ONLY in trusted server-side
 * code (background jobs, admin tooling). Never expose to the browser or use
 * in Server Components. Mirrors apps/crm/src/lib/supabase/service.ts.
 * Not currently called anywhere in apps/trackers (no background jobs yet) —
 * kept for parity with the crm client trio and for future module 2/11
 * integration (Today view, monthly report) that may need cross-agent reads
 * outside a request's own session.
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
