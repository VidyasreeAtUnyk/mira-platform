/**
 * Desktop sidebar navigation — dark panel, shown at md: breakpoint and above
 */

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, Kanban, BarChart2, LogOut, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

const navItems = [
  { href: '/', label: "Today's Tasks", icon: LayoutDashboard, exact: true },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/pipeline', label: 'Pipeline', icon: Kanban },
  { href: '/intelligence', label: 'Intelligence', icon: BarChart2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 z-40">
      <div className="flex flex-col flex-1 min-h-0 bg-[oklch(0.17_0.04_255)]">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shrink-0">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold leading-none">RealEstateIntel</p>
            <p className="text-white/40 text-xs mt-0.5">Dubai CRM</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <p className="px-3 pt-1 pb-2 text-white/30 text-xs font-semibold uppercase tracking-widest">
            Menu
          </p>
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : (pathname === href || pathname.startsWith(href + '/'));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                  active
                    ? 'bg-primary/20 text-white font-medium'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-white/40')} />
                {label}
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-white/50 hover:bg-white/5 hover:text-white transition-all"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
