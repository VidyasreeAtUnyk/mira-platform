/**
 * QuickAddFAB — floating action button for mobile lead capture
 */

'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';

export function QuickAddFAB() {
  return (
    <Link
      href="/leads/new"
      className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 md:hidden"
      aria-label="Add new lead"
    >
      <Plus className="h-6 w-6" />
    </Link>
  );
}
