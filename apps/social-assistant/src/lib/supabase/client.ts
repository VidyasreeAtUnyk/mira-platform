/**
 * Supabase browser client — used in Client Components. Mirrors
 * apps/crm/src/lib/supabase/client.ts for consistency across the monorepo.
 */

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
