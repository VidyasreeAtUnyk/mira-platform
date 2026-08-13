'use client';

/**
 * Client island for just the nav links -- usePathname() (to highlight the
 * active link) is a client-only hook, extracted out of header.tsx so that
 * file can be an async Server Component. See header.tsx / header-
 * interactive.tsx for the same split applied to the rest of the header.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PenSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

export function HeaderNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      <Link
        href="/"
        className={cn(
          'rounded-md px-3 py-1.5 text-sm font-medium',
          pathname === '/' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
        )}
      >
        Inbox
      </Link>
      <Link
        href="/compose"
        className={cn(
          'flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium',
          pathname === '/compose' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
        )}
      >
        <PenSquare className="h-3.5 w-3.5" />
        Compose
      </Link>
    </nav>
  );
}
