/**
 * Dashboard — Today's Tasks, cold lead alerts, quick stats
 */

import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/app-shell';
import { LeadCard } from '@/components/leads/lead-card';
import { Badge } from '@/components/ui/badge';
import { Users, Phone, Trophy, Flame, ChevronRight } from 'lucide-react';
import { isColdLead } from '@/lib/utils';
import { format, startOfWeek, startOfMonth } from 'date-fns';
import Link from 'next/link';
import type { Lead } from '@/types';

export const revalidate = 0;

export default async function DashboardPage() {
  const supabase = await createClient();

  const today = format(new Date(), 'yyyy-MM-dd');
  const weekStart = format(startOfWeek(new Date()), 'yyyy-MM-dd');
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');

  const [
    { data: allLeads },
    { data: todayFollowUps },
    { data: contactedThisWeek },
    { data: closedThisMonth },
  ] = await Promise.all([
    supabase.from('leads').select('*').not('status', 'in', '(closed_won,closed_lost)'),
    supabase
      .from('leads')
      .select('*')
      .gte('next_followup_at', today)
      .lte('next_followup_at', today + 'T23:59:59')
      .order('next_followup_at'),
    supabase.from('leads').select('id').gte('last_contacted_at', weekStart),
    supabase.from('leads').select('id').eq('status', 'closed_won').gte('updated_at', monthStart),
  ]);

  const coldLeads = (allLeads ?? []).filter((l: Lead) => isColdLead(l.last_contacted_at));

  const stats = [
    {
      label: 'Active Leads',
      value: allLeads?.length ?? 0,
      icon: Users,
      gradient: 'from-blue-500 to-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      text: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Contacted This Week',
      value: contactedThisWeek?.length ?? 0,
      icon: Phone,
      gradient: 'from-violet-500 to-violet-600',
      bg: 'bg-violet-50 dark:bg-violet-950/40',
      text: 'text-violet-600 dark:text-violet-400',
    },
    {
      label: 'Closed This Month',
      value: closedThisMonth?.length ?? 0,
      icon: Trophy,
      gradient: 'from-emerald-500 to-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      text: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Cold Leads',
      value: coldLeads.length,
      icon: Flame,
      gradient: 'from-amber-500 to-orange-500',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-600 dark:text-amber-400',
    },
  ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-7">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{greeting} 👋</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {format(new Date(), 'EEEE, d MMMM yyyy')}
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(({ label, value, icon: Icon, bg, text }) => (
            <div key={label} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className={`inline-flex p-2 rounded-lg ${bg} mb-3`}>
                <Icon className={`h-4 w-4 ${text}`} />
              </div>
              <p className="text-2xl font-bold tracking-tight">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{label}</p>
            </div>
          ))}
        </div>

        {/* Today's Follow-ups */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-base">Today&apos;s Follow-ups</h2>
              {(todayFollowUps?.length ?? 0) > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  {todayFollowUps!.length}
                </span>
              )}
            </div>
            <Link href="/leads" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {todayFollowUps && todayFollowUps.length > 0 ? (
            <div className="space-y-2.5">
              {todayFollowUps.map((lead: Lead) => (
                <LeadCard key={lead.id} lead={lead} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed bg-card p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Trophy className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-1">No follow-ups scheduled for today.</p>
            </div>
          )}
        </div>

        {/* Cold Leads */}
        {coldLeads.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Flame className="h-4 w-4 text-amber-500" />
              <h2 className="font-semibold text-base">Needs Attention</h2>
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">
                {coldLeads.length}
              </span>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20 p-3 mb-3">
              <p className="text-xs text-amber-800 dark:text-amber-400">
                These leads haven&apos;t been contacted in 7+ days. Reach out before they go cold.
              </p>
            </div>
            <div className="space-y-2.5">
              {coldLeads.slice(0, 3).map((lead: Lead) => (
                <LeadCard key={lead.id} lead={lead} />
              ))}
              {coldLeads.length > 3 && (
                <Link href="/leads" className="block text-center text-xs text-primary hover:underline py-1">
                  View {coldLeads.length - 3} more cold leads →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
