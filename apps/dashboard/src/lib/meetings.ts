/**
 * Data access for the Meetings feature (src/db/local-schema.sql) -- where
 * the COO (or any agent) plans meetings, online or physical-location,
 * separate from the review-queue/draft-and-hold flows every other module
 * here has. Meetings aren't a draft awaiting approval; they're just a
 * calendar entry someone is creating for themselves, so there's no
 * pending/approved state machine here.
 *
 * "Gets notified" (attendees): scoped to real agents in this system only,
 * shown to them in-app (their name appears on the meeting; a future
 * per-agent "my meetings" view could surface it to them directly once
 * this app has any real identity/session concept -- it doesn't yet, see
 * src/lib/roles.ts's header). No live email/push notification is sent to
 * anyone -- there is no send infrastructure anywhere in this platform,
 * and CLAUDE.md forbids sending anything live outside a review/approval
 * flow this feature doesn't have. Not faked, not silently skipped either.
 */
import { getDb, ensureLocalSchema } from "./db";

export type MeetingLocationType = "online" | "physical";

export interface Meeting {
  id: string;
  title: string;
  location_type: MeetingLocationType;
  location_value: string;
  starts_at: string;
  ends_at: string | null;
  with_name: string | null;
  lead_id: string | null;
  organizer_agent_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface CreateMeetingInput {
  title: string;
  location_type: MeetingLocationType;
  location_value: string;
  starts_at: string;
  ends_at?: string | null;
  with_name?: string | null;
  lead_id?: string | null;
  organizer_agent_id?: string | null;
  notes?: string | null;
  attendeeAgentIds?: string[];
}

/** A meeting a given set of agents (organizer + attendees) is already booked for, overlapping a candidate time range. */
export interface Conflict {
  meetingId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  conflictingAgentIds: string[];
}

export async function listUpcomingMeetings(limit = 50): Promise<Meeting[]> {
  await ensureLocalSchema();
  const db = getDb();
  const res = await db.query<Meeting>(
    `select * from meetings where starts_at >= now() - interval '1 hour' order by starts_at asc limit $1`,
    [limit]
  );
  return res.rows;
}

export async function listPastMeetings(limit = 20): Promise<Meeting[]> {
  await ensureLocalSchema();
  const db = getDb();
  const res = await db.query<Meeting>(
    `select * from meetings where starts_at < now() - interval '1 hour' order by starts_at desc limit $1`,
    [limit]
  );
  return res.rows;
}

/** Meetings starting today (calendar day), for the Today brief's attention list -- same day-window pattern as getDashboardStats()'s todayFollowUps. */
export async function listMeetingsToday(): Promise<Meeting[]> {
  await ensureLocalSchema();
  const db = getDb();
  const res = await db.query<Meeting>(
    `select * from meetings
     where starts_at >= date_trunc('day', now()) and starts_at < date_trunc('day', now()) + interval '1 day'
     order by starts_at asc`
  );
  return res.rows;
}

/** Meetings starting within the next N days, for the Today brief / Planned tab -- same window logic as getPlanned() in queries.ts. */
export async function listMeetingsInNextDays(days: number): Promise<Meeting[]> {
  await ensureLocalSchema();
  const db = getDb();
  const res = await db.query<Meeting>(
    `select * from meetings where starts_at >= now() and starts_at < now() + ($1 || ' days')::interval order by starts_at asc`,
    [days]
  );
  return res.rows;
}

/** All meetings whose start falls within [monthStart, monthStart + 1 month) -- for the calendar view. monthStart is a "YYYY-MM-01" date string. */
export async function listMeetingsForMonth(monthStart: string): Promise<Meeting[]> {
  await ensureLocalSchema();
  const db = getDb();
  const res = await db.query<Meeting>(
    `select * from meetings
     where starts_at >= $1::date and starts_at < ($1::date + interval '1 month')
     order by starts_at asc`,
    [monthStart]
  );
  return res.rows;
}

/** agent_id -> attendee names, batched for a list of meetings (avoids N+1 on the list/calendar views). */
export async function listAttendeesByMeeting(meetingIds: string[]): Promise<Map<string, { agentId: string; name: string }[]>> {
  await ensureLocalSchema();
  if (meetingIds.length === 0) return new Map();
  const db = getDb();
  const res = await db.query<{ meeting_id: string; agent_id: string; name: string }>(
    `select ma.meeting_id, ma.agent_id, a.name
     from meeting_attendees ma
     join agents a on a.id = ma.agent_id
     where ma.meeting_id = any($1::uuid[])
     order by a.name asc`,
    [meetingIds]
  );
  const map = new Map<string, { agentId: string; name: string }[]>();
  for (const row of res.rows) {
    const list = map.get(row.meeting_id) ?? [];
    list.push({ agentId: row.agent_id, name: row.name });
    map.set(row.meeting_id, list);
  }
  return map;
}

/**
 * Meetings that already book any of `agentIds` (as organizer or attendee)
 * during [startsAt, endsAt) -- real interval-overlap math via Postgres'
 * `tstzrange` range type and `&&` overlap operator, not a hand-rolled
 * comparison. A meeting with no `ends_at` set is treated as a 1-hour
 * placeholder for this check (matches the default duration the create
 * form now applies going forward) rather than a zero-width instant, which
 * would silently never conflict with anything.
 */
export async function findConflicts(
  agentIds: string[],
  startsAt: string,
  endsAt: string,
  excludeMeetingId?: string
): Promise<Conflict[]> {
  await ensureLocalSchema();
  if (agentIds.length === 0) return [];
  const db = getDb();
  const res = await db.query<{
    id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    conflicting_agent_ids: string[];
  }>(
    `select m.id, m.title, m.starts_at, coalesce(m.ends_at, m.starts_at + interval '1 hour') as ends_at,
       array_remove(array_agg(distinct case when m.organizer_agent_id = any($1::uuid[]) then m.organizer_agent_id end)
         || array_agg(distinct case when ma.agent_id = any($1::uuid[]) then ma.agent_id end), null) as conflicting_agent_ids
     from meetings m
     left join meeting_attendees ma on ma.meeting_id = m.id
     where (m.organizer_agent_id = any($1::uuid[]) or ma.agent_id = any($1::uuid[]))
       and m.id != coalesce($4::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
       and tstzrange(m.starts_at, coalesce(m.ends_at, m.starts_at + interval '1 hour')) && tstzrange($2::timestamptz, $3::timestamptz)
     group by m.id`,
    [agentIds, startsAt, endsAt, excludeMeetingId ?? null]
  );
  return res.rows.map((r) => ({
    meetingId: r.id,
    title: r.title,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    conflictingAgentIds: r.conflicting_agent_ids,
  }));
}

export async function createMeeting(input: CreateMeetingInput): Promise<Meeting> {
  await ensureLocalSchema();
  const db = getDb();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const res = await client.query<Meeting>(
      `insert into meetings (title, location_type, location_value, starts_at, ends_at, with_name, lead_id, organizer_agent_id, notes)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning *`,
      [
        input.title,
        input.location_type,
        input.location_value,
        input.starts_at,
        input.ends_at ?? null,
        input.with_name ?? null,
        input.lead_id ?? null,
        input.organizer_agent_id ?? null,
        input.notes ?? null,
      ]
    );
    const meeting = res.rows[0];
    for (const agentId of input.attendeeAgentIds ?? []) {
      await client.query(
        `insert into meeting_attendees (meeting_id, agent_id) values ($1, $2) on conflict (meeting_id, agent_id) do nothing`,
        [meeting.id, agentId]
      );
    }
    await client.query("COMMIT");
    return meeting;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
