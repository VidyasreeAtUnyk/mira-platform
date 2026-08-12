/**
 * Supabase browser client — used in Client Components.
 * Creates a singleton to avoid multiple GoTrue instances.
 * Mirrors apps/crm/src/lib/supabase/client.ts exactly (same auth project,
 * same identity model: agents.id = auth.uid()).
 */

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
