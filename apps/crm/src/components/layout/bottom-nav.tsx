/**
 * Mobile bottom navigation — shown below md: breakpoint
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Kanban, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Today', icon: LayoutDashboard, exact: true },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/pipeline', label: 'Pipeline', icon: Kanban },
  { href: '/intelligence', label: 'Intel', icon: BarChart2 },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm md:hidden">
      <div className="flex h-16 items-stretch pb-safe">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : (pathname === href || pathname.startsWith(href + '/'));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <div className={cn(
                'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                active ? 'bg-primary/10' : ''
              )}>
                <Icon className="h-4 w-4" />
              </div>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
