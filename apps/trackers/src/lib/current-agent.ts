/**
 * Resolves "who is logged in" for a server component / server action.
 *
 * Production path: Supabase session (agents.id = auth.uid(), same identity
 * model as apps/crm) via src/lib/supabase/server.ts.
 *
 * Local dev/test path: no live Supabase project exists anywhere in this repo
 * (see PROGRESS-phase0.md / apps/lead-agent's client.ts for the same
 * blocker, and packages/shared-db/README.md). Without
 * NEXT_PUBLIC_SUPABASE_URL configured, calling the Supabase auth client would
 * throw (bad/empty URL) before ever reaching a "no session" branch, which
 * would make it impossible to run `npm run dev` against a seeded local
 * Postgres and actually click through the app -- exactly what this module's
 * build task requires verifying. `isSupabaseConfigured()` is the single
 * gate: when it's false this falls back to treating `DEV_AGENT_ID` as the
 * logged-in agent, resolved against the same local Postgres the rest of the
 * app reads from. The instant real Supabase env vars are set (i.e. in any
 * real deployment), this whole branch is unreachable and normal session auth
 * takes over -- this is not a flag a production deploy can leave on by
 * accident, it's the *absence* of the real config.
 */

import type { Agent } from "@mira/shared-types";
import { createClient } from "./supabase/server";
import { db } from "./db";

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Returns null if nobody is logged in (caller should redirect to /login). */
export async function getCurrentAgent(): Promise<Agent | null> {
  const pool = await db();

  if (!isSupabaseConfigured()) {
    const devAgentId = process.env.DEV_AGENT_ID;
    if (!devAgentId) return null;
    const result = await pool.query<Agent>("select * from agents where id = $1", [devAgentId]);
    return result.rows[0] ?? null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const result = await pool.query<Agent>("select * from agents where id = $1", [user.id]);
  return result.rows[0] ?? null;
}

/** Throws if nobody is logged in -- use in server actions/pages that require auth (the proxy should already have redirected, this is defense-in-depth). */
export async function requireCurrentAgent(): Promise<Agent> {
  const agent = await getCurrentAgent();
  if (!agent) throw new Error("Not authenticated");
  return agent;
}
