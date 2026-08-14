/**
 * Meetings -- where the COO (or any agent) plans meetings, online or
 * physical-location. New concept, not part of SPEC.md's 12 modules; added
 * per direct request. Lives in apps/dashboard since that's the COO's home
 * screen and there was no better-fitting existing app for it.
 */
import Link from "next/link";
import { Plus, Video, MapPin } from "lucide-react";
import { NavPills } from "@/components/layout/nav-pills";
import { Badge } from "@/components/ui/badge";
import { listUpcomingMeetings, listPastMeetings, type Meeting } from "@/lib/meetings";
import { getAgents } from "@/lib/queries";
import { navItemsForRole, isDashboardRole, type DashboardRole } from "@/lib/roles";

export const revalidate = 0;

interface MeetingsPageProps {
  searchParams: Promise<{ role?: string }>;
}

export default async function MeetingsPage({ searchParams }: MeetingsPageProps) {
  const params = await searchParams;
  const role: DashboardRole = isDashboardRole(params.role) ? params.role : "owner_coo";
  const nav = navItemsForRole(role);

  const [upcoming, past, agents] = await Promise.all([listUpcomingMeetings(), listPastMeetings(10), getAgents()]);
  const agentNamesById = new Map(agents.map((a) => [a.id, a.name]));

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <header className="mb-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Meetings</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">Online or in person -- your own calendar entries, separate from the review queue.</p>
            </div>
            <Link
              href="/meetings/new"
              className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              New meeting
            </Link>
          </div>
          <NavPills nav={nav} active="meetings" />
        </header>

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Upcoming</h2>
          {upcoming.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="space-y-2.5">
              {upcoming.map((m) => (
                <MeetingRow key={m.id} meeting={m} organizerName={m.organizer_agent_id ? agentNamesById.get(m.organizer_agent_id) : undefined} />
              ))}
            </ul>
          )}
        </section>

        {past.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Past</h2>
            <ul className="space-y-2.5 opacity-70">
              {past.map((m) => (
                <MeetingRow key={m.id} meeting={m} organizerName={m.organizer_agent_id ? agentNamesById.get(m.organizer_agent_id) : undefined} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function MeetingRow({ meeting, organizerName }: { meeting: Meeting; organizerName?: string }) {
  const starts = new Date(meeting.starts_at);
  return (
    <li className="rounded-lg border border-border bg-card px-3.5 py-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">{meeting.title}</span>
            <Badge variant={meeting.location_type === "online" ? "primary" : "outline"}>
              {meeting.location_type === "online" ? (
                <span className="flex items-center gap-1">
                  <Video className="h-3 w-3" /> Online
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> In person
                </span>
              )}
            </Badge>
          </div>
          {meeting.with_name && <p className="mt-0.5 text-xs text-muted-foreground">With {meeting.with_name}</p>}
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {meeting.location_type === "online" ? (
              <a href={meeting.location_value} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                {meeting.location_value}
              </a>
            ) : (
              meeting.location_value
            )}
          </p>
          {organizerName && <p className="mt-0.5 text-[11px] text-muted-foreground/70">Organized by {organizerName}</p>}
        </div>
        <div className="shrink-0 text-right text-xs text-muted-foreground">
          {starts.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          <br />
          {starts.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
        </div>
      </div>
      {meeting.notes && <p className="mt-2 text-xs text-muted-foreground">{meeting.notes}</p>}
    </li>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border py-8 text-center">
      <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
      <Link href="/meetings/new" className="mt-1 inline-block text-sm text-primary hover:underline">
        Plan a meeting
      </Link>
    </div>
  );
}
