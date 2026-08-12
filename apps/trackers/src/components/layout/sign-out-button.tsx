'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

  if (!supabaseConfigured) {
    // Local dev/test bypass is active (see src/lib/current-agent.ts) --
    // there's no real session to sign out of.
    return (
      <span className="text-xs text-muted-foreground" title="No live Supabase project configured — dev bypass active">
        dev mode
      </span>
    );
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleSignOut}>
      <LogOut className="size-3.5" />
      Sign out
    </Button>
  );
}
