/**
 * Month-grid calendar view for Meetings -- per direct request ("everything
 * how a google calendar works"). Scoped deliberately: a real month grid
 * with real data, day cells showing meeting counts and UAE public holidays
 * (src/lib/holidays.ts), click-through to a day's detail below the grid.
 * NOT attempted: recurring events, drag-to-reschedule, multiple calendars,
 * timezones, RSVP -- genuine Google Calendar parity is a much larger,
 * separate scope than a first calendar view, flagged rather than faked.
 */
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, List, Video, MapPin } from "lucide-react";
import { NavPills } from "@/components/layout/nav-pills";
import { Badge } from "@/components/ui/badge";
import { listMeetingsForMonth, listAttendeesByMeeting } from "@/lib/meetings";
import { holidaysForMonth } from "@/lib/holidays";
import { getAgents } from "@/lib/queries";
import { navItemsForRole, isDashboardRole, type DashboardRole } from "@/lib/roles";

export const revalidate = 0;

interface CalendarPageProps {
  searchParams: Promise<{ role?: string; month?: string; day?: string }>;
}

function parseMonthParam(month: string | undefined): { year: number; monthIndex: number } {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    return { year: y, monthIndex: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), monthIndex: now.getMonth() };
}

function toMonthStartIso(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function MeetingsCalendarPage({ searchParams }: CalendarPageProps) {
  const params = await searchParams;
  const role: DashboardRole = isDashboardRole(params.role) ? params.role : "owner_coo";
  const nav = navItemsForRole(role);

  const { year, monthIndex } = parseMonthParam(params.month);
  const monthStart = toMonthStartIso(year, monthIndex);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const todayIso = new Date().toISOString().slice(0, 10);

  const prevMonthDate = new Date(year, monthIndex - 1, 1);
  const nextMonthDate = new Date(year, monthIndex + 1, 1);
  const prevMonthParam = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const nextMonthParam = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`;

  const [meetings, agents] = await Promise.all([listMeetingsForMonth(monthStart), getAgents()]);
  const agentNamesById = new Map(agents.map((a) => [a.id, a.name]));
  const attendeesByMeeting = await listAttendeesByMeeting(meetings.map((m) => m.id));
  const holidays = holidaysForMonth(monthStart);
  const holidayByDate = new Map(holidays.map((h) => [h.date, h]));

  const meetingsByDate = new Map<string, typeof meetings>();
  for (const m of meetings) {
    const dateKey = m.starts_at.slice(0, 10);
    const list = meetingsByDate.get(dateKey) ?? [];
    list.push(m);
    meetingsByDate.set(dateKey, list);
  }

  const selectedDay = params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : todayIso;
  const selectedMeetings = (meetingsByDate.get(selectedDay) ?? []).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const selectedHoliday = holidayByDate.get(selectedDay);

  const cells: { date: string | null; inMonth: boolean }[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ date: null, inMonth: false });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, inMonth: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <header className="mb-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Meetings — Calendar</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">UAE public holidays shown for context -- Islamic-calendar dates are projected, subject to moon-sighting confirmation.</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/meetings"
                className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
              >
                <List className="h-3.5 w-3.5" />
                List
              </Link>
              <Link
                href="/meetings/new"
                className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-3.5 w-3.5" />
                New meeting
              </Link>
            </div>
          </div>
          <NavPills nav={nav} active="meetings" />
        </header>

        <div className="mb-3 flex items-center justify-between">
          <Link
            href={`/meetings/calendar?month=${prevMonthParam}`}
            className="rounded-full border border-border p-1.5 text-muted-foreground hover:bg-accent"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <h2 className="text-sm font-semibold">
            {new Date(year, monthIndex, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </h2>
          <Link
            href={`/meetings/calendar?month=${nextMonthParam}`}
            className="rounded-full border border-border p-1.5 text-muted-foreground hover:bg-accent"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            if (!cell.date) return <div key={`empty-${i}`} />;
            const dayMeetings = meetingsByDate.get(cell.date) ?? [];
            const holiday = holidayByDate.get(cell.date);
            const isToday = cell.date === todayIso;
            const isSelected = cell.date === selectedDay;
            return (
              <Link
                key={cell.date}
                href={`/meetings/calendar?month=${String(year)}-${String(monthIndex + 1).padStart(2, "0")}&day=${cell.date}`}
                className={`flex min-h-16 flex-col items-start gap-0.5 rounded-md border p-1.5 text-left text-xs transition-colors ${
                  isSelected ? "border-primary bg-primary/10" : "border-border/60 hover:bg-accent"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                    isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                  }`}
                >
                  {Number(cell.date.slice(8, 10))}
                </span>
                {holiday && (
                  <span className="truncate text-[9px] leading-tight text-warning" title={holiday.name}>
                    {holiday.confirmed ? "●" : "◐"} {holiday.name.replace(" (projected)", "").replace(" (start, projected)", "")}
                  </span>
                )}
                {dayMeetings.length > 0 && (
                  <span className="truncate text-[9px] leading-tight text-primary">
                    {dayMeetings.length} meeting{dayMeetings.length === 1 ? "" : "s"}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <section className="mt-6">
          <h3 className="mb-2 text-sm font-semibold">
            {new Date(`${selectedDay}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </h3>
          {selectedHoliday && (
            <p className="mb-2 text-xs text-warning">
              {selectedHoliday.name}
              {!selectedHoliday.confirmed && " -- projected, subject to official confirmation"}
            </p>
          )}
          {selectedMeetings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
          ) : (
            <ul className="space-y-2">
              {selectedMeetings.map((m) => {
                const attendees = attendeesByMeeting.get(m.id) ?? [];
                const organizerName = m.organizer_agent_id ? agentNamesById.get(m.organizer_agent_id) : undefined;
                return (
                  <li key={m.id} className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{m.title}</span>
                      <Badge variant={m.location_type === "online" ? "primary" : "outline"}>
                        {m.location_type === "online" ? (
                          <span className="flex items-center gap-1">
                            <Video className="h-3 w-3" /> Online
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> In person
                          </span>
                        )}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(m.starts_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        {m.ends_at && ` – ${new Date(m.ends_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
                      </span>
                    </div>
                    {(organizerName || attendees.length > 0 || m.with_name) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {m.with_name && `With ${m.with_name}`}
                        {m.with_name && (organizerName || attendees.length > 0) && " · "}
                        {organizerName && `Organized by ${organizerName}`}
                        {organizerName && attendees.length > 0 && " · "}
                        {attendees.length > 0 && `Attendees: ${attendees.map((a) => a.name).join(", ")}`}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
