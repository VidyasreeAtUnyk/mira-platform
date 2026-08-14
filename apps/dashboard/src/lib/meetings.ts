/**
 * Data access for the Meetings feature (src/db/local-schema.sql) -- where
 * the COO (or any agent) plans meetings, online or physical-location,
 * separate from the review-queue/draft-and-hold flows every other module
 * here has. Meetings aren't a draft awaiting approval; they're just a
 * calendar entry someone is creating for themselves, so there's no
 * pending/approved state machine here.
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

export async function createMeeting(input: CreateMeetingInput): Promise<Meeting> {
  await ensureLocalSchema();
  const db = getDb();
  const res = await db.query<Meeting>(
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
  return res.rows[0];
}
